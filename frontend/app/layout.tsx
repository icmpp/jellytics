import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/toaster";
import { SkipLink } from "@/components/accessibility/SkipLink";
import { BrowserStateSync } from "@/components/sync";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Jellytics",
    template: "%s | Jellytics",
  },
  description:
    "Beautiful analytics and insights for your Jellyfin media server. Track your viewing history, discover trends, and understand your media consumption.",
  keywords: [
    "jellyfin",
    "analytics",
    "media server",
    "statistics",
    "viewing history",
  ],
  authors: [{ name: "Jellytics" }],
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a0b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-[#0a0a0b] text-white antialiased`}
      >
        <SkipLink />
        <Providers>
          <BrowserStateSync />
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
