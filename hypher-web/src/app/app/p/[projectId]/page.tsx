import { redirect } from "next/navigation";

/** Deep link helper: /app/p/:projectId?toast=captured → canonical /app with project + toast in query. */
export default async function ProjectDeepLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  q.set("project", projectId);
  for (const [key, val] of Object.entries(sp)) {
    if (val === undefined) continue;
    if (Array.isArray(val)) {
      for (const v of val) q.append(key, v);
    } else {
      q.set(key, val);
    }
  }
  redirect(`/app?${q.toString()}`);
}
