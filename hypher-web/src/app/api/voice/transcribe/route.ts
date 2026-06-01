import { NextRequest, NextResponse } from "next/server";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";
import { ratelimitUser } from "@/lib/rateLimit";
import {
  MAX_VOICE_CAPTURE_BYTES,
  OPENAI_TRANSCRIBE_MODEL,
  buildVoiceCapturePrompt,
  getTranscriptionText,
  validateVoiceFile,
} from "@/lib/voiceCapture";

export const runtime = "nodejs";

const MULTIPART_OVERHEAD_BYTES = 512_000;

export async function POST(req: NextRequest) {
  let session: { userId: string };
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error);
  }

  const allowed = await ratelimitUser(session.userId, "voice-transcribe", { requests: 30, window: "1h" });
  if (!allowed) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > MAX_VOICE_CAPTURE_BYTES + MULTIPART_OVERHEAD_BYTES) {
    return NextResponse.json({ error: "audio-too-large" }, { status: 413 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no-openai-api-key" }, { status: 503 });
  }

  let audio: FormDataEntryValue | null;
  try {
    const form = await req.formData();
    audio = form.get("audio");
  } catch (error) {
    console.error("[api/voice/transcribe] bad multipart body", error);
    return NextResponse.json({ error: "bad-body" }, { status: 400 });
  }

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: "missing-audio" }, { status: 400 });
  }

  const validation = validateVoiceFile(audio);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }

  const upstreamForm = new FormData();
  upstreamForm.append("model", OPENAI_TRANSCRIBE_MODEL);
  upstreamForm.append("file", audio, audio.name || "hypher-voice.webm");
  upstreamForm.append("response_format", "json");
  upstreamForm.append("prompt", buildVoiceCapturePrompt());

  let upstream: Response;
  try {
    upstream = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: upstreamForm,
    });
  } catch (error) {
    console.error("[api/voice/transcribe] OpenAI request failed", error);
    return NextResponse.json({ error: "transcription-unavailable" }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => "");
    console.error("[api/voice/transcribe] OpenAI error", upstream.status, detail.slice(0, 500));
    return NextResponse.json({ error: "transcription-failed" }, { status: 502 });
  }

  const payload = await upstream.json().catch(() => null);
  const transcript = getTranscriptionText(payload);
  if (!transcript) {
    return NextResponse.json({ error: "empty-transcript" }, { status: 422 });
  }

  return NextResponse.json({
    text: transcript,
    transcript,
    model: OPENAI_TRANSCRIBE_MODEL,
  });
}
