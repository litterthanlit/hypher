import { redirect } from "next/navigation";

/**
 * Deep link entry for capture (e.g. hypher://capture → https://app/capture?text=…).
 * Forwards query string into the signed-in app shell.
 */
export default async function CapturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) q.append(key, v);
    } else {
      q.set(key, val);
    }
  }
  q.set("capture", "1");
  const suffix = q.toString();
  redirect(`/app?${suffix}`);
}
