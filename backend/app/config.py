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

# "thread" runs background jobs in-process; "inline" runs them immediately (tests).
TASK_QUEUE = os.getenv("TASK_QUEUE", "thread")

CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]

# Built React app. When present, the API container also serves the frontend (one deploy).
STATIC_DIR = Path(os.getenv("STATIC_DIR", Path(__file__).resolve().parents[2] / "frontend" / "dist"))
