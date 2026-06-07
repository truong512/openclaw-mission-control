"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ApiError } from "@/api/mutator";
import {
  type listMarketplaceSkillsApiV1SkillsMarketplaceGetResponse,
  useListMarketplaceSkillsApiV1SkillsMarketplaceGet,
} from "@/api/generated/skills-marketplace/skills-marketplace";
import { AgentAssignedSkillsTable } from "@/components/agents/AgentAssignedSkillsTable";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AgentAssignedSkillsSectionProps = {
  gatewayId: string | null | undefined;
  selectedSkillIds: string[];
  onSelectedSkillIdsChange?: (skillIds: string[]) => void;
  assignedSkillIds?: string[];
  editHref?: string;
  disabled?: boolean;
};

export function AgentAssignedSkillsSection({
  gatewayId,
  selectedSkillIds,
  onSelectedSkillIdsChange,
  assignedSkillIds,
  editHref,
  disabled = false,
}: AgentAssignedSkillsSectionProps) {
  const isEditable = Boolean(onSelectedSkillIdsChange);

  const skillsQuery = useListMarketplaceSkillsApiV1SkillsMarketplaceGet<
    listMarketplaceSkillsApiV1SkillsMarketplaceGetResponse,
    ApiError
  >(
    { gateway_id: gatewayId ?? "", installed: true },
    {
      query: {
        enabled: Boolean(gatewayId),
        refetchOnMount: "always",
        retry: false,
      },
    },
  );

  const installedSkills = useMemo(() => {
    if (skillsQuery.data?.status !== 200) return [];
    return skillsQuery.data.data ?? [];
  }, [skillsQuery.data]);

  const visibleSkills = useMemo(() => {
    if (isEditable) {
      return installedSkills;
    }
    const ids = new Set(assignedSkillIds ?? selectedSkillIds);
    return installedSkills.filter((skill) => ids.has(skill.id));
  }, [assignedSkillIds, installedSkills, isEditable, selectedSkillIds]);

  const assignedCount = isEditable
    ? selectedSkillIds.length
    : visibleSkills.length;

  const toggleSkill = (skillId: string) => {
    if (!onSelectedSkillIdsChange) return;
    if (selectedSkillIds.includes(skillId)) {
      onSelectedSkillIdsChange(
        selectedSkillIds.filter((id) => id !== skillId),
      );
      return;
    }
    onSelectedSkillIdsChange([...selectedSkillIds, skillId]);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Assigned skills
        </p>
        <div className="flex items-center gap-3">
          {!gatewayId ? (
            <span className="text-xs text-slate-500">
              Select a board to load gateway skills
            </span>
          ) : skillsQuery.isLoading ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : (
            <span className="text-xs text-slate-500">
              {assignedCount} assigned
            </span>
          )}
          {editHref ? (
            <Link
              href={editHref}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Edit assignments
            </Link>
          ) : (
            <Link
              href="/skills/marketplace"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Manage skills
            </Link>
          )}
        </div>
      </div>
      <div className="mt-4">
        {skillsQuery.error ? (
          <p className="text-sm text-rose-600">{skillsQuery.error.message}</p>
        ) : (
          <AgentAssignedSkillsTable
            skills={visibleSkills}
            isLoading={Boolean(gatewayId) && skillsQuery.isLoading}
            selectedSkillIds={isEditable ? selectedSkillIds : undefined}
            onToggleSkill={isEditable ? toggleSkill : undefined}
            disabled={disabled}
          />
        )}
      </div>
      {isEditable ? (
        <p className="mt-4 text-xs text-slate-500">
          Only skills installed on this gateway can be assigned. Install more
          from the marketplace if needed.
        </p>
      ) : null}
    </div>
  );
}
