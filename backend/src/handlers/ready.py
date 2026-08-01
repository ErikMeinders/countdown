"""``ready`` — mark yourself ready; the round starts once everyone is."""

from __future__ import annotations

from protocol import Request
from services.game_service import GameService


def handle(request: Request, game: GameService) -> None:
    game.ready(request)
