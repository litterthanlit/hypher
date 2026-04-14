import type { Metadata } from "next";
import "./globals.css";
import { ConvexProviderWrapper } from "@/components/ConvexProvider";

export const metadata: Metadata = {
  title: "Hypher",
  description: "The workspace that knows what you're working on",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ConvexProviderWrapper>{children}</ConvexProviderWrapper>
      </body>
    </html>
  );
}
