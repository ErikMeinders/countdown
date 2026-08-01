from domain.ids import ROOM_CODE_ALPHABET, generate_room_code


def test_room_code_has_default_length():
    assert len(generate_room_code()) == 4


def test_room_code_respects_length():
    assert len(generate_room_code(6)) == 6


def test_room_code_is_uppercase_and_unambiguous():
    for _ in range(200):
        code = generate_room_code()
        assert code == code.upper()
        assert all(ch in ROOM_CODE_ALPHABET for ch in code)
        # The whole point of the alphabet: no look-alikes.
        assert not any(ch in code for ch in "O0I1")


def test_room_codes_vary():
    codes = {generate_room_code() for _ in range(200)}
    assert len(codes) > 1
