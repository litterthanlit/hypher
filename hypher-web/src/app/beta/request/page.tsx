import type { Metadata } from "next";
import { BetaRequestForm } from "@/components/BetaRequestForm";

export const metadata: Metadata = {
  title: "Join the pilot",
  description: "Join the Hypher pilot for builders switching between Claude Code and Codex.",
};

export default function BetaRequestPage() {
  return <BetaRequestForm />;
}
