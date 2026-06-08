"""Helpers for validating and storing task description attachments."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Final
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status

from app.core.config import settings
from app.models.boards import Board
from app.models.task_attachments import TaskAttachment
from app.models.tasks import Task
from sqlmodel.ext.asyncio.session import AsyncSession

ALLOWED_ATTACHMENT_CONTENT_TYPES: Final[frozenset[str]] = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/msword",
        "application/vnd.ms-excel",
    },
)
CONTENT_TYPE_EXTENSIONS: Final[dict[str, str]] = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/msword": ".doc",
    "application/vnd.ms-excel": ".xls",
}
IMAGE_ATTACHMENT_CONTENT_TYPES: Final[frozenset[str]] = frozenset(
    content_type
    for content_type in ALLOWED_ATTACHMENT_CONTENT_TYPES
    if content_type.startswith("image/")
)
_FILENAME_SANITIZE_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")


def is_image_content_type(content_type: str) -> bool:
    """Return whether the content type should render inline as an image."""
    normalized = content_type.split(";", 1)[0].strip().lower()
    return normalized in IMAGE_ATTACHMENT_CONTENT_TYPES


def sanitize_attachment_filename(filename: str) -> str:
    """Return a safe display filename for attachment metadata."""
    cleaned = _FILENAME_SANITIZE_PATTERN.sub("_", filename.strip())
    return cleaned[:180] or "attachment"


def attachment_api_path(*, board_id: UUID, attachment_id: UUID) -> str:
    """Return the API path clients embed in task description markdown."""
    return f"/api/v1/boards/{board_id}/tasks/attachments/{attachment_id}"


def attachment_storage_path(
    *,
    organization_id: UUID,
    board_id: UUID,
    storage_name: str,
) -> Path:
    """Resolve the on-disk path for an attachment blob."""
    return (
        settings.task_attachment_upload_dir
        / str(organization_id)
        / str(board_id)
        / storage_name
    )


def validate_attachment_content_type(content_type: str | None) -> str:
    """Validate and normalize an attachment content type."""
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    if normalized not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail={
                "message": "Unsupported attachment type.",
                "allowed_content_types": sorted(ALLOWED_ATTACHMENT_CONTENT_TYPES),
            },
        )
    return normalized


async def read_upload_bytes(
    upload: UploadFile,
    *,
    max_bytes: int,
) -> bytes:
    """Read an upload file and enforce the configured size limit."""
    data = await upload.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Attachment file is empty.",
        )
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "message": "Attachment exceeds the maximum allowed size.",
                "max_bytes": max_bytes,
            },
        )
    return data


async def create_task_attachment(
    session: AsyncSession,
    *,
    board: Board,
    upload: UploadFile,
    task: Task | None,
    created_by_user_id: UUID | None,
) -> TaskAttachment:
    """Persist an uploaded attachment for a board/task description."""
    if task is not None and task.board_id != board.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    content_type = validate_attachment_content_type(upload.content_type)
    data = await read_upload_bytes(
        upload,
        max_bytes=settings.task_attachment_max_bytes,
    )
    attachment_id = uuid4()
    extension = CONTENT_TYPE_EXTENSIONS[content_type]
    storage_name = f"{attachment_id}{extension}"
    destination = attachment_storage_path(
        organization_id=board.organization_id,
        board_id=board.id,
        storage_name=storage_name,
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)

    attachment = TaskAttachment(
        id=attachment_id,
        board_id=board.id,
        task_id=task.id if task is not None else None,
        filename=sanitize_attachment_filename(upload.filename or storage_name),
        content_type=content_type,
        byte_size=len(data),
        storage_name=storage_name,
        created_by_user_id=created_by_user_id,
    )
    session.add(attachment)
    await session.flush()
    return attachment


def task_attachment_to_read(attachment: TaskAttachment) -> dict[str, object]:
    """Serialize attachment metadata for API responses."""
    return {
        "id": attachment.id,
        "board_id": attachment.board_id,
        "task_id": attachment.task_id,
        "filename": attachment.filename,
        "content_type": attachment.content_type,
        "byte_size": attachment.byte_size,
        "url": attachment_api_path(
            board_id=attachment.board_id,
            attachment_id=attachment.id,
        ),
        "is_image": is_image_content_type(attachment.content_type),
        "created_at": attachment.created_at,
    }
