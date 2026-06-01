import { describe, expect, it } from "vitest";
import {
  MAX_VOICE_CAPTURE_BYTES,
  buildVoiceCapturePrompt,
  getTranscriptionText,
  validateVoiceFile,
} from "./voiceCapture";

function fileLike(args: { name: string; size?: number; type?: string }) {
  return {
    name: args.name,
    size: args.size ?? 128,
    type: args.type ?? "",
  } as Pick<File, "name" | "size" | "type">;
}

describe("validateVoiceFile", () => {
  it("accepts browser-recorded webm audio", () => {
    expect(validateVoiceFile(fileLike({ name: "capture.webm", type: "audio/webm" }))).toEqual({ ok: true });
  });

  it("accepts supported files by extension when the browser omits type", () => {
    expect(validateVoiceFile(fileLike({ name: "capture.m4a", type: "" }))).toEqual({ ok: true });
  });

  it("rejects empty recordings", () => {
    expect(validateVoiceFile(fileLike({ name: "capture.webm", size: 0, type: "audio/webm" }))).toEqual({
      ok: false,
      status: 400,
      error: "empty-audio",
    });
  });

  it("rejects files over the OpenAI transcription limit", () => {
    expect(validateVoiceFile(fileLike({ name: "capture.webm", size: MAX_VOICE_CAPTURE_BYTES + 1, type: "audio/webm" }))).toEqual({
      ok: false,
      status: 413,
      error: "audio-too-large",
    });
  });

  it("rejects unsupported audio containers", () => {
    expect(validateVoiceFile(fileLike({ name: "capture.ogg", type: "audio/ogg" }))).toEqual({
      ok: false,
      status: 415,
      error: "unsupported-audio",
    });
  });
});

describe("voice capture helpers", () => {
  it("extracts transcription text from OpenAI responses", () => {
    expect(getTranscriptionText({ text: "  Ship the voice capture button. " })).toBe("Ship the voice capture button.");
  });

  it("keeps the transcription prompt focused on project capture", () => {
    expect(buildVoiceCapturePrompt()).toContain("project note");
    expect(buildVoiceCapturePrompt()).toContain("Preserve product names");
  });
});
