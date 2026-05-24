export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("request_body_too_large");
  }
}

export function isRequestBodyTooLarge(error: unknown): error is RequestBodyTooLargeError {
  return error instanceof RequestBodyTooLargeError;
}

export async function readTextWithLimit(req: Request, maxBytes: number): Promise<string> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new RequestBodyTooLargeError();

  const reader = req.body?.getReader();
  if (!reader) {
    const text = await req.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
    return text;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new RequestBodyTooLargeError();
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function readJsonWithLimit<T = unknown>(req: Request, maxBytes: number): Promise<T> {
  const raw = await readTextWithLimit(req, maxBytes);
  return (raw.trim() ? JSON.parse(raw) : {}) as T;
}
