"""Safe validation of a submitted Countdown expression.

The server never trusts a client's claimed result, and never runs ``eval`` on
client input. Instead it tokenises the expression, rejects anything that is not
a number, a permitted operator, or a parenthesis, converts to Reverse Polish
Notation with the shunting-yard algorithm, and evaluates that under the
Countdown rules:

- only whole numbers appear;
- every intermediate result is a positive integer;
- division must be exact;
- each supplied tile is used at most as many times as it was dealt.

Because the grammar only admits digits and the four operators, there is no way
for a submission to reference a name, call a function, or otherwise execute
arbitrary code — the tokeniser refuses the character before it reaches any
evaluator.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Optional

from .errors import ErrorCode

# The frontend renders operators as −, ×, ÷; accept both those and the plain
# ASCII forms a client is likely to send on the wire. Normalise to ASCII.
_OPERATOR_ALIASES = {
    "−": "-",  # U+2212 MINUS SIGN
    "×": "*",  # U+00D7 MULTIPLICATION SIGN
    "÷": "/",  # U+00F7 DIVISION SIGN
    "x": "*",  # a common typed stand-in for ×
    "X": "*",
}
_OPERATORS = {"+", "-", "*", "/"}
_PRECEDENCE = {"+": 1, "-": 1, "*": 2, "/": 2}


@dataclass
class ValidationResult:
    """Outcome of validating one submitted expression."""

    valid: bool
    value: Optional[int] = None
    operations: int = 0
    numbers_used: list[int] = field(default_factory=list)
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    @classmethod
    def failure(cls, code: str, message: str) -> "ValidationResult":
        return cls(valid=False, error_code=code, error_message=message)


def validate_expression(expression: str, available: list[int]) -> ValidationResult:
    """Validate ``expression`` against the tiles in ``available``.

    On success the returned result carries the *computed* value (never the
    client's claim), the number of operations performed, and the tiles used.
    """
    if not isinstance(expression, str) or not expression.strip():
        return ValidationResult.failure(
            ErrorCode.INVALID_EXPRESSION, "Expression must be a non-empty string."
        )

    try:
        tokens = _tokenise(expression)
        rpn = _to_rpn(tokens)
        value, operations, used = _evaluate_rpn(rpn)
    except _ExpressionError as exc:
        return ValidationResult.failure(exc.code, exc.message)

    available_counts = Counter(available)
    used_counts = Counter(used)
    for number, count in used_counts.items():
        if count > available_counts.get(number, 0):
            return ValidationResult.failure(
                ErrorCode.NUMBER_NOT_AVAILABLE,
                f"Number {number} is used {count} time(s) but only "
                f"{available_counts.get(number, 0)} available.",
            )

    return ValidationResult(
        valid=True, value=value, operations=operations, numbers_used=used
    )


# ── Internals ──────────────────────────────────────────────────────────────


class _ExpressionError(Exception):
    """Raised while parsing or evaluating; carries a client-facing code."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _tokenise(expression: str) -> list[str]:
    """Split into number, operator and parenthesis tokens; reject anything else."""
    tokens: list[str] = []
    i = 0
    n = len(expression)
    while i < n:
        ch = expression[i]
        if ch.isspace():
            i += 1
            continue
        if ch.isdigit():
            j = i
            while j < n and expression[j].isdigit():
                j += 1
            tokens.append(expression[i:j])
            i = j
            continue
        normalised = _OPERATOR_ALIASES.get(ch, ch)
        if normalised in _OPERATORS or normalised in "()":
            tokens.append(normalised)
            i += 1
            continue
        raise _ExpressionError(
            ErrorCode.INVALID_OPERATOR,
            f"Unexpected character {ch!r} in expression.",
        )
    if not tokens:
        raise _ExpressionError(
            ErrorCode.INVALID_EXPRESSION, "Expression contained no tokens."
        )
    return tokens


def _to_rpn(tokens: list[str]) -> list[str]:
    """Shunting-yard: infix tokens to Reverse Polish Notation."""
    output: list[str] = []
    stack: list[str] = []
    prev: Optional[str] = None
    for token in tokens:
        if token.isdigit():
            if prev is not None and (prev.isdigit() or prev == ")"):
                raise _ExpressionError(
                    ErrorCode.INVALID_EXPRESSION, "Two values with no operator between them."
                )
            output.append(token)
        elif token in _OPERATORS:
            if prev is None or prev in _OPERATORS or prev == "(":
                raise _ExpressionError(
                    ErrorCode.INVALID_EXPRESSION, "Operator without a left-hand value."
                )
            while stack and stack[-1] in _OPERATORS and _PRECEDENCE[stack[-1]] >= _PRECEDENCE[token]:
                output.append(stack.pop())
            stack.append(token)
        elif token == "(":
            stack.append(token)
        elif token == ")":
            while stack and stack[-1] != "(":
                output.append(stack.pop())
            if not stack:
                raise _ExpressionError(
                    ErrorCode.INVALID_EXPRESSION, "Unbalanced parentheses."
                )
            stack.pop()  # discard the "("
        prev = token
    if prev in _OPERATORS or prev == "(":
        raise _ExpressionError(ErrorCode.INVALID_EXPRESSION, "Expression ends unexpectedly.")
    while stack:
        top = stack.pop()
        if top == "(":
            raise _ExpressionError(ErrorCode.INVALID_EXPRESSION, "Unbalanced parentheses.")
        output.append(top)
    return output


def _evaluate_rpn(rpn: list[str]) -> tuple[int, int, list[int]]:
    """Evaluate RPN under Countdown rules; return (value, operations, tiles used)."""
    stack: list[int] = []
    operations = 0
    used: list[int] = []
    for token in rpn:
        if token.isdigit():
            number = int(token)
            stack.append(number)
            used.append(number)
            continue
        if len(stack) < 2:
            raise _ExpressionError(ErrorCode.INVALID_EXPRESSION, "Malformed expression.")
        b = stack.pop()
        a = stack.pop()
        result = _apply(token, a, b)
        stack.append(result)
        operations += 1
    if len(stack) != 1:
        raise _ExpressionError(ErrorCode.INVALID_EXPRESSION, "Malformed expression.")
    return stack[0], operations, used


def _apply(op: str, a: int, b: int) -> int:
    """Apply one operation, enforcing the two rules that make it Countdown."""
    if op == "+":
        return a + b
    if op == "-":
        result = a - b
        if result <= 0:
            raise _ExpressionError(
                ErrorCode.ILLEGAL_INTERMEDIATE,
                "Subtraction must leave a positive result.",
            )
        return result
    if op == "*":
        return a * b
    if op == "/":
        if b == 0 or a % b != 0:
            raise _ExpressionError(
                ErrorCode.ILLEGAL_INTERMEDIATE, "Division must be exact."
            )
        return a // b
    raise _ExpressionError(ErrorCode.INVALID_OPERATOR, f"Unknown operator {op!r}.")
