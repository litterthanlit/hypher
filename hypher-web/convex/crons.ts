import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

// typegen pending convex dev
const _internal = internal as any;

const crons = cronJobs();

crons.interval(
  "sync-github",
  { minutes: 15 },
  internal.github.syncAllRepos
);

crons.interval(
  "dispatch-digest-emails",
  { minutes: 15 },
  _internal.digestEmailDispatcher.dispatchDigests
);

export default crons;
