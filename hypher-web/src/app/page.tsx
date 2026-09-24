import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — Stop re-explaining your project to every agent.",
  description: "Hypher carries decisions and next steps between Claude Code and Codex. Your code never leaves your machine. Join the pilot.",
  openGraph: {
    title: "Hypher — Stop re-explaining your project to every agent.",
    description: "Hypher carries decisions and next steps between Claude Code and Codex. Your code never leaves your machine. Join the pilot.",
    images: [{ url: "/hypher-logo.svg", width: 397, height: 84, alt: "hypher" }],
  },
};

export default function Home() {
  return <LandingPage />;
}
