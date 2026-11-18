from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class Principal:
    uid: str
    email: str
    name: str = ""


class InvalidToken(Exception):
    pass


class AuthVerifier(Protocol):
    """Port: turns a bearer token from the frontend into a verified identity.
    We do not store passwords ourselves (course module 9: use an auth provider)."""

    def verify(self, token: str) -> Principal: ...


class PasswordAccounts(Protocol):
    """Port: the auth provider's email+password accounts, seen from the server (Firebase REST API)."""

    def check_password(self, email: str, password: str) -> bool: ...

