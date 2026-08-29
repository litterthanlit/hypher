import { NextRequest, type NextFetchEvent } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  createHypherClerkMiddleware,
  resolveClerkMiddlewareKeys,
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
});
