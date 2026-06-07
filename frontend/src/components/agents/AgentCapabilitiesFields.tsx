"use client";

import { AgentAssignedSkillsSection } from "@/components/agents/AgentAssignedSkillsSection";
import { Input } from "@/components/ui/input";

type AgentCapabilitiesFieldsProps = {
  gatewayId: string | null | undefined;
  selectedSkillIds: string[];
  onSelectedSkillIdsChange: (skillIds: string[]) => void;
  allowedModelsText: string;
  onAllowedModelsTextChange: (value: string) => void;
  primaryModel: string;
  onPrimaryModelChange: (value: string) => void;
  disabled?: boolean;
};

const parseModelList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatModelList = (models: string[] | null | undefined): string =>
  (models ?? []).join(", ");

export const buildAgentCapabilityPayload = ({
  selectedSkillIds,
  allowedModelsText,
  primaryModel,
}: {
  selectedSkillIds: string[];
  allowedModelsText: string;
  primaryModel: string;
}) => {
  const allowed_models = parseModelList(allowedModelsText);
  const trimmedPrimary = primaryModel.trim();
  return {
    skill_ids: selectedSkillIds,
    allowed_models: allowed_models.length > 0 ? allowed_models : null,
    primary_model: trimmedPrimary || null,
  };
};

export function AgentCapabilitiesFields({
  gatewayId,
  selectedSkillIds,
  onSelectedSkillIdsChange,
  allowedModelsText,
  onAllowedModelsTextChange,
  primaryModel,
  onPrimaryModelChange,
  disabled = false,
}: AgentCapabilitiesFieldsProps) {
  return (
    <div className="space-y-6">
      <AgentAssignedSkillsSection
        gatewayId={gatewayId}
        selectedSkillIds={selectedSkillIds}
        onSelectedSkillIdsChange={onSelectedSkillIdsChange}
        disabled={disabled}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Model limits
        </p>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              Allowed models
            </label>
            <Input
              value={allowedModelsText}
              onChange={(event) => onAllowedModelsTextChange(event.target.value)}
              placeholder="openai-codex/gpt-5.2, anthropic/claude-sonnet-4"
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">
              Comma-separated model ids this agent may use.
            </p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              Primary model
            </label>
            <Input
              value={primaryModel}
              onChange={(event) => onPrimaryModelChange(event.target.value)}
              placeholder="openai-codex/gpt-5.2"
              disabled={disabled}
            />
            <p className="text-xs text-slate-500">
              Preferred model. Must be one of the allowed models when both are
              set.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export { formatModelList, parseModelList };
