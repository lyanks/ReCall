from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from .models import StoredFile
from .ports import FileBlob


class PostgresFileStore:
    def __init__(self, session_factory: sessionmaker):
        self.session_factory = session_factory

    def load(self, item_id: int) -> FileBlob | None:
        with self.session_factory() as db:
            f = db.scalar(select(StoredFile).where(StoredFile.item_id == item_id))
            return FileBlob(f.filename, f.content_type, f.data) if f else None
