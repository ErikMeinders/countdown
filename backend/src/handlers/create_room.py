"""``createRoom`` — open a new best-of-five room and become its host."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.create_room(request)
