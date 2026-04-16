import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";
import { PublicCanvasView } from "@/components/share/PublicCanvasView";
import { ShareWatermark } from "@/components/share/ShareWatermark";
import type { AnyObject, Connection, Project } from "@/types";

export default async function PublicSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { slug } = await params;
  const { t } = await searchParams;
  if (!t?.trim()) {
    notFound();
  }

  const data = await fetchQuery(api.canvasShares.getPublicSnapshot, {
    publicSlug: slug,
    token: t,
  });

  if (!data) {
    notFound();
  }

  const project = data.project as Project;
  const items = data.objects as AnyObject[];
  const connections = data.connections as Connection[];

  return (
    <div className="public-share-page">
      <ShareWatermark />
      <PublicCanvasView project={project} items={items} connections={connections} />
    </div>
  );
}
