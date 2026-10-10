"""Store qualified widget renderer IDs.

Revision ID: d3e5a8c9b1f2
Revises: 0d4a342f4c26
Create Date: 2026-10-10

"""

import sqlalchemy as sa

from alembic import op

revision = "d3e5a8c9b1f2"
down_revision = "0d4a342f4c26"
branch_labels = None
depends_on = None


def upgrade():
    is_mysql = op.get_bind().dialect.name == "mysql"
    if is_mysql:
        # MySQL uses the composite index for the user foreign key.
        op.create_index("ix_widget_metadata_user_uuid_migration", "widget_metadata", ["user_uuid"])
    with op.batch_alter_table("widget_metadata") as batch_op:
        batch_op.drop_index("ix_user_name_type")
        batch_op.alter_column(
            "widget_type",
            existing_type=sa.String(length=50),
            type_=sa.Text(),
            existing_nullable=False,
        )
        batch_op.create_index(
            "ix_user_name_type",
            ["user_uuid", "name", "widget_type"],
            unique=False,
            mysql_length={"widget_type": 50},
        )
    if is_mysql:
        op.drop_index("ix_widget_metadata_user_uuid_migration", table_name="widget_metadata")


def downgrade():
    is_mysql = op.get_bind().dialect.name == "mysql"
    if is_mysql:
        op.create_index("ix_widget_metadata_user_uuid_migration", "widget_metadata", ["user_uuid"])
    with op.batch_alter_table("widget_metadata") as batch_op:
        batch_op.drop_index("ix_user_name_type")
        batch_op.alter_column(
            "widget_type",
            existing_type=sa.Text(),
            type_=sa.String(length=50),
            existing_nullable=False,
        )
        batch_op.create_index(
            "ix_user_name_type",
            ["user_uuid", "name", "widget_type"],
            unique=False,
        )
    if is_mysql:
        op.drop_index("ix_widget_metadata_user_uuid_migration", table_name="widget_metadata")
