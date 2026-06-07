"""Schemas for task attachment upload and download metadata."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

RUNTIME_ANNOTATION_TYPES = (datetime, UUID)


class TaskAttachmentRead(SQLModel):
    """Attachment metadata returned after upload."""

    id: UUID
    board_id: UUID
    task_id: UUID | None
    filename: str
    content_type: str
    byte_size: int
    url: str
    is_image: bool = False
    created_at: datetime
