// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "OMNIA - Personal Intelligence",
  description: "Understand yourself. Improve everything.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OMNIA",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body suppressHydrationWarning className="flex h-screen bg-background text-text-main overflow-hidden">
        <Sidebar />
        {/* ✅ CORRECTION RESPONSIVE : ml-0 sur mobile, ml-64 sur PC + padding top sur mobile */}
        <main className="flex-1 ml-0 md:ml-64 pt-16 md:pt-0 overflow-y-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}