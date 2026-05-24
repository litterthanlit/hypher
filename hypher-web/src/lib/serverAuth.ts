import { auth } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { isBetaAdmin } from "@/lib/beta";

export class ServerAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403
  ) {
    super(message);
  }
}

export type ServerUser = {
  userId: string;
  getToken: (args: { template: string }) => Promise<string | null>;
};

export async function requireUser(): Promise<ServerUser> {
  const session = await auth();
  if (!session.userId) throw new ServerAuthError("unauth", 401);
  return {
    userId: session.userId,
    getToken: session.getToken,
  };
}

export async function requireBetaAccess(): Promise<ServerUser & { convexToken: string }> {
  const user = await requireUser();
  const convexToken = await user.getToken({ template: "convex" });
  if (!convexToken) throw new ServerAuthError("missing_convex_token", 401);
  const state = await fetchQuery(
    (api as any).beta.getGateState,
    {},
    { token: convexToken }
  ) as { hasAccess: boolean; isAdmin: boolean };
  if (!state.hasAccess && !state.isAdmin) {
    throw new ServerAuthError("beta_access_required", 403);
  }
  return { ...user, convexToken };
}

export async function requireAdmin(): Promise<ServerUser> {
  const user = await requireUser();
  if (!isBetaAdmin(user.userId, process.env.BETA_ADMIN_USER_IDS)) {
    throw new ServerAuthError("admin_required", 403);
  }
  return user;
}

export function authErrorJson(error: unknown): Response {
  if (error instanceof ServerAuthError) {
    return Response.json({ ok: false, error: error.message }, { status: error.status });
  }
  throw error;
}
