"""Runtime configuration, read once from the environment.

The CloudFormation template injects these; defaults keep local imports and unit
tests working without any AWS environment set.
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    table_name: str
    environment: str
    room_ttl_seconds: int
    log_level: str
    round_duration_seconds: int
    reveal_delay_seconds: int

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            table_name=os.environ.get("TABLE_NAME", "countdown"),
            environment=os.environ.get("ENVIRONMENT", "dev"),
            room_ttl_seconds=int(os.environ.get("ROOM_TTL_SECONDS", str(24 * 60 * 60))),
            log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
            round_duration_seconds=int(os.environ.get("ROUND_DURATION_SECONDS", "45")),
            reveal_delay_seconds=int(os.environ.get("REVEAL_DELAY_SECONDS", "3")),
        )
