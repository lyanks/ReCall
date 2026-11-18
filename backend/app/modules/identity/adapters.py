import logging

import httpx
import jwt

from .ports import InvalidToken, Principal

log = logging.getLogger(__name__)
IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1/accounts"
FIREBASE_JWKS = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"


class FirebaseAuthVerifier:
    """Verifies Firebase ID tokens locally against Google's public keys (no service account needed)."""

    def __init__(self, project_id: str):
        if not project_id:
            raise RuntimeError("FIREBASE_PROJECT_ID must be set when AUTH_PROVIDER=firebase")
        self.project_id = project_id
        self._jwks = jwt.PyJWKClient(FIREBASE_JWKS, cache_keys=True)

    def verify(self, token: str) -> Principal:
        try:
            key = self._jwks.get_signing_key_from_jwt(token).key
            claims = jwt.decode(
                token, key, algorithms=["RS256"], audience=self.project_id,
                issuer=f"https://securetoken.google.com/{self.project_id}",
            )
        except jwt.PyJWTError as exc:
            raise InvalidToken(str(exc)) from exc
        return Principal(uid=claims["sub"], email=claims.get("email", ""), name=claims.get("name", ""))


class DevAuthVerifier:
    """Local development and tests only: the token is "dev:<email>"."""

    def verify(self, token: str) -> Principal:
        if not token.startswith("dev:") or "@" not in token:
            raise InvalidToken("expected dev:<email>")
        email = token[4:].strip().lower()
        return Principal(uid=f"dev|{email}", email=email, name=email.split("@")[0])


class FirebasePasswordAccounts:
    """Firebase Auth REST API with the public web API key: the same calls the browser SDK makes."""

    def __init__(self, api_key: str, timeout: float = 8.0):
        self.api_key = api_key
        self.timeout = timeout

    def _post(self, method: str, body: dict) -> httpx.Response:
        return httpx.post(f"{IDENTITY_TOOLKIT}:{method}", params={"key": self.api_key}, json=body, timeout=self.timeout)

    def check_password(self, email: str, password: str) -> bool:
        try:
            r = self._post("signInWithPassword", {"email": email, "password": password, "returnSecureToken": False})
        except httpx.HTTPError:
            log.warning("Firebase signInWithPassword unreachable")
            return False
        return r.status_code == 200

    def send_password_reset(self, email: str) -> None:
        try:
            r = self._post("sendOobCode", {"requestType": "PASSWORD_RESET", "email": email})
            if r.status_code != 200:
                log.info("password reset not sent: %s", r.text[:200])
        except httpx.HTTPError:
            log.warning("Firebase sendOobCode unreachable")


class DevPasswordAccounts:
    """Local development and tests: every password is right, reset emails are only recorded."""

    def __init__(self):
        self.resets: list[str] = []

    def check_password(self, email: str, password: str) -> bool:
        return True

    def send_password_reset(self, email: str) -> None:
        self.resets.append(email)
