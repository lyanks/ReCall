"""Clear AI digests so they are regenerated with the shorter, no-guessing prompt

Revision ID: c3e8f1a27d64
Revises: b7d2c9e41a05
Create Date: 2026-11-15 17:00:00

The app's start-up backfill re-digests every ready item whose keywords are empty.
"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3e8f1a27d64'
down_revision: Union[str, None] = 'b7d2c9e41a05'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE items SET summary = '', summary_en = '', key_topics = '[]', keywords = ''")


def downgrade() -> None:
    pass
