"""Lambda entry point for every WebSocket route.

One function serves all routes. The expensive dependencies — the config and the
DynamoDB repository — are built once per container (cold start) and reused; the
notifier is per-invocation because its endpoint comes from the event.
"""

from __future__ import annotations

import logging

from config import Config
from logging_config import configure, get_logger, log
from repositories.dynamodb_repository import DynamoDbRepository
from router import route
from services.game_service import GameService
from services.websocket_service import ApiGatewayNotifier, endpoint_from_event

configure()
logger = get_logger(__name__)

_CONFIG = Config.from_env()
_REPO = DynamoDbRepository(_CONFIG.table_name, _CONFIG.room_ttl_seconds)


def handler(event: dict, context: object) -> dict:
    """Route a single API Gateway WebSocket event."""
    ctx = event.get("requestContext", {})
    log(
        logger,
        logging.INFO,
        "request",
        action=ctx.get("routeKey"),
        connectionId=ctx.get("connectionId"),
    )
    notifier = ApiGatewayNotifier(endpoint_from_event(event))
    game = GameService(_REPO, notifier, _CONFIG)
    return route(event, game)
