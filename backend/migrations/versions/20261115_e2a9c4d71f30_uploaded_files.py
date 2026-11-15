"""Uploaded files (PDF, DOCX, PPTX, TXT/MD, images) stored next to their items

Revision ID: e2a9c4d71f30
Revises: c3e8f1a27d64
Create Date: 2026-11-15 18:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e2a9c4d71f30'
down_revision: Union[str, None] = 'c3e8f1a27d64'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'files',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('items.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('filename', sa.Text(), nullable=False),
        sa.Column('content_type', sa.String(120), nullable=False),
        sa.Column('size', sa.Integer(), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index('ix_files_owner_id', 'files', ['owner_id'])


def downgrade() -> None:
    op.drop_index('ix_files_owner_id', table_name='files')
    op.drop_table('files')
