from dataclasses import dataclass
from typing import Protocol


@dataclass
class FileBlob:
    filename: str
    content_type: str
    data: bytes


class FileStore(Protocol):
    """Port: where uploaded bytes live. PostgresFileStore now; an S3-compatible store (Cloudflare R2,
    Supabase Storage) when files get bigger or Neon's 0.5 GB fills up. Callers do not change."""

    def load(self, item_id: int) -> FileBlob | None: ...
