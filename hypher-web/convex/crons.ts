import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "sync-github",
  { minutes: 15 },
  internal.github.syncAllRepos
);

export default crons;
