"""Remove packaged data bundles and widget selection.

Revision ID: f7a9c3d5e8b1
Revises: e6f8b2a4c7d9
Create Date: 2026-10-28

"""

import sqlalchemy as sa
from sqlalchemy_utils import ScalarListType, UUIDType

from alembic import op
from api.models import model_helpers

revision = "f7a9c3d5e8b1"
down_revision = "e6f8b2a4c7d9"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("entitlement", "entity_entitlement"):
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_constraint(f"fk_{table}_data_bundle_uuid_data_bundle", type_="foreignkey")
            batch_op.drop_column("data_bundle_uuid")
    with op.batch_alter_table("default_tier") as batch_op:
        batch_op.drop_column("data_bundle")
    op.drop_table("enabled_widget_bundles")
    op.drop_table("data_bundle")


def downgrade():
    # Downgrade restores the schema; deleted bundle selections cannot be recovered.
    op.create_table(
        "data_bundle",
        sa.Column("bundle_name", sa.String(length=50), nullable=False),
        sa.Column("except_widgets", model_helpers.JSONType(), nullable=False),
        sa.Column(
            "except_dashboard_templates",
            model_helpers.JSONType(),
            nullable=False,
        ),
        sa.Column(
            "except_team_collaboration",
            model_helpers.JSONType(),
            nullable=True,
        ),
        sa.Column("excel_add_in", sa.Boolean(), nullable=False),
        sa.Column("data_export", sa.Boolean(), nullable=False),
        sa.Column("providers", model_helpers.JSONType(), nullable=True),
        sa.Column("dashboards_at_launch", model_helpers.JSONType(), nullable=True),
        sa.Column("my_dashboards", model_helpers.JSONType(), nullable=True),
        sa.Column("invite_your_colleagues", sa.Boolean(), nullable=False),
        sa.Column("number_copilot_calls_day", sa.Integer(), nullable=True),
        sa.Column("total_file_upload_size_gb", sa.Integer(), nullable=True),
        sa.Column("allow_custom_backends", sa.Boolean(), nullable=True),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", model_helpers.AwareDateTime(), nullable=True),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("bundle_name"),
    )
    op.create_table(
        "enabled_widget_bundles",
        sa.Column("user_uuid", UUIDType(), nullable=False),
        sa.Column(
            "enabled_bundles",
            ScalarListType(),
            nullable=False,
        ),
        sa.Column(
            "disabled_widgets",
            ScalarListType(),
            nullable=True,
        ),
        sa.Column("uuid", UUIDType(), nullable=False),
        sa.Column("created_date", model_helpers.AwareDateTime(), nullable=True),
        sa.Column("updated_date", model_helpers.AwareDateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_uuid"],
            ["user.uuid"],
            name=op.f("fk_enabled_widget_bundles_user_uuid_user"),
        ),
        sa.PrimaryKeyConstraint("uuid"),
        sa.UniqueConstraint("user_uuid"),
    )
    with op.batch_alter_table("default_tier") as batch_op:
        batch_op.add_column(sa.Column("data_bundle", sa.Boolean(), nullable=True))
    for table in ("entitlement", "entity_entitlement"):
        with op.batch_alter_table(table) as batch_op:
            batch_op.add_column(sa.Column("data_bundle_uuid", UUIDType(), nullable=True))
            batch_op.create_foreign_key(
                f"fk_{table}_data_bundle_uuid_data_bundle",
                "data_bundle",
                ["data_bundle_uuid"],
                ["uuid"],
            )
