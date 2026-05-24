import { describe, expect, it } from "vitest";
import {
  isRequestBodyTooLarge,
  readJsonWithLimit,
  readTextWithLimit,
} from "./requestBody";

describe("bounded request body reader", () => {
  it("parses JSON inside the byte limit", async () => {
    const req = new Request("https://hypher.test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });

    await expect(readJsonWithLimit(req, 100)).resolves.toEqual({ ok: true });
  });

  it("rejects bodies over the byte limit without parsing", async () => {
    const req = new Request("https://hypher.test", {
      method: "POST",
      body: "x".repeat(20),
    });

    await expect(readTextWithLimit(req, 10)).rejects.toSatisfy(isRequestBodyTooLarge);
  });
});
