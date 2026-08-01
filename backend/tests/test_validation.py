from domain.errors import ErrorCode
from domain.validation import validate_expression


def test_valid_expression_computes_value_and_operations():
    result = validate_expression("100 + 25", [100, 25, 3, 7, 50, 9])
    assert result.valid
    assert result.value == 125
    assert result.operations == 1


def test_precedence_and_parentheses():
    result = validate_expression("(100 + 25) * 7", [100, 25, 7, 3, 50, 9])
    assert result.valid
    assert result.value == 875
    assert result.operations == 2


def test_server_computes_value_not_the_client_claim():
    # The function never sees a claim; it derives 175 from the expression itself.
    result = validate_expression("25 * 7", [25, 7, 1, 2, 3, 4])
    assert result.value == 175


def test_reusing_a_number_more_than_dealt_is_rejected():
    result = validate_expression("3 * 3", [3, 7, 10, 25, 50, 100])
    assert not result.valid
    assert result.error_code == ErrorCode.NUMBER_NOT_AVAILABLE


def test_number_not_in_the_puzzle_is_rejected():
    result = validate_expression("8 + 1", [3, 7, 10, 25, 50, 100])
    assert not result.valid
    assert result.error_code == ErrorCode.NUMBER_NOT_AVAILABLE


def test_using_a_number_up_to_its_multiplicity_is_allowed():
    result = validate_expression("3 + 3", [3, 3, 10, 25, 50, 100])
    assert result.valid
    assert result.value == 6


def test_invalid_operator_is_rejected():
    result = validate_expression("3 ^ 2", [3, 2, 10, 25, 50, 100])
    assert not result.valid
    assert result.error_code == ErrorCode.INVALID_OPERATOR


def test_arbitrary_code_is_rejected_without_eval():
    for hostile in ["__import__('os')", "2; import os", "print(1)", "1 or 2"]:
        result = validate_expression(hostile, [1, 2, 3, 4, 5, 6])
        assert not result.valid


def test_non_exact_division_is_illegal():
    result = validate_expression("10 / 3", [10, 3, 1, 2, 4, 5])
    assert not result.valid
    assert result.error_code == ErrorCode.ILLEGAL_INTERMEDIATE


def test_negative_intermediate_is_illegal():
    result = validate_expression("3 - 10", [3, 10, 1, 2, 4, 5])
    assert not result.valid
    assert result.error_code == ErrorCode.ILLEGAL_INTERMEDIATE


def test_exact_division_is_allowed():
    result = validate_expression("100 / 25", [100, 25, 1, 2, 4, 5])
    assert result.valid
    assert result.value == 4


def test_empty_expression_is_rejected():
    assert not validate_expression("   ", [1, 2, 3]).valid
