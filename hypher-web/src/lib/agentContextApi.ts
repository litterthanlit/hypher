import type { AgentEvent, AnyObject, Handoff, Project, ProjectAction, ProjectMemory } from "@/types";
import { compileProjectContext } from "./projectContext";

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
  return getAgentContextPlan(subscription) === "pro"
    ? { captures: 8, actions: 8, agentEvents: 8, recentChanges: 8, openQuestions: 8 }
    : { captures: 3, actions: 3, agentEvents: 3, recentChanges: 3, openQuestions: 3 };
}

export function buildAgentContextApiResponse(params: {
  project: Project;
  memory?: ProjectMemory | null;
  captures: AnyObject[];
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
