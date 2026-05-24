import {
  baseUrlFromRequest,
  validateOAuthAuthorizeParams,
} from "@/lib/oauthBridge";

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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://hypher.app";
  const validation = validateOAuthAuthorizeParams(qs, baseUrlFromRequest(baseUrl));
  if (!validation.ok) {
    return (
      <main className="oauth-consent-page">
        <h1>Authorization request invalid</h1>
        <p>{validation.errorDescription}</p>
      </main>
    );
  }

  qs.set("consent", "approve");
  const approveHref = `/oauth/authorize?${qs.toString()}`;

  return (
    <main className="oauth-consent-page">
      <section className="oauth-consent-panel">
        <h1>Authorize {validation.clientName}</h1>
        <p>{validation.clientName} wants read-only access to your Hypher project context.</p>
        <a href={approveHref} className="settings-github-connect">
          Authorize
        </a>
      </section>
    </main>
  );
}
