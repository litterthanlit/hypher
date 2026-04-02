import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hypher",
  description: "The workspace that knows what you're working on",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
