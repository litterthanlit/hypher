import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createHypherClerkMiddleware,
  isClerkOptionalOAuthProtocolPath,
  resolveClerkMiddlewareKeys,
  shouldBypassFailedClerkForOAuthProtocol,
} from "./hypherClerkMiddleware";

function request(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://hypher.app"));
}

function event(): NextFetchEvent {
  return {} as NextFetchEvent;
}

describe("resolveClerkMiddlewareKeys", () => {
  it("prefers CLERK_PUBLISHABLE_KEY over NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", () => {
    expect(
      resolveClerkMiddlewareKeys({
        CLERK_PUBLISHABLE_KEY: " pk_from_clerk ",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_from_next_public",
        CLERK_SECRET_KEY: " sk_live ",
      })
    ).toEqual({
      publishableKey: "pk_from_clerk",
      secretKey: "sk_live",
    });
  });

  it("accepts NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY when CLERK_PUBLISHABLE_KEY is absent", () => {
    expect(
      resolveClerkMiddlewareKeys({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_from_next_public",
        CLERK_SECRET_KEY: "sk_test",
      })
    ).toEqual({
      publishableKey: "pk_from_next_public",
      secretKey: "sk_test",
    });
  });

  it("treats blank publishable keys as missing", () => {
    expect(
      resolveClerkMiddlewareKeys({
        CLERK_PUBLISHABLE_KEY: "   ",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
        CLERK_SECRET_KEY: "sk_test",
      })
    ).toEqual({
      publishableKey: undefined,
      secretKey: "sk_test",
    });
  });

  it("treats blank secret keys as missing", () => {
    expect(
      resolveClerkMiddlewareKeys({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_from_next_public",
        CLERK_SECRET_KEY: "   ",
      })
    ).toEqual({
      publishableKey: "pk_from_next_public",
      secretKey: undefined,
    });
  });
});

describe("createHypherClerkMiddleware", () => {
  it("does not throw on a public path when publishableKey is missing", async () => {
    const createClerk = vi.fn(() => {
      throw new Error("@clerk/nextjs: Missing publishableKey");
    });
    const middleware = createHypherClerkMiddleware(
      {},
      async () => {
        throw new Error("handler should not run without keys");
      },
      createClerk
    );

    expect(createClerk).not.toHaveBeenCalled();
    expect(() => middleware(request("/"), event())).not.toThrow();
    expect(middleware(request("/"), event())).toMatchObject({ status: 200 });
    expect(middleware(request("/pricing"), event())).toMatchObject({ status: 200 });
  });

  it("does not throw on a public path when secretKey is missing", async () => {
    const createClerk = vi.fn(() => {
      throw new Error("@clerk/nextjs: Missing secretKey");
    });
    const middleware = createHypherClerkMiddleware(
      { publishableKey: "pk_test_preview" },
      async () => {
        throw new Error("handler should not run without a secret key");
      },
      createClerk
    );

    expect(createClerk).not.toHaveBeenCalled();
    expect(() => middleware(request("/"), event())).not.toThrow();
    expect(middleware(request("/"), event())).toMatchObject({ status: 200 });
    expect(middleware(request("/pricing"), event())).toMatchObject({ status: 200 });
    expect(middleware(request("/beta/request"), event())).toMatchObject({ status: 200 });
  });

  it("passes explicit keys to clerkMiddleware and still protects non-public routes", async () => {
    const protect = vi.fn(async () => undefined);
    const createClerk = vi.fn((handler, options) => {
      return async (req: NextRequest, evt: NextFetchEvent) => {
        await handler({ protect } as never, req, evt);
        return new Response(null, { status: 200 });
      };
    });

    const middleware = createHypherClerkMiddleware(
      { publishableKey: "pk_test_explicit", secretKey: "sk_test_explicit" },
      async (auth, req) => {
        if (req.nextUrl.pathname !== "/" && req.nextUrl.pathname !== "/pricing") {
          await auth.protect();
        }
      },
      createClerk as never
    );

    expect(createClerk).toHaveBeenCalledWith(expect.any(Function), {
      publishableKey: "pk_test_explicit",
      secretKey: "sk_test_explicit",
    });

    await middleware(request("/"), event());
    expect(protect).not.toHaveBeenCalled();

    await middleware(request("/settings"), event());
    expect(protect).toHaveBeenCalledTimes(1);
  });

  it("lets OAuth authorize, token, and well-known survive a Clerk 400 without weakening other routes", async () => {
    expect(isClerkOptionalOAuthProtocolPath("/oauth/authorize")).toBe(true);
    expect(isClerkOptionalOAuthProtocolPath("/oauth/token")).toBe(true);
    expect(isClerkOptionalOAuthProtocolPath("/oauth/register")).toBe(true);
    expect(isClerkOptionalOAuthProtocolPath("/mcp")).toBe(true);
    expect(isClerkOptionalOAuthProtocolPath("/api/mcp")).toBe(true);
    expect(isClerkOptionalOAuthProtocolPath("/.well-known/oauth-protected-resource/api/mcp")).toBe(
      true
    );
    expect(isClerkOptionalOAuthProtocolPath("/oauth/consent")).toBe(false);
    expect(isClerkOptionalOAuthProtocolPath("/app")).toBe(false);
    expect(shouldBypassFailedClerkForOAuthProtocol("/oauth/authorize", 400)).toBe(true);
    expect(shouldBypassFailedClerkForOAuthProtocol("/settings", 400)).toBe(false);

    const createClerk = vi.fn(() => {
      return async (req: NextRequest) => {
        if (
          req.nextUrl.pathname === "/oauth/authorize" ||
          req.nextUrl.pathname === "/oauth/token" ||
          req.nextUrl.pathname === "/oauth/register" ||
          req.nextUrl.pathname === "/mcp" ||
          req.nextUrl.pathname === "/api/mcp"
        ) {
          return new Response("clerk-bad-request", { status: 400 });
        }
        if (req.nextUrl.pathname.startsWith("/.well-known/")) {
          return new Response("clerk-bad-request", { status: 400 });
        }
        return new Response("blocked", { status: 400 });
      };
    });

    const middleware = createHypherClerkMiddleware(
      { publishableKey: "pk_test_explicit", secretKey: "sk_test_explicit" },
      async () => undefined,
      createClerk as never
    );

    async function statusOf(path: string): Promise<number> {
      const response = await middleware(request(path), event());
      expect(response).toBeDefined();
      return response!.status;
    }

    expect(await statusOf("/oauth/authorize")).toBe(200);
    expect(await statusOf("/oauth/token")).toBe(200);
    expect(await statusOf("/oauth/register")).toBe(200);
    expect(await statusOf("/mcp")).toBe(200);
    expect(await statusOf("/api/mcp")).toBe(200);
    expect(await statusOf("/.well-known/oauth-protected-resource/api/mcp")).toBe(200);
    expect(await statusOf("/settings")).toBe(400);
    expect(await statusOf("/oauth/consent")).toBe(400);
  });
});
