import type { ActivityEntry, AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileProjectContext, BUILDER_BRIEF_DEFAULT_LIMITS } from "./projectContext";

type SubscriptionLike = {
  status?: string;
  plan?: string;
} | null | undefined;

type AgentContextPlan = "free" | "pro";

export interface AgentContextLimits {
  captures: number;
  actions: number;
  agentEvents: number;
  recentChanges: number;
  openQuestions: number;
}

export function getAgentContextPlan(subscription: SubscriptionLike): AgentContextPlan {
  if (!subscription) return "free";
  if (subscription.status !== "active" && subscription.status !== "trialing") return "free";
  return subscription.plan === "pro_monthly" || subscription.plan === "lifetime" ? "pro" : "free";
}

export function getAgentContextLimits(subscription: SubscriptionLike): AgentContextLimits {
  // The brief is the product. Do not shrink free packets into compact mode
  // just because the plan is free. Charge for something else.
  const width = getAgentContextPlan(subscription) === "pro"
    ? 8
    : BUILDER_BRIEF_DEFAULT_LIMITS.captures;
  return {
    captures: width,
    actions: width,
    agentEvents: width,
    recentChanges: width,
    openQuestions: width,
  };
}

export function buildAgentContextApiResponse(params: {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
  activity?: ActivityEntry[];
  actions: ProjectAction[];
  agentEvents: AgentEvent[];
  handoffs?: Handoff[];
  subscription?: SubscriptionLike;
  task?: string;
  role?: string;
}) {
  const plan = getAgentContextPlan(params.subscription);
  const limits = getAgentContextLimits(params.subscription);
  const context = compileProjectContext({
    project: params.project,
    memory: params.memory,
    captures: params.captures,
    activity: params.activity,
    actions: params.actions,
    agentEvents: params.agentEvents,
    handoffs: params.handoffs,
    task: params.task,
    role: params.role,
    limits,
  });

  return {
    ok: true as const,
    projectId: params.project.id,
    plan,
    limits,
    context,
  };
}
