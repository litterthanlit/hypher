import { NextResponse } from "next/server";
import { buildLaunchReadiness } from "@/lib/launchReadiness";
import { authErrorJson, requireAdmin } from "@/lib/serverAuth";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return authErrorJson(error) as NextResponse;
  }

  return NextResponse.json(buildLaunchReadiness(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
