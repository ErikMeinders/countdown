"""``ping`` — a keepalive; the server replies with ``pong``."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.ping(request)
