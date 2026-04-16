import { verifyWebhook } from "@clerk/backend/webhooks";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

export async function POST(req: Request) {
  try {
    const evt = await verifyWebhook(req);
    if (evt.type === "user.created") {
      const userId = evt.data.id;
      const secret = process.env.SEED_WEBHOOK_SECRET;
      if (!secret) {
        return new Response("SEED_WEBHOOK_SECRET not configured", { status: 500 });
      }
      await fetchMutation(api.seed.seedDemoAfterClerkSignup, { userId, secret });
    }
    return new Response("ok", { status: 200 });
  } catch {
    return new Response("Invalid webhook", { status: 400 });
  }
}
