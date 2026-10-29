"""Remove commercial account tiers and trial state.

Revision ID: a8b0d2f4e6c9
Revises: f7a9c3d5e8b1
Create Date: 2026-10-28
"""

import sqlalchemy as sa

from alembic import op

revision = "a8b0d2f4e6c9"
down_revision = "f7a9c3d5e8b1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("entity", sa.Column("allow_custom_backends", sa.Boolean(), nullable=False, server_default=sa.true()))
    for table in ("entitlement", "entity_entitlement", "default_tier", "tier"):
        op.drop_table(table)
    # Native column removal preserves foreign keys to users and organizations.
    for column in (
        "pro_zero_to_hero",
        "welcome_screen",
        "pro_entitlements",
        "pro_trial_granted",
        "pro_trial_granted_date",
        "pro_trial_end",
        "pro_trial_extension",
        "pro_trial_renewals",
        "billing_active",
        "pro_inactivity_email_sent",
    ):
        op.drop_column("user", column)
    op.drop_column("permissions_entity_map", "entitlements")
    op.drop_column("entity", "seats")
    op.drop_column("entity", "expiration_date")
    op.rename_table("entitlement_usage", "user_usage")


def downgrade():
    raise NotImplementedError("Commercial account tiers and trial data cannot be restored")
