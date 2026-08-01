"""Domain-level errors and the stable machine-readable codes clients see.

Keeping the codes in one place means the wire protocol has a single source of
truth: handlers raise :class:`DomainError`, the router turns it into the
``{"type": "error", ...}`` frame, and the README documents the same list.
"""

from __future__ import annotations


class ErrorCode:
    """Stable, machine-readable error codes sent to clients.

    These are part of the public protocol — rename with care, the frontend
    switches on them.
    """

    BAD_REQUEST = "BAD_REQUEST"
    UNKNOWN_ACTION = "UNKNOWN_ACTION"
    VALIDATION_ERROR = "VALIDATION_ERROR"

    ROOM_NOT_FOUND = "ROOM_NOT_FOUND"
    ROOM_FULL = "ROOM_FULL"
    ROOM_EXPIRED = "ROOM_EXPIRED"
    ROOM_COMPLETED = "ROOM_COMPLETED"

    NOT_A_MEMBER = "NOT_A_MEMBER"
    PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND"
    NAME_TAKEN = "NAME_TAKEN"

    ROUND_NOT_FOUND = "ROUND_NOT_FOUND"
    ROUND_NOT_ACTIVE = "ROUND_NOT_ACTIVE"
    ROUND_CLOSED = "ROUND_CLOSED"
    NOT_READY = "NOT_READY"
    MATCH_COMPLETE = "MATCH_COMPLETE"

    INVALID_EXPRESSION = "INVALID_EXPRESSION"
    NUMBER_NOT_AVAILABLE = "NUMBER_NOT_AVAILABLE"
    INVALID_OPERATOR = "INVALID_OPERATOR"
    ILLEGAL_INTERMEDIATE = "ILLEGAL_INTERMEDIATE"

    INTERNAL_ERROR = "INTERNAL_ERROR"


class DomainError(Exception):
    """An expected, client-facing failure carrying a stable code and message.

    Anything that raises this is telling the caller "the request was understood
    but cannot be honoured" — as opposed to an unexpected exception, which the
    router reports as a generic ``INTERNAL_ERROR`` without leaking internals.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
