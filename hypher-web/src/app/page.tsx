import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — You don't explain the project again.",
  description: "Capture your project. They read one note. They write back.",
  openGraph: {
    title: "Hypher — You don't explain the project again.",
    description: "Capture your project. They read one note. They write back.",
    images: [{ url: "/hypher-logo.svg", width: 397, height: 84, alt: "hypher" }],
  },
};

export default function Home() {
  return <LandingPage />;
}
