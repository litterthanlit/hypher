/**
 * POST /api/notion-import — runs the Notion import Convex action for the signed-in user.
 *
 * The WelcomeDialog hits this after OAuth completes; the action reads the stored
 * token, fetches up to 50 pages, and inserts them as Hypher objects while
 * streaming progress via userMeta.notionImportProgress.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchAction } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const { userId, getToken } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return NextResponse.json({ error: "missing_convex_token" }, { status: 401 });
  }

  try {
    const result = await fetchAction(api.notion.importFromNotion, {}, { token });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : "import_failed";
    console.error("[api/notion-import]", e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
