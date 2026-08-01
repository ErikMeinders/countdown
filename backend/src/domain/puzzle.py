"""Server-side Countdown puzzle generation.

This is deliberately a thin, replaceable seam. The frontend's number-and-target
logic lives in ``src/game/rules.js``; this is a faithful Python port so that a
multiplayer round looks and plays like a solo one. When the two are unified,
only this module changes — nothing that persists or transmits a round depends
on *how* the numbers were chosen.

Randomness here is for game variety, not security, so the standard ``random``
module is appropriate.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

LARGE_NUMBERS = [25, 50, 75, 100]
SMALL_NUMBERS = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10]
OPERATORS = ("+", "-", "*", "/")
TILE_COUNT = 6


@dataclass(frozen=True)
class Puzzle:
    """The numbers and target for one round."""

    numbers: list[int]
    target: int


def _evaluate(a: int, op: str, b: int):
    if op == "+":
        return a + b
    if op == "-":
        return a - b
    if op == "*":
        return a * b
    if op == "/":
        return a // b if b != 0 and a % b == 0 else None
    return None


def generate_numbers(num_large: int) -> list[int]:
    """Draw six tiles: ``num_large`` large ones and the rest small."""
    if not 0 <= num_large <= 4:
        raise ValueError("num_large must be between 0 and 4")
    large = random.sample(LARGE_NUMBERS, num_large)
    small = random.sample(SMALL_NUMBERS, TILE_COUNT - num_large)
    tiles = large + small
    random.shuffle(tiles)
    return tiles


def generate_target() -> int:
    """A bare random three-digit target, which may well be unreachable."""
    return random.randint(101, 999)


def generate_solvable_target(numbers: list[int]) -> int:
    """A target guaranteed reachable: fold the tiles together and harvest a hit.

    Anything produced this way can, by construction, be rebuilt by a player —
    which keeps a competitive round fair. Falls back to a bare target if the
    fold happens to find nothing in range.
    """
    candidates: list[int] = []
    for _ in range(60):
        pool = list(numbers)
        random.shuffle(pool)
        while len(pool) > 1:
            a, b = pool[0], pool[1]
            result = None
            for op in random.sample(OPERATORS, len(OPERATORS)):
                r = _evaluate(a, op, b)
                if r is not None and r > 0:
                    result = r
                    break
            if result is None:
                break
            if 101 <= result <= 999:
                candidates.append(result)
            pool = [result] + pool[2:]
            random.shuffle(pool)
    if not candidates:
        return generate_target()
    return random.choice(candidates)


def generate_puzzle(num_large: int | None = None) -> Puzzle:
    """Generate a full round: six tiles and a reachable target.

    ``num_large`` defaults to a random 0–4 draw so successive rounds vary the
    mix of large and small tiles.
    """
    if num_large is None:
        num_large = random.randint(0, 4)
    numbers = generate_numbers(num_large)
    target = generate_solvable_target(numbers)
    return Puzzle(numbers=numbers, target=target)
