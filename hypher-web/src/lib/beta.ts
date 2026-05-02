export type BetaFeedbackCategory = "bug" | "friction" | "idea" | "praise";
export type BetaFeedbackStatus = "new" | "reviewed" | "closed";
export type BetaRequestStatus = "pending" | "approved" | "rejected" | "archived";

export interface BetaGateState {
  gateEnabled: boolean;
  hasAccess: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  accessGrantedAt?: number;
}

export interface BetaRequestInput {
  name: string;
  email: string;
  role: string;
  work: string;
  pain: string;
  link?: string;
  howFound: string;
  website?: string;
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
export const BETA_REQUEST_STATUSES: BetaRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "archived",
];

export const BETA_REQUEST_LIMITS = {
  name: 80,
  email: 160,
  role: 120,
  work: 500,
  pain: 500,
  link: 220,
  howFound: 240,
  adminNotes: 1000,
  idealUserType: 80,
} as const;

export function normalizeInviteCode(input: string): string {
  return input.replace(/\s+/g, "").trim().toUpperCase();
}

export function normalizeBetaRequestEmail(input: string): string {
  return input.trim().toLowerCase();
}

function trimLimit(input: string | undefined, limit: number): string {
  return (input ?? "").trim().slice(0, limit);
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
  isAuthenticated?: boolean;
  accessGrantedAt?: number;
}): BetaGateState {
  return {
    gateEnabled: args.gateEnabled,
    isAdmin: args.isAdmin,
    isAuthenticated: args.isAuthenticated ?? true,
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

export function validateBetaRequestInput(input: BetaRequestInput):
  | {
      ok: true;
      request: {
        name: string;
        email: string;
        emailNorm: string;
        role: string;
        work: string;
        pain: string;
        link?: string;
        howFound: string;
      };
    }
  | { ok: false; error: string } {
  if (input.website?.trim()) return { ok: false, error: "bot-field" };

  const name = trimLimit(input.name, BETA_REQUEST_LIMITS.name);
  const email = trimLimit(input.email, BETA_REQUEST_LIMITS.email);
  const emailNorm = normalizeBetaRequestEmail(email);
  const role = trimLimit(input.role, BETA_REQUEST_LIMITS.role);
  const work = trimLimit(input.work, BETA_REQUEST_LIMITS.work);
  const pain = trimLimit(input.pain, BETA_REQUEST_LIMITS.pain);
  const link = trimLimit(input.link, BETA_REQUEST_LIMITS.link);
  const howFound = trimLimit(input.howFound, BETA_REQUEST_LIMITS.howFound);

  if (!name) return { ok: false, error: "name-required" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return { ok: false, error: "email-invalid" };
  }
  if (!role) return { ok: false, error: "role-required" };
  if (!work) return { ok: false, error: "work-required" };
  if (!pain) return { ok: false, error: "pain-required" };
  if (!howFound) return { ok: false, error: "how-found-required" };

  return {
    ok: true,
    request: {
      name,
      email,
      emailNorm,
      role,
      work,
      pain,
      ...(link ? { link } : {}),
      howFound,
    },
  };
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

export function updateBetaRequestStatusInList<T extends { id: string; status: BetaRequestStatus; updatedAt?: number }>(
  rows: T[],
  requestId: string,
  status: BetaRequestStatus,
  updatedAt: number
): T[] {
  return rows.map((row) =>
    row.id === requestId
      ? { ...row, status, updatedAt }
      : row
  );
}
