"""All settings come from environment variables (12-factor)."""

import os
from pathlib import Path


def _db_url() -> str:
    url = os.getenv("DATABASE_URL", "sqlite:///./local.db")
    # Neon/Render give "postgres://" or "postgresql://"; SQLAlchemy + psycopg 3 wants "postgresql+psycopg://"
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _db_url()

# "firebase" in every deployed environment; "dev" only for local work and tests.
AUTH_PROVIDER = os.getenv("AUTH_PROVIDER", "firebase")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "recall-ucu-edu")
# Firebase *web* API key (public, also in frontend/.env.production). Used to check a password before revealing
# which email a login belongs to, and to send password-reset emails.
FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY", "AIzaSyCTtS61yO9FjVAvk8InxDyvgmEm6MnTSQc")
# Password accounts sign up with a login; Firebase stores it as "<login>@LOGIN_DOMAIN" (no mailbox behind it).
# Must match LOGIN_DOMAIN in frontend/src/auth.js.
LOGIN_DOMAIN = "users.recall-ucu-edu.firebaseapp.com"

# "thread" runs background jobs in-process; "inline" runs them immediately (tests).
TASK_QUEUE = os.getenv("TASK_QUEUE", "thread")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Built React app. When present, the API container also serves the frontend (one deploy).
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parents[2] / "frontend" / "dist"))

# Claude API for summaries and search by meaning. Without a key the app works as before (keyword search).
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
AI_MODEL = os.getenv("AI_MODEL", "claude-haiku-5-5")
