import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Money Buddy", description: "כל הוצאה מול חשבונית, בלי לרדוף אחרי מיילים" };
export const viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" as const };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preload" href="/fonts/placebo-regular.otf" as="font" type="font/otf" crossOrigin="" />
        <link rel="preload" href="/fonts/placebo-demibold.otf" as="font" type="font/otf" crossOrigin="" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="theme-color" content="#2e3fe0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Money Buddy" />
      </head>
      <body>{children}</body>
    </html>
  );
}
