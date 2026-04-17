/**
 * Server-side Clerk user lookup for the Convex Node runtime.
 * Cannot use @clerk/nextjs/server here — Convex actions run in an isolated
 * Node environment without Next.js. We call the Clerk REST API directly.
 */

/**
 * Returns the primary email address for the given Clerk userId, or null if
 * the key is missing, the user is not found, or the request fails.
 *
 * Callers must guard on null before sending email.
 */
export async function fetchClerkEmail(userId: string): Promise<string | null> {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    console.warn("[hypher/clerk] CLERK_SECRET_KEY missing — cannot fetch email");
    return null;
  }

  let data: Record<string, unknown>;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`[hypher/clerk] Clerk API returned ${res.status} for userId ${userId}`);
      return null;
    }
    data = (await res.json()) as Record<string, unknown>;
  } catch (err) {
    console.warn("[hypher/clerk] Network error fetching user email:", err);
    return null;
  }

  // Clerk v1 response: primary_email_address_id + email_addresses array
  const primaryId = data["primary_email_address_id"] as string | undefined;
  const addresses = data["email_addresses"] as Array<{ id: string; email_address: string }> | undefined;
  if (!primaryId || !addresses) return null;

  const primary = addresses.find((e) => e.id === primaryId);
  return primary?.email_address ?? null;
}
