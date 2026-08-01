"""``joinRoom`` — join an existing room by its short code."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.join_room(request)
