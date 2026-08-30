import { verifyWebhook } from "@clerk/backend/webhooks";

export async function POST(req: Request) {
  try {
    await verifyWebhook(req);
    // New accounts start empty: home is the dump, nothing is pre-seeded.
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
