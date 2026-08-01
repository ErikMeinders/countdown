"""``submitAnswer`` — submit an expression; the server validates and scores it."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.submit_answer(request)
