"""Identifier generation: room codes, player IDs, match IDs.

Room codes are the one identifier a human reads aloud and types on a phone, so
they trade entropy for legibility. Everything else is a UUID.
"""

from __future__ import annotations

import secrets
import uuid

# No O/0, I/1, or similar look-alikes — the whole point is that a code read off
# one screen types cleanly into another.
ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
ROOM_CODE_LENGTH = 4


def generate_room_code(length: int = ROOM_CODE_LENGTH) -> str:
    """Return a short uppercase room code drawn from an unambiguous alphabet."""
    return "".join(secrets.choice(ROOM_CODE_ALPHABET) for _ in range(length))


def generate_player_id() -> str:
    """Return an opaque, unguessable player identifier."""
    return f"p_{uuid.uuid4().hex}"


def generate_match_id() -> str:
    """Return an opaque match identifier."""
    return f"m_{uuid.uuid4().hex}"
