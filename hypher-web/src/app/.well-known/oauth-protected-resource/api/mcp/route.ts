import { NextRequest, NextResponse } from "next/server";
import { baseUrlFromRequest, buildMcpProtectedResourceMetadata } from "@/lib/oauthBridge";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return NextResponse.json(buildMcpProtectedResourceMetadata(baseUrlFromRequest(req.url)), {
    headers: { "Cache-Control": "no-store" },
  });
}
