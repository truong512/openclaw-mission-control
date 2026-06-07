"""Task attachment model for description media uploads."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field

from app.core.time import utcnow
from app.models.tenancy import TenantScoped

RUNTIME_ANNOTATION_TYPES = (datetime,)


class TaskAttachment(TenantScoped, table=True):
    """Board-scoped file attachment referenced from task descriptions."""

    __tablename__ = "task_attachments"  # pyright: ignore[reportAssignmentType]

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    board_id: UUID = Field(index=True)
    task_id: UUID | None = Field(default=None, index=True)
    filename: str
    content_type: str
    byte_size: int = Field(ge=0)
    storage_name: str
    created_by_user_id: UUID | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)
