import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexProviderWrapper } from "@/components/ConvexProvider";

export const metadata: Metadata = {
  title: "Hypher",
  description: "The workspace that knows what you're working on",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClerkProvider>
          <ConvexProviderWrapper>{children}</ConvexProviderWrapper>
        </ClerkProvider>
      </body>
    </html>
  );
}
