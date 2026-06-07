"""add agent skills and model limits

Revision ID: f2a8c3d1e5b7
Revises: a9b1c2d3e4f7
Create Date: 2026-06-07 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f2a8c3d1e5b7"
down_revision = "a9b1c2d3e4f7"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    return sa.inspect(op.get_bind()).has_table(table_name)


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    columns = sa.inspect(op.get_bind()).get_columns(table_name)
    return any(column["name"] == column_name for column in columns)


def _has_index(table_name: str, index_name: str) -> bool:
    if not _has_table(table_name):
        return False
    indexes = sa.inspect(op.get_bind()).get_indexes(table_name)
    return any(index["name"] == index_name for index in indexes)


def upgrade() -> None:
    if not _has_column("agents", "allowed_models"):
        op.add_column("agents", sa.Column("allowed_models", sa.JSON(), nullable=True))
    if not _has_column("agents", "primary_model"):
        op.add_column(
            "agents",
            sa.Column("primary_model", sa.String(), nullable=True),
        )

    if not _has_table("agent_skills"):
        op.create_table(
            "agent_skills",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("agent_id", sa.Uuid(), nullable=False),
            sa.Column("skill_id", sa.Uuid(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["agent_id"], ["agents.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["skill_id"], ["marketplace_skills.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "agent_id",
                "skill_id",
                name="uq_agent_skills_agent_id_skill_id",
            ),
        )

    agent_id_idx = op.f("ix_agent_skills_agent_id")
    if _has_table("agent_skills") and not _has_index("agent_skills", agent_id_idx):
        op.create_index(agent_id_idx, "agent_skills", ["agent_id"], unique=False)

    skill_id_idx = op.f("ix_agent_skills_skill_id")
    if _has_table("agent_skills") and not _has_index("agent_skills", skill_id_idx):
        op.create_index(skill_id_idx, "agent_skills", ["skill_id"], unique=False)


def downgrade() -> None:
    skill_id_idx = op.f("ix_agent_skills_skill_id")
    if _has_index("agent_skills", skill_id_idx):
        op.drop_index(skill_id_idx, table_name="agent_skills")

    agent_id_idx = op.f("ix_agent_skills_agent_id")
    if _has_index("agent_skills", agent_id_idx):
        op.drop_index(agent_id_idx, table_name="agent_skills")

    if _has_table("agent_skills"):
        op.drop_table("agent_skills")

    if _has_column("agents", "primary_model"):
        op.drop_column("agents", "primary_model")
    if _has_column("agents", "allowed_models"):
        op.drop_column("agents", "allowed_models")
