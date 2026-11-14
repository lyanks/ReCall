import os
from pathlib import Path

DB = Path(__file__).parent / "test.db"
os.environ.update(DATABASE_URL=f"sqlite:///{DB}", AUTH_PROVIDER="dev", TASK_QUEUE="inline", STATIC_DIR="/nonexistent")
DB.unlink(missing_ok=True)

# Build the schema with the real migrations, so tests also check Alembic.
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402

command.upgrade(Config(str(Path(__file__).parents[1] / "alembic.ini")), "head")
