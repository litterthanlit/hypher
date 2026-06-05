import { fetchAction, fetchMutation, fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { AnyObject, Connection, Note, ProjectSuggestion } from "@/types";
import { getDisplayName } from "@/types";
import {
  computeSuggestionsForObject,
  generateEmbedding,
  suggestProjectFromData,
} from "@/lib/engine";
import { isRequestBodyTooLarge, readJsonWithLimit, readTextWithLimit } from "@/lib/requestBody";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";
import {
  enrichCapture,
  normalizeCaptureInput,
  prepareCaptureObject,
  safeEnrichCapture,
  type CaptureInputError,
  type CaptureEnrichmentResult,
} from "../../../shared/capture";

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

type Parsed = {
  content: string;
  projectId: string | null;
  tags: string[] | undefined;
  ok: true;
} | { ok: false; error: CaptureInputError | "too_large" };

function mapObject(doc: any): AnyObject {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as AnyObject;
}

function mapConnection(doc: any): Connection {
  const { _id, _creationTime, ...rest } = doc;
  return { ...rest, id: String(_id) } as Connection;
}

async function parseCaptureInput(req: Request, url: URL): Promise<Parsed> {
  const method = req.method.toUpperCase();
  if (method === "GET") {
    return normalizeCaptureInput({
      content: url.searchParams.get("content"),
      text: url.searchParams.get("text"),
      q: url.searchParams.get("q"),
      project: url.searchParams.get("project"),
      projectId: url.searchParams.get("projectId"),
      tags: url.searchParams.get("tags"),
    });
  }

  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = await readJsonWithLimit<Record<string, unknown>>(req, MAX_CAPTURE_BODY_BYTES);
    } catch (error) {
      if (isRequestBodyTooLarge(error)) {
        return { ok: false, error: "too_large" };
      }
      throw error;
    }
    return normalizeCaptureInput({
      content: body.content,
      text: body.text,
      project: body.project,
      projectId: body.projectId,
      tags: body.tags,
    });
  }

  if (ct.includes("application/x-www-form-urlencoded")) {
    let body: URLSearchParams;
    try {
      body = new URLSearchParams(await readTextWithLimit(req, MAX_CAPTURE_BODY_BYTES));
    } catch (error) {
      if (isRequestBodyTooLarge(error)) {
        return { ok: false, error: "too_large" };
      }
      throw error;
    }
    return normalizeCaptureInput({
      content: body.get("content"),
      text: body.get("text"),
      q: body.get("q"),
      project: body.get("project"),
      projectId: body.get("projectId"),
      tags: body.get("tags"),
    });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_CAPTURE_BODY_BYTES) {
    return { ok: false, error: "too_large" };
  }

  const fd = await req.formData();
  const contentField = fd.get("content") ?? fd.get("text") ?? fd.get("q") ?? "";
  const projectField = fd.get("project");
  const projectIdField = fd.get("projectId");
  const tagsField = fd.get("tags");
  return normalizeCaptureInput({
    content: typeof contentField === "string" ? contentField : String(contentField),
    project: typeof projectField === "string" ? projectField : null,
    projectId: typeof projectIdField === "string" ? projectIdField : null,
    tags: typeof tagsField === "string" ? tagsField : null,
  });
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
}): Promise<CaptureEnrichmentResult> {
  const [rawObjects, rawConnections] = await Promise.all([
    fetchQuery(api.objects.list, {}, { token: params.token }),
    fetchQuery(api.connections.list, {}, { token: params.token }),
  ]);

  const enrichment = await enrichCapture({
    capture: params.note,
    allObjects: rawObjects.map(mapObject),
    connections: rawConnections.map(mapConnection),
    projectId: params.projectConvexId,
    embedCapture: generateEmbedding,
    generateTags: (content) =>
      fetchAction(api.ai.generateTags, { content }, { token: params.token })
        .catch(() => [] as string[]),
    suggestProjects: suggestProjectFromData,
    computeConnections: computeSuggestionsForObject,
  });
  const embedded = enrichment.capture ?? params.note;

  await fetchMutation(
    api.objects.put,
    {
      id: params.note.id as Id<"objects">,
      kind: "note",
      content: embedded.content,
      maturity: embedded.maturity,
      createdAt: embedded.createdAt,
      modifiedAt: embedded.modifiedAt,
      projectId: embedded.projectId ?? null,
      reviewedAt: embedded.reviewedAt,
      embedding: embedded.embedding,
      embeddingText: embedded.embeddingText,
      tags: embedded.tags,
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

  await Promise.all(
    enrichment.connectionsToCreate.map((conn) =>
      fetchMutation(api.connections.put, conn, { token: params.token })
    )
  );

  return enrichment;
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

  if (!input.ok) {
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
    const prepared = prepareCaptureObject({
      content: input.content,
      projectId: projectConvexId,
      now,
      tags: input.tags,
      includeClientFields: false,
    });
    const { id: _preparedId, ...preparedInsert } = prepared;

    const noteId = await fetchMutation(
      api.objects.put,
      preparedInsert,
      { token }
    );

    const note: Note = {
      id: String(noteId),
      ...preparedInsert,
    };

    const enrichment = await safeEnrichCapture(
      () => enrichCapturedNote({ token, note, projectConvexId }),
      (error) => console.error("[capture:enrich]", error)
    );

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
