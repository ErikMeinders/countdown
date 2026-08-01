# Countdown — Multiplayer Backend

A small serverless backend for impromptu multiplayer [Countdown](../README.md)
numbers games: two players share a room code, get the **same** server-generated
round, race the clock, and the server validates and scores every answer. Best of
five.

This is the first version — deliberately minimal, but coherent end to end.

## Architecture

```
        wss://…/dev                    ┌───────────────────────────┐
 phone ───────────────►  API Gateway   │  Lambda (python3.13)      │
 phone ───────────────►  WebSocket API │  app.handler → router →   │
                              │         │  handlers → GameService   │
                              └────────►│  → domain / repositories  │
                                        └───────────┬───────────────┘
                                                    │
                                          DynamoDB single table
                                          (+ ConnectionIndex GSI, TTL)
```

- **API Gateway WebSocket API** — one connection per player, routes selected
  from `$request.body.action`.
- **One Lambda** for every route (`app.handler`), with internal routing in
  `router.py`. Handlers are thin; all game logic lives in `services/` and
  `domain/`, which are pure and unit-tested without AWS.
- **DynamoDB** single table for rooms, players, rounds, submissions and
  connections, with a `ConnectionIndex` GSI and TTL-based expiry.
- **CloudWatch Logs** — structured JSON, retained for a limited period.
- **IAM** — a least-privilege role scoped to this table, its one index, and this
  API's connections.

The client animation never determines the result: the server generates and
persists the numbers and target, then broadcasts them with server timestamps.

### Layout

```
backend/
├── template.yaml         CloudFormation — all resources
├── Makefile              build / validate / deploy / outputs / delete / test
├── requirements.txt      runtime deps (none; boto3 is in the runtime)
├── requirements-dev.txt  pytest
├── src/
│   ├── app.py            Lambda entry point (builds deps, delegates to router)
│   ├── router.py         route key → handler; turns DomainError into error frames
│   ├── protocol.py       request parsing + response/error frame shaping
│   ├── config.py         env-driven configuration
│   ├── logging_config.py structured JSON logging
│   ├── handlers/         one thin module per WebSocket route
│   ├── domain/           pure game logic: rooms, rounds, scoring, validation, puzzle
│   ├── repositories/     Repository interface + DynamoDB single-table implementation
│   └── services/         GameService (orchestration) + WebSocket notifier
└── tests/                unit tests (no AWS access)
```

## Resources

| Resource | Type | Notes |
|---|---|---|
| `Table` | `AWS::DynamoDB::Table` | Single table, `PAY_PER_REQUEST`, SSE, PITR, TTL on `ttl` |
| `ConnectionIndex` | GSI on `Table` | `GSI1PK`/`GSI1SK` — resolve a connection ID at `$disconnect` |
| `Function` | `AWS::Lambda::Function` | `python3.13`, `app.handler`, all routes |
| `FunctionRole` | `AWS::IAM::Role` | Least-privilege: logs, this table + index, this API |
| `FunctionLogGroup` | `AWS::Logs::LogGroup` | Retention set by `LogRetentionDays` |
| `WebSocketApi` | `AWS::ApiGatewayV2::Api` | `RouteSelectionExpression: $request.body.action` |
| `Integration` | `AWS::ApiGatewayV2::Integration` | One `AWS_PROXY` integration for every route |
| `*Route` | `AWS::ApiGatewayV2::Route` | `$connect`, `$disconnect`, `$default`, and each action |
| `Stage` | `AWS::ApiGatewayV2::Stage` | Named after `Environment`, `AutoDeploy` |
| `InvokePermission` | `AWS::Lambda::Permission` | Lets API Gateway invoke the function |

## WebSocket routes

| Route | Direction | Purpose |
|---|---|---|
| `$connect` | in | Connection established (acknowledged; nothing persisted yet) |
| `$disconnect` | in | Mark the player's connection inactive; keep the player |
| `createRoom` | in | Open a room, become host |
| `joinRoom` | in | Join by room code |
| `ready` | in | Mark ready; the round starts when all active players are ready |
| `submitAnswer` | in | Submit an expression; server validates and scores |
| `nextRound` | in | Advance a finished round to the next lobby |
| `ping` | in | Keepalive → `pong` |

### Request / response format

Every inbound frame:

```json
{ "action": "createRoom", "requestId": "client-generated-id", "payload": {} }
```

Every outbound success frame:

```json
{ "type": "roomCreated", "requestId": "client-generated-id", "payload": {} }
```

Every error frame (stable, machine-readable):

```json
{
  "type": "error",
  "requestId": "client-generated-id",
  "error": { "code": "ROOM_NOT_FOUND", "message": "The requested room does not exist." }
}
```

`requestId` is echoed back so a client can correlate a reply with its request
and safely ignore duplicates from a retry.

### Examples

**Create a room**

```json
{ "action": "createRoom", "requestId": "c1", "payload": { "displayName": "Alice" } }
```
→
```json
{
  "type": "roomCreated",
  "requestId": "c1",
  "payload": {
    "playerId": "p_…",
    "match": { "bestOf": 5, "winsNeeded": 3, "capacity": 2, "roundSeconds": 45 },
    "room": { "code": "GK7P", "status": "WAITING", "players": [ … ], "scores": { … } }
  }
}
```

**Join**

```json
{ "action": "joinRoom", "requestId": "c2", "payload": { "roomCode": "GK7P", "displayName": "Bob" } }
```
→ `roomJoined` to the joiner; `playerJoined` broadcast to everyone else.

**Ready → round starts** (broadcast to both players, identical):

```json
{
  "type": "roundStarted",
  "payload": {
    "roomCode": "GK7P", "roundNumber": 1,
    "numbers": [75, 50, 2, 3, 8, 7], "target": 812,
    "startsAt": 1690000003000, "endsAt": 1690000048000, "revealAt": 1690000051000,
    "status": "ACTIVE"
  }
}
```

**Submit an answer** — the server computes the value; `claimedResult` is ignored:

```json
{
  "action": "submitAnswer", "requestId": "c3",
  "payload": {
    "roomCode": "GK7P", "playerId": "p_…", "roundNumber": 1,
    "expression": "(75 + 50) * 7 - 63", "claimedResult": 812
  }
}
```
→ `answerAccepted` to the submitter (`{ accepted, best }`).

**Round result** (broadcast to both, identical — each client picks out its own
and the opponent's submission by `playerId`):

```json
{
  "type": "roundResult",
  "payload": {
    "roomCode": "GK7P", "roundNumber": 1, "target": 812, "numbers": [ … ],
    "status": "COMPLETE", "winnerId": "p_…", "isTie": false,
    "submissions": [ { "playerId": "p_…", "expression": "…", "value": 812,
                       "distance": 0, "operations": 3, "exact": true,
                       "submittedAt": 1690000030000 }, … ],
    "scores": { "p_alice": 1, "p_bob": 0 },
    "matchComplete": false, "matchWinnerId": null
  }
}
```

A future solver-generated `algorithmSolution` can be added to this payload
without changing anything above it.

### Error codes

`BAD_REQUEST`, `UNKNOWN_ACTION`, `VALIDATION_ERROR`, `ROOM_NOT_FOUND`,
`ROOM_FULL`, `ROOM_EXPIRED`, `ROOM_COMPLETED`, `NOT_A_MEMBER`,
`PLAYER_NOT_FOUND`, `NAME_TAKEN`, `ROUND_NOT_FOUND`, `ROUND_NOT_ACTIVE`,
`ROUND_CLOSED`, `NOT_READY`, `MATCH_COMPLETE`, `INVALID_EXPRESSION`,
`NUMBER_NOT_AVAILABLE`, `INVALID_OPERATOR`, `ILLEGAL_INTERMEDIATE`,
`INTERNAL_ERROR`.

## DynamoDB key design

One table. Every item for a match lives in the room's partition, so loading
everything for a match is a single `Query` on `PK = ROOM#<code>`. Looking up a
room by code is a `GetItem`. The one thing that isn't a primary-key lookup —
resolving a bare connection ID on `$disconnect` — is served by the
`ConnectionIndex` GSI.

| Entity | PK | SK | Notes |
|---|---|---|---|
| Room (aggregate) | `ROOM#<code>` | `META` | status, capacity, `bestOf`, `currentRound`, `scores`, the player roster |
| Round | `ROOM#<code>` | `ROUND#<nnnn>` | numbers, target, times, status, winner |
| Submission | `ROOM#<code>` | `ROUND#<nnnn>#SUB#<playerId>` | one best answer per player per round |
| Connection | `ROOM#<code>` | `CONN#<connectionId>` | also `GSI1PK = CONN#<connectionId>` |

**`ConnectionIndex` (GSI1):** `GSI1PK = CONN#<connectionId>`. Only live
connection items project it, so a `$disconnect` (which knows only the connection
ID) finds its room and player with a single indexed query — no table scan.

**TTL:** every item carries a `ttl` attribute (epoch seconds). When a room's
lifetime elapses, DynamoDB reaps the whole partition — rooms, rounds,
submissions and connection records alike.

**Race-safe writes.** The moments where two requests could collide are handled
with conditional writes or transactions:

- *joining the last slot* — a conditional `UpdateItem` gated on
  `size(players) < capacity` and the room still `WAITING`;
- *starting a round* — a `TransactWriteItems` that creates the round only if it
  is absent and flips the room into it, so only one request starts it (and
  therefore only one broadcasts it);
- *recording the first result* — a transaction gated on the round still being
  `ACTIVE`, with optimistic concurrency on the winner's score.

## Deploy

You need an active `AWS_PROFILE` exported and Python 3.13+ locally.

```bash
cd backend
export AWS_PROFILE=my-profile

make validate        # validate the template
make deploy          # package the Lambda, upload it, deploy the stack
```

Override the defaults (`countdown-backend`, `dev`, `eu-west-1`) as needed:

```bash
make deploy STACK_NAME=countdown-backend ENVIRONMENT=dev AWS_REGION=eu-west-1
```

Tune template parameters through `PARAM_OVERRIDES`:

```bash
make deploy PARAM_OVERRIDES="RoomTtlSeconds=3600 LogLevel=DEBUG LogRetentionDays=30"
```

`make deploy` creates a private artifact bucket
(`countdown-backend-artifacts-<account-id>-<region>`) on first run and uploads
the Lambda ZIP there; the account ID is resolved at run time, never hard-coded.

### Retrieve the WebSocket URL

```bash
make outputs                       # all outputs, as a table
make -s websocket-url              # only the URL, e.g. wss://abc123.execute-api.eu-west-1.amazonaws.com/dev
```

`make -s websocket-url` prints nothing but the URL, so it captures cleanly:

```bash
export COUNTDOWN_WEBSOCKET_URL="$(make -s websocket-url)"
```

## Configuring the frontend

The frontend is a [Vite](../vite.config.js) app, so it reads build-time
environment variables prefixed with `VITE_`. Deploy the backend, capture the
URL, and put it in an env file:

```bash
cd backend
export AWS_PROFILE=my-profile
make deploy
export COUNTDOWN_WEBSOCKET_URL="$(make -s websocket-url)"
```

Then, from the repo root, create `.env.local` (git-ignored) for Vite:

```dotenv
VITE_COUNTDOWN_WEBSOCKET_URL=wss://abc123.execute-api.eu-west-1.amazonaws.com/dev
```

or write it straight from the captured value:

```bash
echo "VITE_COUNTDOWN_WEBSOCKET_URL=$COUNTDOWN_WEBSOCKET_URL" > .env.local
```

In frontend code it is then available as
`import.meta.env.VITE_COUNTDOWN_WEBSOCKET_URL`. (No frontend code depends on it
yet — this is the first backend cut.)

## Logs

Structured JSON, one object per line, in the Lambda's log group:

```bash
aws logs tail /aws/lambda/countdown-ws-dev --follow
```

Reconnect tokens, raw untrusted payloads, and submitted expressions are
deliberately never logged.

## Delete

```bash
cd backend
export AWS_PROFILE=my-profile
make delete          # prints the stack and region, then deletes and waits
```

The artifact bucket is not deleted by `make delete`; remove it by hand if you
want it gone (`aws s3 rb s3://countdown-backend-artifacts-<account>-<region> --force`).

## Testing

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
make test
```

The tests cover room-code generation, expression validation (including reuse of
unavailable numbers, illegal operators, and rejection of arbitrary code with no
`eval`), the scoring order and its tie-breakers, and a full best-of-five match
driven through the `GameService` against in-memory doubles. None of them touch
AWS.

## Known limitations & next steps

- **Deadline finalisation is lazy.** With no scheduler, a round whose clock
  expires before both players submit is finalised on the next interaction
  (`nextRound`, a late `submitAnswer`, …). A natural next step is a per-round
  EventBridge Scheduler callback that finalises exactly at `endsAt`.
- **No reconnect flow yet.** `$disconnect` marks the player inactive and keeps
  them (and the room) until TTL, and the data model carries a per-connection
  index, so a `reconnect` action keyed on player ID / a reconnect token can be
  added without a schema change.
- **Two players.** `capacity` is a first-class field and the roster is a map, so
  raising it is a config change plus a readiness/scoring review, not a rewrite.
- **Ties score nobody.** An exact tie awards no round win; a match of nothing but
  ties could in principle run past five rounds. Revisit alongside proper
  Countdown tie rules.
- **Puzzle generation is a stand-in.** `domain/puzzle.py` is a faithful port of
  the frontend's `src/game/rules.js`; unify the two behind one algorithm when
  the solo and multiplayer games are reconciled.
- **Answer format.** Submissions are infix expression strings; the frontend
  currently builds answers as discrete steps. Agreeing one representation is a
  small piece of frontend/backend contract work.
