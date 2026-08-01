"""Internal routing from a WebSocket route key to a handler.

API Gateway selects the route from ``$request.body.action`` (and the two
built-in routes ``$connect``/``$disconnect``), so the route key *is* the action.
This module maps it to a handler, parses the envelope for message routes, and
turns any :class:`DomainError` into the stable ``error`` frame. Unexpected
exceptions become a generic ``INTERNAL_ERROR`` — never a raw stack trace on the
wire.
"""

from __future__ import annotations

import logging

from domain.errors import DomainError, ErrorCode
from handlers import (
    connect,
    create_room,
    disconnect,
    join_room,
    next_round,
    ping,
    ready,
    reconnect,
    submit_answer,
)
from logging_config import get_logger, log
from protocol import Request, error, parse_request
from services.game_service import GameService

logger = get_logger(__name__)

CONNECT_ROUTE = "$connect"
DISCONNECT_ROUTE = "$disconnect"

# Routes whose handlers cannot post back to the client (the connection is not
# yet, or no longer, usable for post_to_connection).
_NON_REPLYING = {CONNECT_ROUTE, DISCONNECT_ROUTE}

ROUTES = {
    CONNECT_ROUTE: connect.handle,
    DISCONNECT_ROUTE: disconnect.handle,
    "createRoom": create_room.handle,
    "joinRoom": join_room.handle,
    "ready": ready.handle,
    "reconnect": reconnect.handle,
    "submitAnswer": submit_answer.handle,
    "nextRound": next_round.handle,
    "ping": ping.handle,
}


def route(event: dict, game: GameService) -> dict:
    """Dispatch one API Gateway WebSocket event; always returns a 200 response."""
    ctx = event["requestContext"]
    route_key = ctx["routeKey"]
    connection_id = ctx["connectionId"]

    handler = ROUTES.get(route_key)
    if handler is None:
        _reply_error(game, connection_id, None, ErrorCode.UNKNOWN_ACTION, f"Unknown action '{route_key}'.")
        return {"statusCode": 200}

    if route_key in _NON_REPLYING:
        request = Request(connection_id=connection_id, action=route_key, request_id=None, payload={})
    else:
        try:
            request = parse_request(connection_id, route_key, event.get("body"))
        except DomainError as exc:
            _reply_error(game, connection_id, None, exc.code, exc.message)
            return {"statusCode": 200}

    try:
        handler(request, game)
    except DomainError as exc:
        _reply_error(game, connection_id, request.request_id, exc.code, exc.message, route_key)
    except Exception:  # noqa: BLE001 — last line of defence; never leak internals
        log(logger, logging.ERROR, "unhandled error", action=route_key)
        logger.exception("unhandled error in handler")
        _reply_error(game, connection_id, request.request_id, ErrorCode.INTERNAL_ERROR, "An internal error occurred.", route_key)

    return {"statusCode": 200}


def _reply_error(game, connection_id, request_id, code, message, route_key=None) -> None:
    if route_key in _NON_REPLYING:
        return  # cannot post to a connecting/closed socket
    game.send(connection_id, error(request_id, code, message))
