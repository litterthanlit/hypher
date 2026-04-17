import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "sonner/dist/styles.css";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { ConvexProviderWrapper } from "@/components/ConvexProvider";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hypher",
  description: "The workspace that knows what you're working on",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <ClerkProvider>
          <ConvexProviderWrapper>
            {children}
            <Toaster richColors position="top-center" />
          </ConvexProviderWrapper>
        </ClerkProvider>
      </body>
    </html>
  );
}
