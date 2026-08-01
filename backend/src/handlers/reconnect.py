"""``reconnect`` — rebind a returning player to a new connection."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.reconnect(request)
