"""Login + password accounts: login and the email waiting for confirmation

Revision ID: f4b1d8e2a6c9
Revises: e2a9c4d71f30
Create Date: 2026-11-18 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4b1d8e2a6c9'
down_revision: Union[str, None] = 'e2a9c4d71f30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

LOGIN_DOMAIN = "users.recall-ucu-edu.firebaseapp.com"


def upgrade() -> None:
    op.add_column('users', sa.Column('login', sa.String(32), nullable=True))
    op.add_column('users', sa.Column('pending_email', sa.String(255), nullable=False, server_default=''))
    op.create_index('ix_users_login', 'users', ['login'], unique=True)
    # accounts created with a login before this migration
    op.execute(sa.text(
        "UPDATE users SET login = lower(substr(email, 1, length(email) - :n)) WHERE lower(email) LIKE :pat"
    ).bindparams(n=len(LOGIN_DOMAIN) + 1, pat=f"%@{LOGIN_DOMAIN}"))


def downgrade() -> None:
    op.drop_index('ix_users_login', table_name='users')
    op.drop_column('users', 'pending_email')
    op.drop_column('users', 'login')
