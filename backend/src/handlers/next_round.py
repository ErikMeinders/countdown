"""``nextRound`` — advance a completed round into the next lobby."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.next_round(request)
