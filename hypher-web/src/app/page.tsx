import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — The context they never find in git",
  description:
    "Cursor already has the code. Hypher holds the decisions that never made it in, so the next agent session starts warm.",
  openGraph: {
    title: "Hypher — The context they never find in git",
    description:
              "Give your agents the context the repo can't. Capture it. They read one note. They write back.",
    images: [{ url: "/hypher-logo.svg", width: 596, height: 151, alt: "hypher" }],
  },
};

export default function Home() {
  return <LandingPage />;
}
