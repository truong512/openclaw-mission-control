from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.services import task_attachments as ta


def test_validate_attachment_content_type_accepts_png() -> None:
    assert ta.validate_attachment_content_type("image/png") == "image/png"


def test_validate_attachment_content_type_normalizes_parameters() -> None:
    assert (
        ta.validate_attachment_content_type("image/jpeg; charset=binary")
        == "image/jpeg"
    )


def test_validate_attachment_content_type_accepts_pdf() -> None:
    assert ta.validate_attachment_content_type("application/pdf") == "application/pdf"


def test_validate_attachment_content_type_rejects_unsupported_type() -> None:
    with pytest.raises(HTTPException) as exc:
        ta.validate_attachment_content_type("application/zip")
    assert exc.value.status_code == 415


def test_is_image_content_type() -> None:
    assert ta.is_image_content_type("image/png") is True
    assert ta.is_image_content_type("application/pdf") is False


def test_sanitize_attachment_filename_strips_unsafe_characters() -> None:
    assert ta.sanitize_attachment_filename("  my screen#shot.png  ") == "my_screen_shot.png"


def test_attachment_api_path_is_board_scoped() -> None:
    from uuid import UUID

    board_id = UUID("11111111-1111-1111-1111-111111111111")
    attachment_id = UUID("22222222-2222-2222-2222-222222222222")
    assert (
        ta.attachment_api_path(board_id=board_id, attachment_id=attachment_id)
        == f"/api/v1/boards/{board_id}/tasks/attachments/{attachment_id}"
    )
