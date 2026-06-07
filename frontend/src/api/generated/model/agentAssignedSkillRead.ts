/**
 * Skill assigned to an agent for routing and delegation.
 */
export interface AgentAssignedSkillRead {
  id: string;
  name: string;
  category?: string | null;
}
