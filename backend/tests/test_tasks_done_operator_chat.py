from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.api import tasks as tasks_api
from app.api.deps import ActorContext
from app.models.agents import Agent
from app.models.board_memory import BoardMemory
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.tasks import Task
from app.schemas.tasks import TaskUpdate


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


async def _make_session(engine: AsyncEngine) -> AsyncSession:
    return AsyncSession(engine, expire_on_commit=False)


async def _seed_board_task_and_lead(
    session: AsyncSession,
    *,
    task_status: str = "review",
) -> tuple[Board, Task, Agent]:
    organization_id = uuid4()
    gateway = Gateway(
        id=uuid4(),
        organization_id=organization_id,
        name="gateway",
        url="https://gateway.local",
        workspace_root="/tmp/workspace",
    )
    board = Board(
        id=uuid4(),
        organization_id=organization_id,
        gateway_id=gateway.id,
        name="board",
        slug=f"board-{uuid4()}",
        require_approval_for_done=False,
        require_review_before_done=False,
    )
    lead = Agent(
        id=uuid4(),
        board_id=board.id,
        gateway_id=gateway.id,
        name="lead",
        status="online",
        is_board_lead=True,
    )
    task = Task(
        id=uuid4(),
        board_id=board.id,
        title="Ship feature",
        status=task_status,
        assigned_agent_id=lead.id,
    )

    session.add(Organization(id=organization_id, name=f"org-{organization_id}"))
    session.add(gateway)
    session.add(board)
    session.add(task)
    session.add(lead)
    await session.commit()
    return board, task, lead


@pytest.mark.asyncio
async def test_marking_task_done_posts_operator_board_chat_message() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            board, task, lead = await _seed_board_task_and_lead(session)

            await tasks_api.update_task(
                payload=TaskUpdate(status="done"),
                task=task,
                session=session,
                actor=ActorContext(actor_type="agent", agent=lead),
            )

            memories = list(
                await session.exec(
                    select(BoardMemory).where(col(BoardMemory.board_id) == board.id),
                ),
            )
            assert len(memories) == 1
            memory = memories[0]
            assert memory.is_chat is True
            assert memory.tags == ["chat", "task_done"]
            assert "TASK COMPLETED" in memory.content
            assert "Ship feature" in memory.content
            assert "Marked done by: lead" in memory.content
    finally:
        await engine.dispose()


@pytest.mark.asyncio
async def test_marking_already_done_task_does_not_post_duplicate_chat() -> None:
    engine = await _make_engine()
    try:
        async with await _make_session(engine) as session:
            board, task, lead = await _seed_board_task_and_lead(session)

            await tasks_api.update_task(
                payload=TaskUpdate(status="done"),
                task=task,
                session=session,
                actor=ActorContext(actor_type="agent", agent=lead),
            )
            await tasks_api.update_task(
                payload=TaskUpdate(status="done"),
                task=task,
                session=session,
                actor=ActorContext(actor_type="user"),
            )

            memories = list(
                await session.exec(
                    select(BoardMemory).where(col(BoardMemory.board_id) == board.id),
                ),
            )
            assert len(memories) == 1
    finally:
        await engine.dispose()
