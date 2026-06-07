import type { Metadata } from "next";
import { BetaRequestForm } from "@/components/BetaRequestForm";

export const metadata: Metadata = {
  title: "Request beta access",
  description: "Request access to the Hypher private beta.",
};

export default function BetaRequestPage() {
  return <BetaRequestForm />;
}
