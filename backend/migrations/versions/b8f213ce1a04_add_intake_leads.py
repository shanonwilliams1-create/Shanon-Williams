"""add_intake_leads

Revision ID: b8f213ce1a04
Revises: adccd1bb0637
Create Date: 2026-06-30 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b8f213ce1a04"
down_revision: Union[str, Sequence[str], None] = "adccd1bb0637"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "intake_leads",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("session_id", sa.String(), nullable=False, unique=True),
        sa.Column("intake_source", sa.String(), nullable=False, server_default="chat"),
        sa.Column("chat_state", sa.String(), nullable=False, server_default="greeting"),
        sa.Column("client_name", sa.String(), nullable=True),
        sa.Column("client_phone", sa.String(), nullable=True),
        sa.Column("client_email", sa.String(), nullable=True),
        sa.Column("case_type", sa.String(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("urgency_note", sa.Text(), nullable=True),
        sa.Column("urgency_indicators", sa.JSON(), nullable=True),
        sa.Column("lead_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("is_hot", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("attorney_notified", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("notified_at", sa.DateTime(), nullable=True),
        sa.Column("chat_history", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="chatting"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_intake_leads_session_id", "intake_leads", ["session_id"], unique=True)
    op.create_index("ix_intake_leads_is_urgent",  "intake_leads", ["is_urgent"])
    op.create_index("ix_intake_leads_is_hot",     "intake_leads", ["is_hot"])
    op.create_index("ix_intake_leads_status",     "intake_leads", ["status"])


def downgrade() -> None:
    op.drop_index("ix_intake_leads_status",     table_name="intake_leads")
    op.drop_index("ix_intake_leads_is_hot",     table_name="intake_leads")
    op.drop_index("ix_intake_leads_is_urgent",  table_name="intake_leads")
    op.drop_index("ix_intake_leads_session_id", table_name="intake_leads")
    op.drop_table("intake_leads")
