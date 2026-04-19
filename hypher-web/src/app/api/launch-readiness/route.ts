import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { buildLaunchReadiness } from "@/lib/launchReadiness";

export const runtime = "nodejs";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauth" }, { status: 401 });
  }

  return NextResponse.json(buildLaunchReadiness(process.env), {
    headers: { "Cache-Control": "no-store" },
  });
}
