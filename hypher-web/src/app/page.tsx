import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — dump your project. agents write back.",
  description: "they read one note. that's the product.",
};

export default function Home() {
  return <LandingPage />;
}
