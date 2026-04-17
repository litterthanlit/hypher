import { fetchMutation } from "convex/nextjs";

// typegen pending convex dev — disableViaToken is a public mutation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const digestEmailApi = { disableViaToken: "digestEmail:disableViaToken" } as any;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  // Next.js 16: URL is already available synchronously via Request.url
  const token = url.searchParams.get("token");

  if (!token) {
    return htmlResponse(unsubscribePage("Invalid unsubscribe link."), 400);
  }

  try {
    await fetchMutation(digestEmailApi.disableViaToken, { token });
    return htmlResponse(
      unsubscribePage("Unsubscribed. You can re-enable in settings."),
      200
    );
  } catch (err) {
    console.error("[hypher/unsubscribe] disableViaToken failed:", err);
    return htmlResponse(
      unsubscribePage("Unsubscribe failed. The link may have expired."),
      200
    );
  }
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function unsubscribePage(message: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypher.app";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Hypher — Unsubscribe</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f4f4f5;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh;}
  .card{background:#fff;border-radius:12px;border:1px solid #e4e4e7;padding:40px 48px;max-width:400px;text-align:center;}
  h1{font-size:20px;color:#18181b;margin:0 0 12px;}
  p{font-size:15px;color:#52525b;margin:0 0 24px;line-height:1.5;}
  a{display:inline-block;padding:8px 20px;background:#18181b;color:#fff;border-radius:6px;font-size:14px;text-decoration:none;}
</style>
</head>
<body>
<div class="card">
  <h1>Hypher</h1>
  <p>${message}</p>
  <a href="${appUrl}/app">Open Hypher</a>
</div>
</body>
</html>`;
}
