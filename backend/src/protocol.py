"""The WebSocket wire protocol: parsing requests and shaping responses.

Every inbound frame is ``{"action", "requestId", "payload"}``; every outbound
frame is ``{"type", "requestId", "payload"}`` or an ``error`` frame with a
stable ``{code, message}``. Nothing else here knows about API Gateway — it
works on plain dicts so it can be tested in isolation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from domain.errors import DomainError, ErrorCode


@dataclass(frozen=True)
class Request:
    """A parsed inbound message, independent of the API Gateway event shape."""

    connection_id: str
    action: str
    request_id: str | None
    payload: dict[str, Any]


def parse_request(connection_id: str, route_key: str, body: str | None) -> Request:
    """Parse and validate an inbound message body into a :class:`Request`.

    ``route_key`` is authoritative for the action (API Gateway selects the
    route from ``$request.body.action``); the body is validated to be a JSON
    object and its ``requestId``/``payload`` extracted.
    """
    data: dict[str, Any] = {}
    if body:
        try:
            data = json.loads(body)
        except (json.JSONDecodeError, TypeError) as exc:
            raise DomainError(ErrorCode.BAD_REQUEST, "Message body is not valid JSON.") from exc
    if not isinstance(data, dict):
        raise DomainError(ErrorCode.BAD_REQUEST, "Message body must be a JSON object.")

    request_id = data.get("requestId")
    if request_id is not None and not isinstance(request_id, str):
        raise DomainError(ErrorCode.BAD_REQUEST, "requestId must be a string.")

    payload = data.get("payload", {})
    if payload is None:
        payload = {}
    if not isinstance(payload, dict):
        raise DomainError(ErrorCode.BAD_REQUEST, "payload must be an object.")

    return Request(
        connection_id=connection_id,
        action=route_key,
        request_id=request_id,
        payload=payload,
    )


def response(type_: str, request_id: str | None, payload: dict[str, Any]) -> dict[str, Any]:
    """Build a success frame."""
    return {"type": type_, "requestId": request_id, "payload": payload}


def error(request_id: str | None, code: str, message: str) -> dict[str, Any]:
    """Build an error frame with the stable machine-readable structure."""
    return {
        "type": "error",
        "requestId": request_id,
        "error": {"code": code, "message": message},
    }


def require_str(payload: dict[str, Any], key: str, *, max_length: int = 256) -> str:
    """Extract a required, length-bounded string field or raise VALIDATION_ERROR."""
    value = payload.get(key)
    if not isinstance(value, str) or not value.strip():
        raise DomainError(ErrorCode.VALIDATION_ERROR, f"'{key}' is required.")
    if len(value) > max_length:
        raise DomainError(ErrorCode.VALIDATION_ERROR, f"'{key}' is too long.")
    return value.strip()


def require_int(payload: dict[str, Any], key: str) -> int:
    """Extract a required integer field or raise VALIDATION_ERROR."""
    value = payload.get(key)
    if isinstance(value, bool) or not isinstance(value, int):
        raise DomainError(ErrorCode.VALIDATION_ERROR, f"'{key}' must be an integer.")
    return value
