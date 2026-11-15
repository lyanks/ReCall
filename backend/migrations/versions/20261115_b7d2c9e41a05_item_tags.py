"""User key phrases (tags) on items

Revision ID: b7d2c9e41a05
Revises: a1c7e2f04b19
Create Date: 2026-11-15 17:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7d2c9e41a05'
down_revision: Union[str, None] = 'a1c7e2f04b19'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.add_column(sa.Column('tags', sa.JSON(), server_default='[]', nullable=False))


def downgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.drop_column('tags')
