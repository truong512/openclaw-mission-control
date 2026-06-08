"""add task attachments table

Revision ID: c4e8f1a2b3d6
Revises: f2a8c3d1e5b7
Create Date: 2026-06-07 14:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c4e8f1a2b3d6"
down_revision = "f2a8c3d1e5b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table("task_attachments"):
        return

    op.create_table(
        "task_attachments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("board_id", sa.Uuid(), nullable=False),
        sa.Column("task_id", sa.Uuid(), nullable=True),
        sa.Column("filename", sa.String(), nullable=False),
        sa.Column("content_type", sa.String(), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("storage_name", sa.String(), nullable=False),
        sa.Column("created_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_task_attachments_board_id"),
        "task_attachments",
        ["board_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_attachments_created_by_user_id"),
        "task_attachments",
        ["created_by_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_task_attachments_task_id"),
        "task_attachments",
        ["task_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("task_attachments"):
        return

    op.drop_index(op.f("ix_task_attachments_task_id"), table_name="task_attachments")
    op.drop_index(
        op.f("ix_task_attachments_created_by_user_id"),
        table_name="task_attachments",
    )
    op.drop_index(op.f("ix_task_attachments_board_id"), table_name="task_attachments")
    op.drop_table("task_attachments")
