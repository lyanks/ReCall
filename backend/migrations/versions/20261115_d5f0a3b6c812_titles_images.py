"""Own titles, preview images, English key topics

Revision ID: d5f0a3b6c812
Revises: c3e8f1a27d64
Create Date: 2026-11-15 19:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5f0a3b6c812'
down_revision: Union[str, None] = 'c3e8f1a27d64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.add_column(sa.Column('custom_title', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch.add_column(sa.Column('image_url', sa.Text(), server_default='', nullable=False))
        batch.add_column(sa.Column('key_topics_en', sa.JSON(), server_default='[]', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.drop_column('key_topics_en')
        batch.drop_column('image_url')
        batch.drop_column('custom_title')
