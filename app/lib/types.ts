// ── Agent types ──────────────────────────────────────────────

export type AgentType = "public" | "basic" | "premium" | "custom";

export interface AgentData {
  id: string;
  agentId: string;
  name: string;
  title: string;
  description: string;
  avatarUrl: string;
  type: AgentType;
}

// ── Subscription plans ───────────────────────────────────────

export type SubscriptionPlan = "free" | "basic" | "premium";

/** Which agent types each plan unlocks (cumulative). */
export const PLAN_AGENT_ACCESS: Record<SubscriptionPlan, AgentType[]> = {
  free: ["public"],
  basic: ["public", "basic"],
  premium: ["public", "basic", "premium"],
};

// ── School ───────────────────────────────────────────────────

export interface SchoolProfile {
  id: string;
  name: string;
  subscriptionPlan: SubscriptionPlan;
  customAgentAccess: string[]; // agent IDs
}

// ── User ─────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  schoolId: string | null;
  extraAvatarAccess: string[];
  locale: string | null;
  createdAt: Date;
}

// ── Simli API ────────────────────────────────────────────────

export interface SimliAgentResponse {
  id: string;
  name: string;
  system_prompt: string;
  first_message: string;
  voice_provider: string;
  voice_id: string;
  language: string;
  llm_model: string;
  face_id: string;
  created_at: string;
  updated_at: string;
  // Allow extra fields from the API (e.g. image URLs)
  [key: string]: unknown;
}
