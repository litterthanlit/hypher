import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
}

export async function GET(req: NextRequest) {
  const resource = baseUrl(req);

  return NextResponse.json({
    resource,
    authorization_servers: [process.env.HYPHER_OAUTH_ISSUER || resource],
    scopes_supported: ["hypher.projects.read"],
    resource_documentation: `${resource}/api/mcp`,
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
