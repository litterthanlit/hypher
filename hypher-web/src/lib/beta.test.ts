import { describe, expect, it } from "vitest";
import {
  getBetaGateState,
  isBetaAdmin,
  normalizeInviteCode,
  splitInviteCode,
  updateBetaRequestStatusInList,
  updateFeedbackStatusInList,
  validateBetaRequestInput,
  validateFeedbackInput,
  validateInviteForRedemption,
} from "./beta";

describe("beta invite helpers", () => {
  it("normalizes pasted invite codes with whitespace", () => {
    expect(normalizeInviteCode(" hyp-abc1 2345-xyz ")).toBe("HYP-ABC12345-XYZ");
  });

  it("splits a valid code without keeping the plaintext code as one value", () => {
    const parts = splitInviteCode("HYP-ABCD-EFGH-IJKL-MNOP");
    expect(parts).toEqual({
      prefix: "HYPABCDEFG",
      remainder: "HIJKLMNOP",
    });
    expect(JSON.stringify(parts)).not.toContain("HYP-ABCD-EFGH-IJKL-MNOP");
  });

  it("rejects malformed codes", () => {
    expect(splitInviteCode("hello")).toBeNull();
  });

  it("classifies invite redemption failures", () => {
    const base = { maxRedemptions: 2, redemptionCount: 0 };
    expect(validateInviteForRedemption(base, 100)).toBe("ok");
    expect(validateInviteForRedemption({ ...base, revokedAt: 99 }, 100)).toBe("revoked");
    expect(validateInviteForRedemption({ ...base, expiresAt: 100 }, 100)).toBe("expired");
    expect(validateInviteForRedemption({ ...base, redemptionCount: 2 }, 100)).toBe("exhausted");
  });
});

describe("beta gate helpers", () => {
  it("lets admins bypass the gate", () => {
    expect(isBetaAdmin("user_1", "user_2,user_1")).toBe(true);
    expect(getBetaGateState({ gateEnabled: true, isAdmin: true }).hasAccess).toBe(true);
  });

  it("gates non-admins without access", () => {
    expect(getBetaGateState({ gateEnabled: true, isAdmin: false }).hasAccess).toBe(false);
  });

  it("allows users with granted access", () => {
    expect(
      getBetaGateState({
        gateEnabled: true,
        isAdmin: false,
        accessGrantedAt: 1_700_000_000_000,
      })
    ).toMatchObject({ hasAccess: true, accessGrantedAt: 1_700_000_000_000 });
  });

  it("allows everyone when the gate is disabled", () => {
    expect(getBetaGateState({ gateEnabled: false, isAdmin: false }).hasAccess).toBe(true);
  });
});

describe("beta feedback helpers", () => {
  it("accepts valid categories", () => {
    expect(validateFeedbackInput({ category: "bug", message: "Something broke" })).toEqual({
      ok: true,
      category: "bug",
      message: "Something broke",
    });
  });

  it("rejects empty feedback", () => {
    expect(validateFeedbackInput({ category: "idea", message: "   " })).toEqual({
      ok: false,
      error: "empty-message",
    });
  });

  it("rejects oversized feedback", () => {
    expect(validateFeedbackInput({ category: "praise", message: "x".repeat(2001) })).toEqual({
      ok: false,
      error: "message-too-long",
    });
  });

  it("rejects unknown categories", () => {
    expect(validateFeedbackInput({ category: "other", message: "hi" })).toEqual({
      ok: false,
      error: "bad-category",
    });
  });

  it("updates only the selected feedback row status", () => {
    const rows = [
      { id: "f1", status: "new" as const, updatedAt: 1 },
      { id: "f2", status: "new" as const, updatedAt: 1 },
    ];
    expect(updateFeedbackStatusInList(rows, "f2", "closed", 2)).toEqual([
      { id: "f1", status: "new", updatedAt: 1 },
      { id: "f2", status: "closed", updatedAt: 2 },
    ]);
  });
});

describe("beta request helpers", () => {
  const validRequest = {
    name: "Nick",
    email: "NICK@EXAMPLE.COM ",
    role: "Solo founder",
    work: "Building Hypher",
    pain: "Project context is scattered.",
    link: "https://example.com",
    howFound: "X",
  };

  it("normalizes valid beta requests", () => {
    expect(validateBetaRequestInput(validRequest)).toEqual({
      ok: true,
      request: {
        name: "Nick",
        email: "NICK@EXAMPLE.COM",
        emailNorm: "nick@example.com",
        role: "Solo founder",
        work: "Building Hypher",
        pain: "Project context is scattered.",
        link: "https://example.com",
        howFound: "X",
      },
    });
  });

  it("rejects invalid request email", () => {
    expect(validateBetaRequestInput({ ...validRequest, email: "not-email" })).toEqual({
      ok: false,
      error: "email-invalid",
    });
  });

  it("rejects honeypot submissions", () => {
    expect(validateBetaRequestInput({ ...validRequest, website: "spam" })).toEqual({
      ok: false,
      error: "bot-field",
    });
  });

  it("updates only the selected request row status", () => {
    const rows = [
      { id: "r1", status: "pending" as const, updatedAt: 1 },
      { id: "r2", status: "pending" as const, updatedAt: 1 },
    ];
    expect(updateBetaRequestStatusInList(rows, "r2", "approved", 2)).toEqual([
      { id: "r1", status: "pending", updatedAt: 1 },
      { id: "r2", status: "approved", updatedAt: 2 },
    ]);
  });
});
