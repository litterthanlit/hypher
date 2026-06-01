export const OPENAI_TRANSCRIBE_MODEL = "gpt-4o-transcribe";
export const MAX_VOICE_CAPTURE_BYTES = 25 * 1024 * 1024;

const SUPPORTED_AUDIO_MIME_TYPES = new Set([
  "audio/mp3",
  "audio/mpeg",
  "audio/mp4",
  "audio/mpga",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "video/mp4",
  "video/webm",
]);

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  "mp3",
  "mp4",
  "mpeg",
  "mpga",
  "m4a",
  "wav",
  "webm",
]);

export type VoiceFileValidation =
  | { ok: true }
  | { ok: false; status: 400 | 413 | 415; error: "empty-audio" | "audio-too-large" | "unsupported-audio" };

export function validateVoiceFile(file: Pick<File, "name" | "size" | "type">): VoiceFileValidation {
  if (file.size <= 0) return { ok: false, status: 400, error: "empty-audio" };
  if (file.size > MAX_VOICE_CAPTURE_BYTES) {
    return { ok: false, status: 413, error: "audio-too-large" };
  }

  const type = file.type.split(";")[0].toLowerCase();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_AUDIO_MIME_TYPES.has(type) && !SUPPORTED_AUDIO_EXTENSIONS.has(ext)) {
    return { ok: false, status: 415, error: "unsupported-audio" };
  }

  return { ok: true };
}

export function buildVoiceCapturePrompt(): string {
  return [
    "Hypher is a project memory app for builders.",
    "Preserve product names, repo names, tool names, bug IDs, and short technical phrases.",
    "The speaker is dictating a quick project note, decision, task, bug, or open question.",
  ].join(" ");
}

export function getTranscriptionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}
