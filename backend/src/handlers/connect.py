"""``$connect`` — a new WebSocket connection is established."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.connect(request.connection_id)
