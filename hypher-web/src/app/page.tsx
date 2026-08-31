import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/LandingPage";

export const metadata: Metadata = {
  title: "Hypher — dump your project. they read one note. they write back.",
  description: "that's the product.",
};

export default function Home() {
  return <LandingPage />;
}
