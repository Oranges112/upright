import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { asset } from "@/lib/base";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "Upright · Neck & Posture Breaks",
  description: "Guided 2-minute neck and posture routines with reminders, streaks and progress. Fix tech neck one break at a time.",
  applicationName: "Upright",
  appleWebApp: { capable: true, title: "Upright", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: asset("/icons/192.png"), type: "image/png", sizes: "192x192" }],
    apple: [{ url: asset("/icons/180.png"), sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b1020" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3ee" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* apply the saved theme before first paint (no flash) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=JSON.parse(localStorage.getItem("upright:v1")||"{}").settings?.theme;if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
