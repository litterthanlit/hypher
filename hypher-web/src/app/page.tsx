import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — Dump your project. They read one note. They write back.",
  description: "That's the product.",
};

export default function Home() {
  return <LandingPage />;
}
