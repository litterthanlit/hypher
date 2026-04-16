import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import Stripe from "stripe";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY not set");
  }
  return new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
  });
}

function getSharedSecret(): string {
  const s = process.env.STRIPE_CONVEX_SHARED_SECRET;
  if (!s) throw new Error("STRIPE_CONVEX_SHARED_SECRET not set");
  return s;
}

async function applySync(args: {
  stripeCustomerId: string;
  userId: string;
  stripeSubscriptionId?: string;
  status: string;
  plan?: "pro_monthly" | "lifetime";
  currentPeriodEnd?: number;
}) {
  await fetchMutation(api.subscriptions.applyStripeSync, {
    serverSecret: getSharedSecret(),
    ...args,
  });
}

export async function POST(req: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!whSecret || !process.env.STRIPE_SECRET_KEY) {
    return new Response("Stripe not configured", { status: 501 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  const stripe = getStripe();
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        let userId = session.client_reference_id ?? session.metadata?.clerkUserId;
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id;
        if (!customerId) break;
        if (!userId) {
          const customer = await stripe.customers.retrieve(customerId);
          if (!customer.deleted) {
            userId = customer.metadata?.clerkUserId;
          }
        }
        if (!userId) break;

        if (session.mode === "subscription" && session.subscription) {
          const subId =
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySync({
            stripeCustomerId: customerId,
            userId,
            stripeSubscriptionId: sub.id,
            status: sub.status,
            plan: "pro_monthly",
            currentPeriodEnd: sub.current_period_end * 1000,
          });
        } else if (session.mode === "payment") {
          await applySync({
            stripeCustomerId: customerId,
            userId,
            status: "paid",
            plan: "lifetime",
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = sub.metadata?.clerkUserId;
        const customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        if (!customerId) break;
        if (!userId) {
          const customer = await stripe.customers.retrieve(customerId);
          if (customer.deleted) break;
          userId = customer.metadata?.clerkUserId;
        }
        if (!userId) break;

        await applySync({
          stripeCustomerId: customerId,
          userId,
          stripeSubscriptionId: sub.id,
          status: sub.status,
          plan: "pro_monthly",
          currentPeriodEnd:
            sub.current_period_end != null
              ? sub.current_period_end * 1000
              : undefined,
        });
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("Stripe webhook handler error", e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
