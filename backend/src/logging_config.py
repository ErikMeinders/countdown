"""Structured JSON logging for CloudWatch.

One line per event, machine-parseable, and deliberately austere about what it
records: connection IDs and actions, yes; reconnect tokens, raw untrusted
payloads, or submitted expressions, no.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        # Structured fields are attached via `extra={"context": {...}}`.
        context = getattr(record, "context", None)
        if isinstance(context, dict):
            payload.update(context)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


_CONFIGURED = False


def configure() -> None:
    """Install the JSON formatter on the root logger exactly once."""
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = os.environ.get("LOG_LEVEL", "INFO").upper()
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    configure()
    return logging.getLogger(name)


def log(logger: logging.Logger, level: int, message: str, **context: Any) -> None:
    """Emit a structured record: ``log(logger, logging.INFO, "joined", code=code)``."""
    logger.log(level, message, extra={"context": context})
