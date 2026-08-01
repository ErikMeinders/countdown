"""``$disconnect`` — a connection dropped; mark it inactive, keep the player."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.disconnect(request.connection_id)
