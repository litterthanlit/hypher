import { describe, expect, it } from "vitest";
import {
  buildActionFromAgentSuggestion,
  buildActionFromMemoryAction,
  selectProjectActionQueue,
  type ProjectAction,
} from "./actions";

const NOW = 1000;

describe("project actions", () => {
  it("builds an action from an agent suggested action", () => {
    expect(
      buildActionFromAgentSuggestion({
        userId: "user_1",
        projectId: "p1",
        eventId: "event_1",
        title: "Add retry handling",
        now: NOW,
      })
    ).toEqual({
      userId: "user_1",
      projectId: "p1",
      title: "Add retry handling",
      status: "suggested",
      sourceType: "agent_event",
      sourceId: "event_1",
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("builds an action from project memory", () => {
    expect(
      buildActionFromMemoryAction({
        userId: "user_1",
        projectId: "p1",
        memoryActionId: "memory_action_1",
        title: "Run beta smoke test",
        rationale: "Validates activation.",
        status: "accepted",
        now: NOW,
      })
    ).toMatchObject({
      title: "Run beta smoke test",
      rationale: "Validates activation.",
      status: "accepted",
      sourceType: "project_memory",
      sourceId: "memory_action_1",
    });
  });

  it("orders active actions before completed and dismissed actions", () => {
    const actions: ProjectAction[] = [
      action("Completed", "completed", 4),
      action("Suggested", "suggested", 3),
      action("Accepted", "accepted", 2),
      action("Dismissed", "dismissed", 5),
    ];

    expect(selectProjectActionQueue(actions).map((item) => item.title)).toEqual([
      "Accepted",
      "Suggested",
      "Completed",
      "Dismissed",
    ]);
  });
});

function action(title: string, status: ProjectAction["status"], updatedAt: number): ProjectAction {
  return {
    id: title,
    userId: "user_1",
    projectId: "p1",
    title,
    status,
    sourceType: "manual",
    createdAt: updatedAt,
    updatedAt,
  };
}
