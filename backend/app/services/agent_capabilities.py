"""Agent skill assignments and model-limit helpers."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import col, select

from app.core.time import utcnow
from app.models.agents import Agent
from app.models.boards import Board
from app.models.skills import AgentSkill, MarketplaceSkill
from app.schemas.agents import AgentAssignedSkillRead

if TYPE_CHECKING:
    from sqlmodel.ext.asyncio.session import AsyncSession


def normalize_model_ids(models: object) -> list[str] | None:
    """Normalize allowed model ids into a trimmed, de-duplicated list."""
    if models is None:
        return None
    if not isinstance(models, list):
        return None
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in models:
        if raw is None:
            continue
        value = str(raw).strip()
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized or None


def normalize_primary_model(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        trimmed = value.strip()
        return trimmed or None
    return None


def validate_agent_model_limits(
    *,
    allowed_models: list[str] | None,
    primary_model: str | None,
) -> None:
    if primary_model and allowed_models and primary_model not in allowed_models:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="primary_model must be included in allowed_models",
        )


def build_gateway_model_config(agent: Agent) -> dict[str, object] | None:
    allowed = normalize_model_ids(getattr(agent, "allowed_models", None)) or []
    primary = normalize_primary_model(getattr(agent, "primary_model", None)) or (
        allowed[0] if allowed else None
    )
    if not primary:
        return None
    fallbacks = [model_id for model_id in allowed if model_id != primary]
    return {"primary": primary, "fallbacks": fallbacks}


async def load_assigned_skills_for_agents(
    session: AsyncSession,
    agent_ids: list[UUID],
) -> dict[UUID, list[AgentAssignedSkillRead]]:
    if not agent_ids:
        return {}

    rows = (
        await session.exec(
            select(AgentSkill, MarketplaceSkill)
            .join(MarketplaceSkill, col(AgentSkill.skill_id) == col(MarketplaceSkill.id))
            .where(col(AgentSkill.agent_id).in_(agent_ids))
            .order_by(col(MarketplaceSkill.name).asc()),
        )
    ).all()

    grouped: dict[UUID, list[AgentAssignedSkillRead]] = {agent_id: [] for agent_id in agent_ids}
    for assignment, skill in rows:
        grouped.setdefault(assignment.agent_id, []).append(
            AgentAssignedSkillRead(
                id=skill.id,
                name=skill.name,
                category=skill.category,
            ),
        )
    return grouped


async def sync_agent_skills(
    session: AsyncSession,
    *,
    agent_id: UUID,
    skill_ids: list[UUID] | None,
    organization_id: UUID,
) -> None:
    if skill_ids is None:
        return

    unique_skill_ids = list(dict.fromkeys(skill_ids))
    if unique_skill_ids:
        skills = (
            await session.exec(
                select(MarketplaceSkill).where(col(MarketplaceSkill.id).in_(unique_skill_ids)),
            )
        ).all()
        found_ids = {skill.id for skill in skills}
        missing = [skill_id for skill_id in unique_skill_ids if skill_id not in found_ids]
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="One or more marketplace skills were not found",
            )
        invalid_org = [skill for skill in skills if skill.organization_id != organization_id]
        if invalid_org:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="One or more skills are outside the active organization",
            )

    existing = (
        await session.exec(select(AgentSkill).where(col(AgentSkill.agent_id) == agent_id))
    ).all()
    existing_by_skill_id = {row.skill_id: row for row in existing}
    desired_ids = set(unique_skill_ids)

    for skill_id, row in existing_by_skill_id.items():
        if skill_id not in desired_ids:
            await session.delete(row)

    now = utcnow()
    for skill_id in unique_skill_ids:
        existing_row = existing_by_skill_id.get(skill_id)
        if existing_row is None:
            session.add(
                AgentSkill(
                    agent_id=agent_id,
                    skill_id=skill_id,
                    created_at=now,
                    updated_at=now,
                ),
            )
            continue
        existing_row.updated_at = now
        session.add(existing_row)


async def build_agent_capability_context(
    session: AsyncSession,
    *,
    agent: Agent,
    board: Board | None,
) -> dict[str, str]:
    """Build template context for assigned skills and model limits."""
    assigned_skills = (await load_assigned_skills_for_agents(session, [agent.id])).get(
        agent.id,
        [],
    )
    allowed_models = normalize_model_ids(agent.allowed_models) or []
    primary_model = normalize_primary_model(agent.primary_model) or ""

    context: dict[str, str] = {
        "agent_assigned_skills": ", ".join(skill.name for skill in assigned_skills),
        "agent_assigned_skills_json": json.dumps(
            [skill.model_dump(mode="json") for skill in assigned_skills],
        ),
        "agent_allowed_models": ", ".join(allowed_models),
        "agent_allowed_models_json": json.dumps(allowed_models),
        "agent_primary_model": primary_model,
    }

    if not agent.is_board_lead or board is None:
        return context

    board_agents = (
        await session.exec(
            select(Agent)
            .where(col(Agent.board_id) == board.id)
            .order_by(col(Agent.is_board_lead).desc(), col(Agent.name).asc()),
        )
    ).all()
    skill_map = await load_assigned_skills_for_agents(
        session,
        [board_agent.id for board_agent in board_agents],
    )
    roster: list[dict[str, object]] = []
    for board_agent in board_agents:
        identity = board_agent.identity_profile if isinstance(board_agent.identity_profile, dict) else {}
        role = str(identity.get("role") or "").strip()
        roster.append(
            {
                "id": str(board_agent.id),
                "name": board_agent.name,
                "role": role,
                "is_board_lead": board_agent.is_board_lead,
                "skills": [skill.name for skill in skill_map.get(board_agent.id, [])],
                "allowed_models": normalize_model_ids(board_agent.allowed_models) or [],
                "primary_model": normalize_primary_model(board_agent.primary_model) or None,
            },
        )
    context["board_team_roster_json"] = json.dumps(roster)
    return context
