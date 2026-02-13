import {
  AgentData,
  SchoolProfile,
  UserProfile,
  PLAN_AGENT_ACCESS,
  SubscriptionPlan,
} from "./types";

/**
 * Computes the set of agent IDs a user can access.
 *
 * Access = tier(school.subscriptionPlan) + school.customAgentAccess + user.extraAvatarAccess
 * No school = tier "free"
 */
export function computeAccessibleAgentIds(
  agents: AgentData[],
  school: SchoolProfile | null,
  user: UserProfile
): Set<string> {
  const plan: SubscriptionPlan = school?.subscriptionPlan ?? "free";
  const allowedTypes = new Set(PLAN_AGENT_ACCESS[plan]);

  const ids = new Set<string>();

  // 1. Agents whose type is included by the subscription plan
  for (const agent of agents) {
    if (allowedTypes.has(agent.type)) {
      ids.add(agent.id);
    }
  }

  // 2. School custom agents
  if (school) {
    for (const id of school.customAgentAccess) {
      ids.add(id);
    }
  }

  // 3. User personal extras
  for (const id of user.extraAvatarAccess) {
    ids.add(id);
  }

  return ids;
}
