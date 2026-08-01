"""DynamoDB single-table implementation of :class:`Repository`.

Layout (see ``backend/README.md`` for the full table): every item lives in the
room partition ``ROOM#<code>``. The room aggregate — metadata, the player
roster, and the running score — is a single ``META`` item, so joining and
readiness are single conditional updates. Rounds, submissions and connections
are child items in the same partition.

The operations where two requests could otherwise race are done with DynamoDB
condition expressions or transactions:

- *joining the final slot* — a conditional update gated on ``size(players)``;
- *starting a round* — a transaction that creates the round only if absent and
  flips the room into it;
- *recording the first result* — a transaction gated on the round still being
  ACTIVE, with optimistic concurrency on the winner's score.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Optional

import boto3
from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from domain.errors import DomainError, ErrorCode
from domain.room import Player, Room, RoomStatus
from domain.round import Round, RoundStatus, Submission

from . import keys

_TTL_ATTR = "ttl"
_serializer = TypeSerializer()


def _av(value: Any) -> dict:
    """Marshal a Python value to a DynamoDB AttributeValue for the low-level API."""
    return _serializer.serialize(value)


def _to_int(value: Any) -> int:
    return int(value) if isinstance(value, Decimal) else int(value)


class DynamoDbRepository:
    """Repository backed by one DynamoDB table with one GSI."""

    def __init__(self, table_name: str, ttl_seconds: int) -> None:
        self._table_name = table_name
        self._ttl_seconds = ttl_seconds
        self._resource = boto3.resource("dynamodb")
        self._table = self._resource.Table(table_name)
        # A *raw* low-level client for the hand-built transactions. It must NOT
        # be self._resource.meta.client: that client carries boto3's high-level
        # DynamoDB transform, which would serialize our already TypeSerializer-
        # serialized AttributeValues a second time (turning e.g. PK into a Map)
        # and silently cancel every transaction. The resource Table (above) keeps
        # the high-level interface for the non-transactional reads and writes.
        self._client = boto3.client("dynamodb")

    # ── Rooms ──────────────────────────────────────────────────────────────

    def create_room(self, room: Room) -> None:
        self._table.put_item(
            Item=self._room_item(room),
            ConditionExpression="attribute_not_exists(PK)",
        )

    def get_room(self, code: str) -> Optional[Room]:
        resp = self._table.get_item(Key={"PK": keys.room_pk(code), "SK": keys.meta_sk()})
        item = resp.get("Item")
        if not item:
            return None
        return self._room_from_item(item)

    def add_player(self, code: str, player: Player, now_epoch_s: int) -> Room:
        try:
            self._table.update_item(
                Key={"PK": keys.room_pk(code), "SK": keys.meta_sk()},
                UpdateExpression=(
                    "SET players.#pid = :player, scores.#pid = :zero"
                ),
                ConditionExpression=(
                    "attribute_exists(PK) AND #status = :waiting "
                    "AND size(players) < #cap AND #ttl > :now "
                    "AND attribute_not_exists(players.#pid)"
                ),
                ExpressionAttributeNames={
                    "#pid": player.player_id,
                    "#status": "status",
                    "#ttl": _TTL_ATTR,
                    "#cap": "capacity",
                },
                ExpressionAttributeValues={
                    ":player": self._player_map(player),
                    ":zero": 0,
                    ":waiting": RoomStatus.WAITING.value,
                    ":now": now_epoch_s,
                },
            )
        except ClientError as exc:
            self._raise_join_error(exc, code)
        room = self.get_room(code)
        assert room is not None
        return room

    def set_player_ready(self, code: str, player_id: str, ready: bool) -> Room:
        try:
            self._table.update_item(
                Key={"PK": keys.room_pk(code), "SK": keys.meta_sk()},
                UpdateExpression="SET players.#pid.#ready = :r",
                ConditionExpression="attribute_exists(players.#pid)",
                ExpressionAttributeNames={"#pid": player_id, "#ready": "ready"},
                ExpressionAttributeValues={":r": ready},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise DomainError(ErrorCode.PLAYER_NOT_FOUND, "Player is not in this room.") from exc
            raise
        room = self.get_room(code)
        assert room is not None
        return room

    def reset_ready(self, code: str) -> Room:
        room = self.get_room(code)
        if room is None:
            raise DomainError(ErrorCode.ROOM_NOT_FOUND, "Room does not exist.")
        if not room.players:
            return room
        names: dict[str, str] = {"#ready": "ready"}
        sets = []
        values = {":false": False}
        for i, pid in enumerate(room.players):
            names[f"#p{i}"] = pid
            sets.append(f"players.#p{i}.#ready = :false")
        self._table.update_item(
            Key={"PK": keys.room_pk(code), "SK": keys.meta_sk()},
            UpdateExpression="SET " + ", ".join(sets),
            ExpressionAttributeNames=names,
            ExpressionAttributeValues=values,
        )
        room2 = self.get_room(code)
        assert room2 is not None
        return room2

    # ── Rounds ─────────────────────────────────────────────────────────────

    def start_round(self, code: str, round_: Round) -> bool:
        prev = round_.number - 1
        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Put": {
                            "TableName": self._table_name,
                            "Item": {k: _av(v) for k, v in self._round_item(round_).items()},
                            "ConditionExpression": "attribute_not_exists(SK)",
                        }
                    },
                    {
                        "Update": {
                            "TableName": self._table_name,
                            "Key": {"PK": _av(keys.room_pk(code)), "SK": _av(keys.meta_sk())},
                            "UpdateExpression": "SET #status = :playing, currentRound = :n",
                            "ConditionExpression": "#status = :waiting AND currentRound = :prev",
                            "ExpressionAttributeNames": {"#status": "status"},
                            "ExpressionAttributeValues": {
                                ":playing": _av(RoomStatus.PLAYING.value),
                                ":waiting": _av(RoomStatus.WAITING.value),
                                ":n": _av(round_.number),
                                ":prev": _av(prev),
                            },
                        }
                    },
                ]
            )
            return True
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("TransactionCanceledException", "ConditionalCheckFailedException"):
                return False
            raise

    def get_round(self, code: str, number: int) -> Optional[Round]:
        resp = self._table.query(
            KeyConditionExpression=Key("PK").eq(keys.room_pk(code))
            & Key("SK").begins_with(keys.round_sk(number))
        )
        round_item = None
        submissions: list[Submission] = []
        prefix = keys.round_sk(number)
        for item in resp.get("Items", []):
            sk = item["SK"]
            if sk == prefix:
                round_item = item
            elif sk.startswith(prefix + "#SUB#"):
                submissions.append(self._submission_from_item(item))
        if round_item is None:
            return None
        round_ = self._round_from_item(round_item)
        round_.submissions = {s.player_id: s for s in submissions}
        return round_

    def get_submission(self, code: str, number: int, player_id: str) -> Optional[Submission]:
        resp = self._table.get_item(
            Key={"PK": keys.room_pk(code), "SK": keys.submission_sk(number, player_id)}
        )
        item = resp.get("Item")
        return self._submission_from_item(item) if item else None

    def save_submission(self, code: str, number: int, submission: Submission) -> None:
        self._table.put_item(Item=self._submission_item(code, number, submission))

    def list_submissions(self, code: str, number: int) -> list[Submission]:
        prefix = keys.round_sk(number) + "#SUB#"
        resp = self._table.query(
            KeyConditionExpression=Key("PK").eq(keys.room_pk(code)) & Key("SK").begins_with(prefix)
        )
        return [self._submission_from_item(i) for i in resp.get("Items", [])]

    def complete_round(
        self, code: str, number: int, winner_id: Optional[str], best_of: int
    ) -> tuple[Room, bool]:
        room = self.get_room(code)
        if room is None:
            raise DomainError(ErrorCode.ROOM_NOT_FOUND, "Room does not exist.")

        # Post-increment score and resulting room status are decided here, then
        # committed under optimistic-concurrency conditions so the transaction
        # is safe against a concurrent completer.
        new_status = RoomStatus.WAITING.value
        meta_names: dict[str, str] = {"#status": "status", "#ready": "ready"}
        meta_values: dict[str, Any] = {
            ":playing": _av(RoomStatus.PLAYING.value),
            ":false": _av(False),
        }
        set_clauses = ["#status = :newstatus"]
        cond_clauses = ["#status = :playing"]

        if winner_id is not None:
            old_score = room.scores.get(winner_id, 0)
            new_score = old_score + 1
            from domain.scoring import wins_needed

            if new_score >= wins_needed(best_of):
                new_status = RoomStatus.COMPLETED.value
            meta_names["#w"] = winner_id
            meta_values[":neww"] = _av(new_score)
            set_clauses.append("scores.#w = :neww")
            if winner_id in room.scores:
                meta_values[":oldw"] = _av(old_score)
                cond_clauses.append("scores.#w = :oldw")
            else:
                cond_clauses.append("attribute_not_exists(scores.#w)")

        meta_values[":newstatus"] = _av(new_status)
        for i, pid in enumerate(room.players):
            meta_names[f"#p{i}"] = pid
            set_clauses.append(f"players.#p{i}.#ready = :false")

        try:
            self._client.transact_write_items(
                TransactItems=[
                    {
                        "Update": {
                            "TableName": self._table_name,
                            "Key": {"PK": _av(keys.room_pk(code)), "SK": _av(keys.round_sk(number))},
                            "UpdateExpression": "SET #status = :complete, winnerId = :w",
                            "ConditionExpression": "#status = :active",
                            "ExpressionAttributeNames": {"#status": "status"},
                            "ExpressionAttributeValues": {
                                ":complete": _av(RoundStatus.COMPLETE.value),
                                ":active": _av(RoundStatus.ACTIVE.value),
                                ":w": _av(winner_id),
                            },
                        }
                    },
                    {
                        "Update": {
                            "TableName": self._table_name,
                            "Key": {"PK": _av(keys.room_pk(code)), "SK": _av(keys.meta_sk())},
                            "UpdateExpression": "SET " + ", ".join(set_clauses),
                            "ConditionExpression": " AND ".join(cond_clauses),
                            "ExpressionAttributeNames": meta_names,
                            "ExpressionAttributeValues": meta_values,
                        }
                    },
                ]
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] in ("TransactionCanceledException", "ConditionalCheckFailedException"):
                updated = self.get_room(code)
                assert updated is not None
                return updated, False
            raise

        updated = self.get_room(code)
        assert updated is not None
        return updated, True

    def advance_to_next_round(self, code: str, completed_round: int) -> Room:
        return self.reset_ready(code)

    # ── Connections ────────────────────────────────────────────────────────

    def register_connection(
        self, code: str, connection_id: str, player_id: str, ttl_epoch_s: int
    ) -> None:
        self._table.put_item(
            Item={
                "PK": keys.room_pk(code),
                "SK": keys.connection_sk(connection_id),
                "GSI1PK": keys.connection_gsi_pk(connection_id),
                "GSI1SK": keys.connection_gsi_pk(connection_id),
                "entityType": "CONN",
                "connectionId": connection_id,
                "playerId": player_id,
                "active": True,
                _TTL_ATTR: ttl_epoch_s,
            }
        )

    def deactivate_connection(self, connection_id: str) -> Optional[tuple[str, str]]:
        resp = self._table.query(
            IndexName=keys.GSI1_NAME,
            KeyConditionExpression=Key("GSI1PK").eq(keys.connection_gsi_pk(connection_id)),
        )
        items = resp.get("Items", [])
        if not items:
            return None
        item = items[0]
        code = item["PK"].split("#", 1)[1]
        player_id = item["playerId"]
        # Mark the connection inactive and remove it from the GSI so a later
        # disconnect of a reused ID cannot resolve to a stale player.
        self._table.update_item(
            Key={"PK": item["PK"], "SK": item["SK"]},
            UpdateExpression="SET #active = :false REMOVE GSI1PK, GSI1SK",
            ExpressionAttributeNames={"#active": "active"},
            ExpressionAttributeValues={":false": False},
        )
        # Mark the player inactive without deleting them — reconnect stays open.
        try:
            self._table.update_item(
                Key={"PK": item["PK"], "SK": keys.meta_sk()},
                UpdateExpression="SET players.#pid.#active = :false",
                ConditionExpression="attribute_exists(players.#pid)",
                ExpressionAttributeNames={"#pid": player_id, "#active": "active"},
                ExpressionAttributeValues={":false": False},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
                raise
        return code, player_id

    def reactivate_player(
        self, code: str, connection_id: str, player_id: str, ttl_epoch_s: int
    ) -> Room:
        # Retire the player's existing connection rows first. A phone that
        # loses signal often opens the new socket before API Gateway reports
        # the old one gone, so without this the room briefly holds two live
        # connections for one player and which of them a broadcast reaches
        # depends on query order.
        resp = self._table.query(
            KeyConditionExpression=Key("PK").eq(keys.room_pk(code)) & Key("SK").begins_with("CONN#"),
            FilterExpression="#active = :true AND playerId = :pid",
            ExpressionAttributeNames={"#active": "active"},
            ExpressionAttributeValues={":true": True, ":pid": player_id},
        )
        for item in resp.get("Items", []):
            if item["connectionId"] == connection_id:
                continue
            self._table.update_item(
                Key={"PK": item["PK"], "SK": item["SK"]},
                UpdateExpression="SET #active = :false REMOVE GSI1PK, GSI1SK",
                ExpressionAttributeNames={"#active": "active"},
                ExpressionAttributeValues={":false": False},
            )

        # Mark the player active again. Gated on the player still existing, so
        # a reconnect against a reaped room fails loudly rather than resurrecting
        # a ghost.
        try:
            self._table.update_item(
                Key={"PK": keys.room_pk(code), "SK": keys.meta_sk()},
                UpdateExpression="SET players.#pid.#active = :true",
                ConditionExpression="attribute_exists(players.#pid)",
                ExpressionAttributeNames={"#pid": player_id, "#active": "active"},
                ExpressionAttributeValues={":true": True},
            )
        except ClientError as exc:
            if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
                raise DomainError(ErrorCode.PLAYER_NOT_FOUND, "We couldn't find your player in this room.") from exc
            raise

        self.register_connection(code, connection_id, player_id, ttl_epoch_s)
        room = self.get_room(code)
        if room is None:
            raise DomainError(ErrorCode.ROOM_NOT_FOUND, "The requested room does not exist.")
        return room

    def connections_for_room(self, code: str) -> dict[str, str]:
        resp = self._table.query(
            KeyConditionExpression=Key("PK").eq(keys.room_pk(code)) & Key("SK").begins_with("CONN#"),
            FilterExpression="#active = :true",
            ExpressionAttributeNames={"#active": "active"},
            ExpressionAttributeValues={":true": True},
        )
        return {i["playerId"]: i["connectionId"] for i in resp.get("Items", [])}

    # ── Item mapping ───────────────────────────────────────────────────────

    def _expires_at(self) -> int:
        import time

        return int(time.time()) + self._ttl_seconds

    def _room_item(self, room: Room) -> dict:
        return {
            "PK": keys.room_pk(room.code),
            "SK": keys.meta_sk(),
            "entityType": "ROOM",
            "code": room.code,
            "matchId": room.match_id,
            "hostPlayerId": room.host_player_id,
            "status": room.status.value,
            "capacity": room.capacity,
            "bestOf": room.best_of,
            "roundSeconds": room.round_seconds,
            "currentRound": room.current_round,
            "scores": dict(room.scores),
            "players": {pid: self._player_map(p) for pid, p in room.players.items()},
            "createdAt": room.created_at,
            _TTL_ATTR: room.expires_at,
        }

    @staticmethod
    def _player_map(player: Player) -> dict:
        return {
            "displayName": player.display_name,
            "isHost": player.is_host,
            "ready": player.ready,
            "active": player.active,
            "joinedAt": player.joined_at,
        }

    def _room_from_item(self, item: dict) -> Room:
        players = {
            pid: Player(
                player_id=pid,
                display_name=pm["displayName"],
                is_host=bool(pm.get("isHost", False)),
                ready=bool(pm.get("ready", False)),
                active=bool(pm.get("active", True)),
                joined_at=_to_int(pm.get("joinedAt", 0)),
            )
            for pid, pm in item.get("players", {}).items()
        }
        return Room(
            code=item["code"],
            match_id=item["matchId"],
            host_player_id=item["hostPlayerId"],
            status=RoomStatus(item["status"]),
            capacity=_to_int(item["capacity"]),
            best_of=_to_int(item["bestOf"]),
            round_seconds=_to_int(item.get("roundSeconds", 45)),
            current_round=_to_int(item.get("currentRound", 0)),
            scores={k: _to_int(v) for k, v in item.get("scores", {}).items()},
            players=players,
            created_at=_to_int(item.get("createdAt", 0)),
            expires_at=_to_int(item.get(_TTL_ATTR, 0)),
        )

    def _round_item(self, round_: Round) -> dict:
        return {
            "PK": keys.room_pk(round_.code),
            "SK": keys.round_sk(round_.number),
            "entityType": "ROUND",
            "code": round_.code,
            "matchId": round_.match_id,
            "roundNumber": round_.number,
            "numbers": list(round_.numbers),
            "target": round_.target,
            "startsAt": round_.starts_at,
            "endsAt": round_.ends_at,
            "revealAt": round_.reveal_at,
            "status": round_.status.value,
            "winnerId": round_.winner_id,
            _TTL_ATTR: round_.expires_at,
        }

    def _round_from_item(self, item: dict) -> Round:
        return Round(
            code=item["code"],
            match_id=item["matchId"],
            number=_to_int(item["roundNumber"]),
            numbers=[_to_int(n) for n in item.get("numbers", [])],
            target=_to_int(item["target"]),
            starts_at=_to_int(item["startsAt"]),
            ends_at=_to_int(item["endsAt"]),
            reveal_at=_to_int(item["revealAt"]),
            status=RoundStatus(item["status"]),
            winner_id=item.get("winnerId"),
            expires_at=_to_int(item.get(_TTL_ATTR, 0)),
        )

    def _submission_item(self, code: str, number: int, s: Submission) -> dict:
        return {
            "PK": keys.room_pk(code),
            "SK": keys.submission_sk(number, s.player_id),
            "entityType": "SUB",
            "roundNumber": number,
            "playerId": s.player_id,
            "expression": s.expression,
            "value": s.value,
            "distance": s.distance,
            "operations": s.operations,
            "exact": s.exact,
            "submittedAt": s.submitted_at,
            _TTL_ATTR: self._expires_at(),
        }

    def _submission_from_item(self, item: dict) -> Submission:
        return Submission(
            player_id=item["playerId"],
            expression=item["expression"],
            value=_to_int(item["value"]),
            distance=_to_int(item["distance"]),
            operations=_to_int(item["operations"]),
            exact=bool(item["exact"]),
            submitted_at=_to_int(item["submittedAt"]),
        )

    @staticmethod
    def _raise_join_error(exc: ClientError, code: str) -> None:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise exc
        # The condition bundles several reasons; re-read to give a precise code.
        raise DomainError(ErrorCode.ROOM_FULL, "Room is full or not accepting players.") from exc
