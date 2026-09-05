import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — The context they never find in git",
  description:
    "Cursor already has the code. Hypher holds the decisions that never made it in, so the next agent session starts warm.",
  openGraph: {
    title: "Hypher — The context they never find in git",
    description:
      "Give your agents the context the repo can't. One brief. They read it. They write back.",
    images: [{ url: "/brand/hypher-field.jpg", width: 1024, height: 560, alt: "hypher" }],
  },
};

export default function Home() {
  return <LandingPage />;
}
