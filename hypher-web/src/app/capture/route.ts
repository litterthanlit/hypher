import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AnyObject, Connection, Note, ProjectSuggestion } from "@/types";
import { getDisplayName } from "@/types";
import {
  computeSuggestionsFromData,
  generateEmbedding,
  suggestProjectFromData,
} from "@/lib/engine";
import { isRequestBodyTooLarge, readJsonWithLimit, readTextWithLimit } from "@/lib/requestBody";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";

export const runtime = "nodejs";
const MAX_CAPTURE_BODY_BYTES = 25_000;

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

function mapObject(doc: any): AnyObject {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as AnyObject;
}

function mapConnection(doc: any): Connection {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as Connection;
}

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
    let body: Record<string, unknown>;
    try {
      body = await readJsonWithLimit<Record<string, unknown>>(req, MAX_CAPTURE_BODY_BYTES);
    } catch (error) {
      if (isRequestBodyTooLarge(error)) {
        return { content: "", projectId: null, error: "too_large" };
      }
      throw error;
    }
    const content =
      typeof body.content === "string"
        ? body.content
        : typeof body.text === "string"
          ? body.text
          : "";
    const projectRaw =
      typeof body.project === "string"
        ? body.project
        : typeof body.projectId === "string"
          ? body.projectId
          : null;
    const tagsRaw =
      typeof body.tags === "string"
        ? body.tags
        : Array.isArray(body.tags)
          ? (body.tags as string[]).join(",")
          : null;
    return normalizeCaptureFields(content, projectRaw, tagsRaw);
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    let body: URLSearchParams;
    try {
      body = new URLSearchParams(await readTextWithLimit(req, MAX_CAPTURE_BODY_BYTES));
    } catch (error) {
      if (isRequestBodyTooLarge(error)) {
        return { content: "", projectId: null, error: "too_large" };
      }
      throw error;
    }
    return normalizeCaptureFields(
      body.get("content") ?? body.get("text") ?? body.get("q") ?? "",
      body.get("project"),
      body.get("tags")
    );
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_CAPTURE_BODY_BYTES) {
    return { content: "", projectId: null, error: "too_large" };
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
  noteId: string,
  enrichment: { enriched: boolean; suggestions?: ProjectSuggestion[] }
): Response {
  if (wantsJson) {
    return Response.json(
      {
        success: true,
        id: noteId,
        enriched: enrichment.enriched,
        suggestions: enrichment.suggestions ?? [],
      },
      { status: 200 }
    );
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

async function enrichCapturedNote(params: {
  token: string;
  note: Note;
  projectConvexId: string | null;
}): Promise<{ enriched: boolean; suggestions: ProjectSuggestion[] }> {
  const [embedded, generatedTags] = await Promise.all([
    generateEmbedding(params.note),
    params.note.tags?.length || params.note.content.length < 10
      ? Promise.resolve([] as string[])
      : fetchAction(api.ai.generateTags, { content: params.note.content }, { token: params.token }).catch(() => [] as string[]),
  ]);

  const tags = params.note.tags?.length
    ? params.note.tags
    : generatedTags.length > 0
      ? generatedTags
      : undefined;

  await fetchMutation(
    api.objects.put,
    {
      id: params.note.id as Id<"objects">,
      kind: "note",
      content: params.note.content,
      maturity: params.note.maturity,
      createdAt: params.note.createdAt,
      modifiedAt: embedded.modifiedAt,
      projectId: params.note.projectId ?? null,
      reviewedAt: params.note.reviewedAt,
      embedding: embedded.embedding,
      embeddingText: embedded.embeddingText,
      tags,
    },
    { token: params.token }
  );

  await fetchMutation(
    api.activity.put,
    {
      action: "created",
      objectId: params.note.id,
      objectKind: "note",
      objectName: getDisplayName(params.note),
      timestamp: params.note.createdAt,
      projectId: params.projectConvexId ?? undefined,
      activityType: "capture",
    },
    { token: params.token }
  );

  if (params.projectConvexId) {
    await fetchMutation(
      api.objects.touchLastActivity,
      {
        id: params.projectConvexId as Id<"objects">,
        timestamp: params.note.createdAt,
      },
      { token: params.token }
    );
  }

  const [rawObjects, rawConnections] = await Promise.all([
    fetchQuery(api.objects.list, {}, { token: params.token }),
    fetchQuery(api.connections.list, {}, { token: params.token }),
  ]);
  const allObjects = rawObjects
    .map(mapObject)
    .map((obj) => (obj.id === params.note.id ? embedded : obj));
  const connections = rawConnections.map(mapConnection);

  const suggestions =
    params.projectConvexId || !embedded.embedding
      ? []
      : suggestProjectFromData(embedded, allObjects);

  const newConnections = computeSuggestionsFromData(allObjects, connections);
  await Promise.all(
    newConnections.map((conn) =>
      fetchMutation(api.connections.put, conn, { token: params.token })
    )
  );

  return { enriched: true, suggestions };
}

async function handleCapture(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const accept = req.headers.get("accept") ?? "";
  const wantsJson = accept.includes("application/json");

  let session;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    if (error instanceof Error && error.message === "unauth") {
      return redirectSignIn(req);
    }
    return authErrorJson(error);
  }

  if (!session.userId) {
    return redirectSignIn(req);
  }

  const token = session.convexToken;
  if (!token) {
    return Response.json(
      { success: false, error: "missing_convex_token" },
      { status: 401 }
    );
  }

  const input = await parseCaptureInput(req, url);

  if (input.error) {
    if (input.error === "too_large") {
      return errorResponse(wantsJson, input.error, 413);
    }
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
        ...(projectConvexId ? { reviewedAt: now } : {}),
        tags: input.tags,
      },
      { token }
    );

    const note: Note = {
      id: String(noteId),
      kind: "note",
      content: input.content,
      maturity: "fleeting",
      createdAt: now,
      modifiedAt: now,
      projectId: projectConvexId,
      tags: input.tags,
      ...(projectConvexId ? { reviewedAt: now } : {}),
    };

    let enrichment: { enriched: boolean; suggestions?: ProjectSuggestion[] } = { enriched: false, suggestions: [] };
    try {
      enrichment = await enrichCapturedNote({ token, note, projectConvexId });
    } catch (e) {
      console.error("[capture:enrich]", e);
    }

    return successRedirect(url.origin, projectConvexId, wantsJson, String(noteId), enrichment);
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
