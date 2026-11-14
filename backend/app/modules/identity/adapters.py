import jwt

from .ports import InvalidToken, Principal

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
