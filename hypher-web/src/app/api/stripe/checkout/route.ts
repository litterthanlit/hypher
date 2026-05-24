import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import Stripe from "stripe";
import { ratelimitUser } from "@/lib/rateLimit";

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

  const { userId, getToken } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await ratelimitUser(userId, "stripe-checkout", {
    requests: 10,
    window: "1h",
  });
  if (!allowed) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return Response.json({ error: "Missing Convex auth token" }, { status: 401 });
  }

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
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
    client_reference_id: userId,
    customer_creation:
      plan === "lifetime" && !existing?.stripeCustomerId ? "always" : undefined,
    metadata: { clerkUserId: userId, plan },
    subscription_data:
      plan === "pro_monthly"
        ? { metadata: { clerkUserId: userId, plan: "pro_monthly" } }
        : undefined,
    payment_intent_data:
      plan === "lifetime"
        ? { metadata: { clerkUserId: userId, plan: "lifetime" } }
        : undefined,
  };

  if (existing?.stripeCustomerId) {
    sessionParams.customer = existing.stripeCustomerId;
  } else if (email) {
    sessionParams.customer_email = email;
  }

  const session = await getStripe().checkout.sessions.create(sessionParams);

  if (!session.url) {
    return Response.json({ error: "No checkout URL" }, { status: 500 });
  }

  return Response.json({ url: session.url });
}
