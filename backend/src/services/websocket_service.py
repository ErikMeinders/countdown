"""Sending frames back to clients over the API Gateway WebSocket connection.

The :class:`Notifier` interface is what the game service depends on, so tests
can substitute an in-memory double and assert on what would have been sent. The
concrete :class:`ApiGatewayNotifier` posts to connections and treats a stale
connection (``GoneException``) as a no-op rather than an error.
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from typing import Any

from logging_config import get_logger

logger = get_logger(__name__)


class Notifier(ABC):
    @abstractmethod
    def send(self, connection_id: str, message: dict[str, Any]) -> bool:
        """Deliver one frame to a connection. Returns False if it was gone."""


class ApiGatewayNotifier(Notifier):
    """Posts frames through the API Gateway Management API."""

    def __init__(self, endpoint_url: str) -> None:
        import boto3  # imported lazily so the interface needs no AWS SDK

        self._client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint_url)

    def send(self, connection_id: str, message: dict[str, Any]) -> bool:
        from botocore.exceptions import ClientError

        try:
            self._client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(message).encode("utf-8"),
            )
            return True
        except ClientError as exc:
            code = exc.response["Error"]["Code"]
            if code in ("GoneException", "ForbiddenException"):
                # The client vanished; the disconnect flow (or TTL) cleans up.
                logger.info("post_to_connection skipped: connection gone")
                return False
            raise


def endpoint_from_event(event: dict) -> str:
    """Build the management endpoint from an API Gateway WebSocket event."""
    ctx = event["requestContext"]
    return f"https://{ctx['domainName']}/{ctx['stage']}"
