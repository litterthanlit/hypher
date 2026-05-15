import { NextRequest, NextResponse } from "next/server";
import { baseUrlFromRequest, buildOAuthMetadata } from "@/lib/oauthBridge";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return NextResponse.json(buildOAuthMetadata(baseUrlFromRequest(req.url)), {
    headers: { "Cache-Control": "no-store" },
  });
}
