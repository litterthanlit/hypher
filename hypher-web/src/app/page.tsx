import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — Project context for builders and agents",
  description:
    "Hypher is the project context layer for AI builders and agents. Capture on the way in, Builder Briefs on the way out, and agent writeback that keeps every project current.",
};

export default function Home() {
  return <LandingPage />;
}
