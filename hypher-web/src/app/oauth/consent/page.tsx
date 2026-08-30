import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import {
  buildOAuthApproveConsentUrl,
  oauthConsentServerSecret,
  parseOAuthConsentRequestParams,
  sha256Base64url,
} from "@/lib/oauthBridge";
import { requireBetaAccess } from "@/lib/serverAuth";

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") qs.set(key, value);
  }

  const parsed = parseOAuthConsentRequestParams(qs);
  const serverSecret = oauthConsentServerSecret();
  let pendingConsent:
    | {
        clientName: string;
        scope: string;
      }
    | null = null;

  if (parsed.ok && serverSecret) {
    try {
      const session = await requireBetaAccess();
      if (session.convexToken) {
        pendingConsent = await fetchQuery((api as any).oauth.getPendingConsent, {
          consentId: parsed.consentId as any,
          csrfTokenHash: sha256Base64url(parsed.csrfToken),
          now: Date.now(),
          serverSecret,
        }, { token: session.convexToken });
      }
    } catch {
      pendingConsent = null;
    }
  }

  if (!parsed.ok || !pendingConsent) {
    return (
      <main className="oauth-consent-page">
        <h1>Authorization request invalid</h1>
        <p>{parsed.ok ? "Consent transaction is invalid or expired." : parsed.errorDescription}</p>
      </main>
    );
  }

  const approveHref = buildOAuthApproveConsentUrl(parsed);

  return (
    <main className="oauth-consent-page">
      <section className="oauth-consent-panel">
        <h1>Authorize {pendingConsent.clientName}</h1>
        <p>
          {pendingConsent.clientName} wants access to your Hypher project context.
          This includes reading Builder Briefs and writing session handoffs to Agent Inbox.
        </p>
        <a href={approveHref} className="settings-github-connect">
          Authorize
        </a>
      </section>
    </main>
  );
}
