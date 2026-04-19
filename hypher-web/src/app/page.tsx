import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — Capture first. Hypher sorts the rest.",
  description:
    "Private beta workspace for solo builders. Drop ideas, notes, and files into one calm place — Hypher suggests projects, remembers context, and surfaces what matters.",
};

export default function Home() {
  return <LandingPage />;
}
