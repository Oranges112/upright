import type { MetadataRoute } from "next";
import { asset } from "@/lib/base";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Upright: Neck & Posture Breaks",
    short_name: "Upright",
    description: "Guided 2-minute neck & posture routines with reminders, streaks and progress.",
    start_url: asset("/"),
    scope: asset("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: asset("/icons/192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: asset("/icons/512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: asset("/icons/512-maskable.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Desk Quickie", short_name: "Quickie", url: asset("/?start=quickie") },
      { name: "Stealth Mode", short_name: "Stealth", url: asset("/?start=stealth") },
      { name: "Full Fix", short_name: "Full", url: asset("/?start=full") },
    ],
  };
}
