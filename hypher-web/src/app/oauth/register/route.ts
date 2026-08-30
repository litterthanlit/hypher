import { NextRequest, NextResponse } from "next/server";
import {
  registerPublicGrokOAuthClient,
  type DynamicClientRegistrationRequest,
} from "@/lib/oauthBridge";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 10_000;

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await readJsonWithLimit(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return oauthError("invalid_request", "Request body is too large.", 413);
    }
    return oauthError("invalid_request", "Invalid request body.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return oauthError("invalid_request", "Invalid request body.");
  }

  const result = registerPublicGrokOAuthClient(body as DynamicClientRegistrationRequest);
  if (!result.ok) {
    return oauthError(result.error, result.error_description);
  }

  return NextResponse.json(result.client, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
