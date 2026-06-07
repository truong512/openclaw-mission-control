# ruff: noqa

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from sqlmodel import SQLModel, col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.agents import Agent
from app.models.boards import Board
from app.models.gateways import Gateway
from app.models.organizations import Organization
from app.models.skills import AgentSkill, MarketplaceSkill
from app.services.agent_capabilities import (
    build_gateway_model_config,
    sync_agent_skills,
    validate_agent_model_limits,
)
from app.services.openclaw.provisioning_db import AgentLifecycleService


def test_validate_agent_model_limits_rejects_primary_outside_allowlist() -> None:
    with pytest.raises(HTTPException) as exc:
        validate_agent_model_limits(
            allowed_models=["openai/gpt-4"],
            primary_model="anthropic/claude-sonnet-4",
        )
    assert exc.value.status_code == 422


def test_build_gateway_model_config_uses_primary_and_fallbacks() -> None:
    agent = Agent(
        name="Worker",
        gateway_id=uuid4(),
        allowed_models=["openai/gpt-4", "anthropic/claude-sonnet-4"],
        primary_model="anthropic/claude-sonnet-4",
    )
    assert build_gateway_model_config(agent) == {
        "primary": "anthropic/claude-sonnet-4",
        "fallbacks": ["openai/gpt-4"],
    }


async def _make_engine() -> AsyncEngine:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.connect() as conn, conn.begin():
        await conn.run_sync(SQLModel.metadata.create_all)
    return engine


@pytest.mark.asyncio
async def test_sync_agent_skills_replaces_assignments() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        await _sync_agent_skills_replaces_assignments(session)


async def _sync_agent_skills_replaces_assignments(session: AsyncSession) -> None:
    org = Organization(name=f"Org {uuid4().hex[:8]}")
    session.add(org)
    await session.commit()
    await session.refresh(org)

    gateway = Gateway(
        organization_id=org.id,
        name="Gateway",
        url="http://127.0.0.1:18789",
        token="token",
        workspace_root="~/.openclaw/workspace",
    )
    session.add(gateway)
    await session.flush()
    board = Board(
        organization_id=org.id,
        gateway_id=gateway.id,
        name="Board",
        slug="board",
        board_type="goal",
    )
    session.add(board)
    await session.commit()
    await session.refresh(board)

    agent = Agent(
        board_id=board.id,
        gateway_id=gateway.id,
        name="Worker",
        status="active",
    )
    skill_a = MarketplaceSkill(
        organization_id=org.id,
        name="Skill A",
        source_url="https://github.com/example/a",
    )
    skill_b = MarketplaceSkill(
        organization_id=org.id,
        name="Skill B",
        source_url="https://github.com/example/b",
    )
    session.add(agent)
    session.add(skill_a)
    session.add(skill_b)
    await session.commit()
    await session.refresh(agent)
    await session.refresh(skill_a)
    await session.refresh(skill_b)

    await sync_agent_skills(
        session,
        agent_id=agent.id,
        skill_ids=[skill_a.id, skill_b.id],
        organization_id=org.id,
    )
    await session.commit()

    rows = (
        await session.exec(select(AgentSkill).where(col(AgentSkill.agent_id) == agent.id))
    ).all()
    assert {row.skill_id for row in rows} == {skill_a.id, skill_b.id}

    await sync_agent_skills(
        session,
        agent_id=agent.id,
        skill_ids=[skill_b.id],
        organization_id=org.id,
    )
    await session.commit()

    rows = (
        await session.exec(select(AgentSkill).where(col(AgentSkill.agent_id) == agent.id))
    ).all()
    assert len(rows) == 1
    assert rows[0].skill_id == skill_b.id


@pytest.mark.asyncio
async def test_enrich_agent_reads_includes_assigned_skills() -> None:
    engine = await _make_engine()
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        await _enrich_agent_reads_includes_assigned_skills(session)


async def _enrich_agent_reads_includes_assigned_skills(session: AsyncSession) -> None:
    org = Organization(name=f"Org {uuid4().hex[:8]}")
    session.add(org)
    await session.commit()
    await session.refresh(org)

    gateway = Gateway(
        organization_id=org.id,
        name="Gateway",
        url="http://127.0.0.1:18789",
        token="token",
        workspace_root="~/.openclaw/workspace",
    )
    session.add(gateway)
    await session.flush()
    board = Board(
        organization_id=org.id,
        gateway_id=gateway.id,
        name="Board",
        slug="board-enrich",
        board_type="goal",
    )
    agent = Agent(
        board_id=board.id,
        gateway_id=gateway.id,
        name="Worker",
        status="active",
        allowed_models=["openai/gpt-4"],
        primary_model="openai/gpt-4",
    )
    skill = MarketplaceSkill(
        organization_id=org.id,
        name="Deploy Skill",
        source_url="https://github.com/example/deploy",
        category="devops",
    )
    session.add(board)
    session.add(agent)
    session.add(skill)
    await session.commit()
    await session.refresh(agent)
    await session.refresh(skill)

    session.add(AgentSkill(agent_id=agent.id, skill_id=skill.id))
    await session.commit()

    service = AgentLifecycleService(session)
    reads = await service.enrich_agent_reads([agent])
    assert len(reads) == 1
    assert reads[0].allowed_models == ["openai/gpt-4"]
    assert reads[0].primary_model == "openai/gpt-4"
    assert len(reads[0].assigned_skills) == 1
    assert reads[0].assigned_skills[0].name == "Deploy Skill"
