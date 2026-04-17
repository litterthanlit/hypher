"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// typegen pending convex dev
const _internal = internal as any;

export const dispatchDigests = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allPrefs: Array<{
      userId: string;
      localHour: number;
      timezone: string;
      lastSentAt?: number;
    }> = await ctx.runQuery(_internal.digestEmail.listEnabled);

    for (const pref of allPrefs) {
      // Compute the user's local hour using their stored IANA timezone
      let localHour: number;
      try {
        const localString = new Date(now).toLocaleString("en-US", {
          timeZone: pref.timezone,
          hour: "numeric",
          hour12: false,
        });
        localHour = parseInt(localString, 10);
      } catch {
        // Invalid timezone stored — skip this user
        continue;
      }

      // Skip if user's local hour doesn't match their preference
      if (localHour !== pref.localHour) continue;

      // Skip if an email was already sent within the last 23 hours
      if (pref.lastSentAt && now - pref.lastSentAt < 23 * 3600_000) continue;

      await ctx.runAction(_internal.digestEmail.sendForUser, {
        userId: pref.userId,
      });
    }

    // Prune tokens older than 14 days on each dispatcher run
    await ctx.runMutation(_internal.digestEmail.pruneOldTokens, {});
  },
});
