"""WebSocket route handlers.

Each module is intentionally thin: it names one route and forwards to the
matching :class:`~services.game_service.GameService` method. All game logic
lives in the service so the handlers stay trivial and uniform.
"""
