import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./zbirka.db")
# Render gives "postgres://..."; SQLAlchemy + psycopg 3 wants "postgresql+psycopg://..."
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-change-me")
JWT_TTL_HOURS = int(os.getenv("JWT_TTL_HOURS", "168"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
