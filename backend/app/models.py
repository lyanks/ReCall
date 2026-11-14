"""Imports every module's tables so Alembic sees the whole schema."""

from .modules.analytics.models import Event  # noqa: F401
from .modules.identity.models import User  # noqa: F401
from .modules.library.models import Item  # noqa: F401
