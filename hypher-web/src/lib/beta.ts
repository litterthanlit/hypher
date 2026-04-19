export type BetaFeedbackCategory = "bug" | "friction" | "idea" | "praise";
export type BetaFeedbackStatus = "new" | "reviewed" | "closed";

export interface BetaGateState {
  gateEnabled: boolean;
  hasAccess: boolean;
  isAdmin: boolean;
  accessGrantedAt?: number;
}

export const BETA_FEEDBACK_CATEGORIES: BetaFeedbackCategory[] = [
  "bug",
  "friction",
  "idea",
  "praise",
];

export const BETA_FEEDBACK_STATUSES: BetaFeedbackStatus[] = [
  "new",
  "reviewed",
  "closed",
];

export const MAX_FEEDBACK_MESSAGE_LENGTH = 2000;
export const BETA_INVITE_PREFIX_LEN = 10;

export function normalizeInviteCode(input: string): string {
  return input.replace(/\s+/g, "").trim().toUpperCase();
}

export function splitInviteCode(input: string): { prefix: string; remainder: string } | null {
  const normalized = normalizeInviteCode(input);
  if (!/^HYP-[A-Z0-9-]{12,}$/.test(normalized)) return null;
  const compact = normalized.replace(/-/g, "");
  if (compact.length <= BETA_INVITE_PREFIX_LEN) return null;
  return {
    prefix: compact.slice(0, BETA_INVITE_PREFIX_LEN),
    remainder: compact.slice(BETA_INVITE_PREFIX_LEN),
  };
}

export function isBetaAdmin(userId: string, adminList: string | undefined): boolean {
  if (!adminList) return false;
  return adminList
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

export function isBetaGateEnabled(envValue: string | undefined): boolean {
  return envValue === "true";
}

export function getBetaGateState(args: {
  gateEnabled: boolean;
  isAdmin: boolean;
  accessGrantedAt?: number;
}): BetaGateState {
  return {
    gateEnabled: args.gateEnabled,
    isAdmin: args.isAdmin,
    hasAccess: !args.gateEnabled || args.isAdmin || args.accessGrantedAt !== undefined,
    ...(args.accessGrantedAt !== undefined ? { accessGrantedAt: args.accessGrantedAt } : {}),
  };
}

export function validateInviteForRedemption(invite: {
  revokedAt?: number;
  expiresAt?: number;
  maxRedemptions: number;
  redemptionCount: number;
}, now: number): "ok" | "revoked" | "expired" | "exhausted" {
  if (invite.revokedAt !== undefined) return "revoked";
  if (invite.expiresAt !== undefined && invite.expiresAt <= now) return "expired";
  if (invite.redemptionCount >= invite.maxRedemptions) return "exhausted";
  return "ok";
}

export function validateFeedbackInput(args: {
  category: string;
  message: string;
}): { ok: true; category: BetaFeedbackCategory; message: string } | { ok: false; error: string } {
  const category = args.category as BetaFeedbackCategory;
  if (!BETA_FEEDBACK_CATEGORIES.includes(category)) {
    return { ok: false, error: "bad-category" };
  }
  const message = args.message.trim();
  if (!message) return { ok: false, error: "empty-message" };
  if (message.length > MAX_FEEDBACK_MESSAGE_LENGTH) {
    return { ok: false, error: "message-too-long" };
  }
  return { ok: true, category, message };
}

export function updateFeedbackStatusInList<T extends { id: string; status: BetaFeedbackStatus; updatedAt?: number }>(
  rows: T[],
  feedbackId: string,
  status: BetaFeedbackStatus,
  updatedAt: number
): T[] {
  return rows.map((row) =>
    row.id === feedbackId
      ? { ...row, status, updatedAt }
      : row
  );
}
