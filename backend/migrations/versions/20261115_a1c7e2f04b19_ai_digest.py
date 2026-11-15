"""AI digest columns on items: summary (uk/en), key topics, search keywords

Revision ID: a1c7e2f04b19
Revises: d9a3145c84b3
Create Date: 2026-11-15 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c7e2f04b19'
down_revision: Union[str, None] = 'd9a3145c84b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.add_column(sa.Column('summary', sa.Text(), nullable=False, server_default=''))
        batch.add_column(sa.Column('summary_en', sa.Text(), nullable=False, server_default=''))
        batch.add_column(sa.Column('key_topics', sa.JSON(), nullable=False, server_default='[]'))
        batch.add_column(sa.Column('keywords', sa.Text(), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('items') as batch:
        batch.drop_column('keywords')
        batch.drop_column('key_topics')
        batch.drop_column('summary_en')
        batch.drop_column('summary')
