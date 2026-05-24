import { currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import Stripe from "stripe";
import { ratelimitUser } from "@/lib/rateLimit";
import { isRequestBodyTooLarge, readJsonWithLimit } from "@/lib/requestBody";
import { authErrorJson, requireBetaAccess } from "@/lib/serverAuth";

const MAX_BODY_BYTES = 2_000;

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
  });
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json({ error: "Stripe not configured" }, { status: 501 });
  }

  let session: Awaited<ReturnType<typeof requireBetaAccess>>;
  try {
    session = await requireBetaAccess();
  } catch (error) {
    return authErrorJson(error);
  }

  const allowed = await ratelimitUser(session.userId, "stripe-checkout", {
    requests: 10,
    window: "1h",
  });
  if (!allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const token = session.convexToken;
  if (!token) {
    return Response.json({ error: "Missing Convex auth token" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await readJsonWithLimit<{ plan?: string }>(req, MAX_BODY_BYTES);
  } catch (error) {
    if (isRequestBodyTooLarge(error)) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan === "lifetime" ? "lifetime" : "pro_monthly";
  const priceId =
    plan === "lifetime"
      ? process.env.STRIPE_PRICE_LIFETIME
      : process.env.STRIPE_PRICE_PRO_MONTHLY;

  if (!priceId) {
    return Response.json({ error: "Price not configured" }, { status: 501 });
  }

  const existing = await fetchQuery(api.subscriptions.getMine, {}, { token });
  const user = await currentUser();
  const email = user?.emailAddresses?.[0]?.emailAddress;

  const successUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/app?checkout=success`;
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/pricing?checkout=cancel`;

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: plan === "lifetime" ? "payment" : "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: session.userId,
    customer_creation:
      plan === "lifetime" && !existing?.stripeCustomerId ? "always" : undefined,
    metadata: { clerkUserId: session.userId, plan },
    subscription_data:
      plan === "pro_monthly"
        ? { metadata: { clerkUserId: session.userId, plan: "pro_monthly" } }
        : undefined,
    payment_intent_data:
      plan === "lifetime"
        ? { metadata: { clerkUserId: session.userId, plan: "lifetime" } }
        : undefined,
  };

  if (existing?.stripeCustomerId) {
    sessionParams.customer = existing.stripeCustomerId;
  } else if (email) {
    sessionParams.customer_email = email;
  }

  const checkoutSession = await getStripe().checkout.sessions.create(sessionParams);

  if (!checkoutSession.url) {
    return Response.json({ error: "No checkout URL" }, { status: 500 });
  }

  return Response.json({ url: checkoutSession.url });
}
