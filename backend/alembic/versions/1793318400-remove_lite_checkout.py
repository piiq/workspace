"""Remove the Lite checkout event table.

Revision ID: b9c1e3f5a7d0
Revises: a8b0d2f4e6c9
Create Date: 2026-10-30
"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from alembic import op

revision = "b9c1e3f5a7d0"
down_revision = "a8b0d2f4e6c9"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("stripe_event")


def downgrade():
    op.create_table(
        "stripe_event",
        sa.Column("event_id", sa.String(255), nullable=False),
        sa.Column("type", sa.String(100), nullable=False),
        sa.Column("livemode", sa.Boolean(), nullable=False),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", sa.DateTime(), nullable=True),
        sa.Column("updated_date", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("event_id", name="uq_stripe_event_event_id"),
    )
