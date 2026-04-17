import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// ── CORS helpers for Chrome extension ──────────────────────────────────────────
// In dev, allow any chrome-extension:// origin.
// In prod, echo only the published extension ID (set EXTENSION_ID env var).
// TODO: tighten EXTENSION_ID after Chrome Web Store submission.
function extensionCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isDev = process.env.NODE_ENV !== "production";
  const allowedOrigin = isDev
    ? (origin.startsWith("chrome-extension://") ? origin : "")
    : (origin === `chrome-extension://${process.env.EXTENSION_ID ?? ""}` ? origin : "");
  if (!allowedOrigin) return {};
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: Request) {
  const headers = extensionCorsHeaders(req);
  if (!headers["Access-Control-Allow-Origin"]) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, { status: 204, headers });
}
// ──────────────────────────────────────────────────────────────────────────────

const MAX_CONTENT = 10_000;
const PROJECT_RE = /^[a-zA-Z0-9_-]{6,64}$/;
const MAX_TAGS = 10;

type Parsed = {
  content: string;
  projectId: string | null;
  tags?: string[];
  error?: string;
};

function normalizeCaptureFields(
  content: string,
  projectRaw: string | null,
  tagsRaw: string | null
): Parsed {
  const trimmed = content.trim();
  if (!trimmed) {
    return { content: "", projectId: null, error: "content_required" };
  }
  if (trimmed.length > MAX_CONTENT) {
    return { content: "", projectId: null, error: "content_too_long" };
  }

  let projectId: string | null = null;
  if (projectRaw != null && projectRaw.trim() !== "") {
    const p = projectRaw.trim();
    if (!PROJECT_RE.test(p)) {
      return { content: "", projectId: null, error: "invalid_project" };
    }
    projectId = p;
  }

  let tags: string[] | undefined;
  if (tagsRaw != null && tagsRaw.trim() !== "") {
    tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > MAX_TAGS) {
      return { content: "", projectId: null, error: "too_many_tags" };
    }
  }

  return { content: trimmed, projectId, tags };
}

async function parseCaptureInput(req: Request, url: URL): Promise<Parsed> {
  const method = req.method.toUpperCase();
  if (method === "GET") {
    const content =
      url.searchParams.get("content") ??
      url.searchParams.get("text") ??
      url.searchParams.get("q") ??
      "";
    return normalizeCaptureFields(
      content,
      url.searchParams.get("project"),
      url.searchParams.get("tags")
    );
  }

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json()) as Record<string, unknown>;
    const content =
      typeof body.content === "string"
        ? body.content
        : typeof body.text === "string"
          ? body.text
          : "";
    const projectRaw =
      typeof body.project === "string" ? body.project : null;
    const tagsRaw =
      typeof body.tags === "string"
        ? body.tags
        : Array.isArray(body.tags)
          ? (body.tags as string[]).join(",")
          : null;
    return normalizeCaptureFields(content, projectRaw, tagsRaw);
  }

  const fd = await req.formData();
  const content = String(fd.get("content") ?? fd.get("text") ?? fd.get("q") ?? "");
  const projectRaw = fd.get("project");
  const tagsRaw = fd.get("tags");
  return normalizeCaptureFields(
    content,
    typeof projectRaw === "string" ? projectRaw : null,
    typeof tagsRaw === "string" ? tagsRaw : null
  );
}

function redirectSignIn(req: Request): Response {
  const url = new URL(req.url);
  const dest = `${url.pathname}${url.search}`;
  const signIn = new URL("/sign-in", url.origin);
  signIn.searchParams.set("redirect_url", dest);
  return Response.redirect(signIn.toString(), 302);
}

function successRedirect(
  origin: string,
  projectConvexId: string | null,
  wantsJson: boolean,
  noteId: string
): Response {
  if (wantsJson) {
    return Response.json({ success: true, id: noteId }, { status: 200 });
  }
  const path = projectConvexId
    ? `/app/p/${encodeURIComponent(projectConvexId)}`
    : "/app";
  const u = new URL(path, origin);
  u.searchParams.set("toast", "captured");
  return Response.redirect(u.toString(), 302);
}

function errorResponse(
  wantsJson: boolean,
  code: string,
  status: number
): Response {
  if (wantsJson) {
    return Response.json({ success: false, error: code }, { status });
  }
  return new Response(code.replace(/_/g, " "), {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function handleCapture(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const accept = req.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");

  const { userId, getToken } = await auth();
  if (!userId) {
    return redirectSignIn(req);
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return Response.json(
      { success: false, error: "missing_convex_token" },
      { status: 401 }
    );
  }

  const input = await parseCaptureInput(req, url);

  if (input.error) {
    return errorResponse(wantsJson, input.error, 400);
  }

  let projectConvexId: string | null = null;
  if (input.projectId) {
    let proj;
    try {
      proj = await fetchQuery(
        api.objects.getIfOwner,
        { id: input.projectId as Id<"objects"> },
        { token }
      );
    } catch {
      return errorResponse(wantsJson, "invalid_project", 400);
    }
    if (!proj || proj.kind !== "project") {
      return errorResponse(wantsJson, "invalid_project", 400);
    }
    projectConvexId = String(proj._id);
  }

  const now = Date.now();
  try {
    const noteId = await fetchMutation(
      api.objects.put,
      {
        kind: "note",
        content: input.content,
        maturity: "fleeting",
        createdAt: now,
        modifiedAt: now,
        projectId: projectConvexId,
        tags: input.tags,
      },
      { token }
    );

    return successRedirect(url.origin, projectConvexId, wantsJson, String(noteId));
  } catch (e) {
    console.error("[capture]", e);
    return errorResponse(wantsJson, "capture_failed", 500);
  }
}

function withCors(req: Request, res: Response): Response {
  const corsHdrs = extensionCorsHeaders(req);
  if (!corsHdrs["Access-Control-Allow-Origin"]) return res;
  const next = new Response(res.body, res);
  Object.entries(corsHdrs).forEach(([k, v]) => next.headers.set(k, v));
  return next;
}

export async function GET(req: Request) {
  return withCors(req, await handleCapture(req));
}

export async function POST(req: Request) {
  return withCors(req, await handleCapture(req));
}
