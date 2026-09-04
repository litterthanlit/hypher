import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const _internal = internal as any;

export async function scheduleProjectMemorySynthesis(
  ctx: { scheduler: { runAfter: (...args: any[]) => Promise<unknown> } },
  args: {
    userId: string;
    projectId: Id<"objects">;
    reason: "dump" | "writeback" | "manual";
  }
): Promise<void> {
  await ctx.scheduler.runAfter(0, _internal.projectMemoryActions.synthesize, args);
}
