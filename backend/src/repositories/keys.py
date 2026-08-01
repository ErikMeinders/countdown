"""Single-table key conventions in one place.

Every item lives in the room's partition (``ROOM#<code>``) except that the
connection item also projects a ``GSI1PK`` of ``CONN#<connectionId>`` so a bare
``$disconnect`` — which knows only the connection ID — can find its room and
player through the ``ConnectionIndex`` GSI without a table scan.
"""

from __future__ import annotations

GSI1_NAME = "ConnectionIndex"

_ROUND_WIDTH = 4  # zero-padded so ROUND#0002 sorts before ROUND#0010


def room_pk(code: str) -> str:
    return f"ROOM#{code}"


def meta_sk() -> str:
    return "META"


def round_sk(number: int) -> str:
    return f"ROUND#{number:0{_ROUND_WIDTH}d}"


def submission_sk(number: int, player_id: str) -> str:
    return f"ROUND#{number:0{_ROUND_WIDTH}d}#SUB#{player_id}"


def connection_sk(connection_id: str) -> str:
    return f"CONN#{connection_id}"


def connection_gsi_pk(connection_id: str) -> str:
    return f"CONN#{connection_id}"
