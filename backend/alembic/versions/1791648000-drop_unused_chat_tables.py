"""Drop unused chat tables and their stored data.

Revision ID: e6f8b2a4c7d9
Revises: d3e5a8c9b1f2
Create Date: 2026-10-10

"""

import sqlalchemy as sa
from sqlalchemy_utils import UUIDType

from alembic import op
from api.models import model_helpers

revision = "e6f8b2a4c7d9"
down_revision = "d3e5a8c9b1f2"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_table("copilot_chat_old")
    op.drop_table("copilot_chats")


def downgrade():
    # Downgrade restores the schema; deleted chat data cannot be recovered.
    op.create_table(
        "copilot_chat_old",
        sa.Column("user_uuid", UUIDType(), nullable=False),
        sa.Column("content", model_helpers.GzipJsonLongType(), nullable=True),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", model_helpers.AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_uuid"], ["user.uuid"], name=op.f("fk_copilot_chat_old_user_uuid_user")
        ),
        sa.PrimaryKeyConstraint("uuid"),
    )
    op.create_index("ix_copilot_chat_old_user_uuid", "copilot_chat_old", ["user_uuid"], unique=False)
    op.create_table(
        "copilot_chats",
        sa.Column("user_uuid", UUIDType(), nullable=False),
        sa.Column("chats", model_helpers.GzipJsonType(), nullable=True),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", model_helpers.AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_uuid"], ["user.uuid"], name=op.f("fk_copilot_chats_user_uuid_user")
        ),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("user_uuid"),
    )
