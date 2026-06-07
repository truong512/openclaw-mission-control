"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/api/mutator";
import {
  type listMarketplaceSkillsApiV1SkillsMarketplaceGetResponse,
  useListMarketplaceSkillsApiV1SkillsMarketplaceGet,
} from "@/api/generated/skills-marketplace/skills-marketplace";
import { GatewayInstalledSkillsTable } from "@/components/gateways/GatewayInstalledSkillsTable";
import { Button } from "@/components/ui/button";

type GatewayInstalledSkillsSectionProps = {
  gatewayId: string | null | undefined;
  enabled?: boolean;
};

export function GatewayInstalledSkillsSection({
  gatewayId,
  enabled = true,
}: GatewayInstalledSkillsSectionProps) {
  const router = useRouter();

  const skillsQuery = useListMarketplaceSkillsApiV1SkillsMarketplaceGet<
    listMarketplaceSkillsApiV1SkillsMarketplaceGetResponse,
    ApiError
  >(
    { gateway_id: gatewayId ?? "", installed: true },
    {
      query: {
        enabled: Boolean(enabled && gatewayId),
        refetchOnMount: "always",
        refetchInterval: 30_000,
        retry: false,
      },
    },
  );

  const installedSkills = useMemo(
    () =>
      skillsQuery.data?.status === 200 ? (skillsQuery.data.data ?? []) : [],
    [skillsQuery.data],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Installed skills
        </p>
        <div className="flex items-center gap-3">
          {!gatewayId ? (
            <span className="text-xs text-slate-500">Gateway unavailable</span>
          ) : skillsQuery.isLoading ? (
            <span className="text-xs text-slate-500">Loading…</span>
          ) : (
            <span className="text-xs text-slate-500">
              {installedSkills.length} installed
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/skills/marketplace")}
          >
            Manage skills
          </Button>
        </div>
      </div>
      <div className="mt-4">
        {skillsQuery.error ? (
          <p className="text-sm text-rose-600">{skillsQuery.error.message}</p>
        ) : (
          <GatewayInstalledSkillsTable
            skills={installedSkills}
            isLoading={Boolean(gatewayId) && skillsQuery.isLoading}
          />
        )}
      </div>
    </div>
  );
}
