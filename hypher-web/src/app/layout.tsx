import type { Metadata } from "next";
import { Archivo_Narrow, Geist, Geist_Mono, Michroma } from "next/font/google";
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

/** Logo / wordmark: wide geometric sans (reference brand lockup) */
const hypherWordmark = Michroma({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hypher-wordmark",
  display: "swap",
});

/** Display / compressed headlines (brand: FK Grotesk Neue Compressed → Archivo Narrow) */
const hypherDisplay = Archivo_Narrow({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-hypher-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hypher",
  description:
    "The project context layer for AI builders and agents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${hypherWordmark.variable} ${hypherDisplay.variable}`}
    >
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
