import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Upright: Neck & Posture Breaks",
    short_name: "Upright",
    description: "Guided 2-minute neck & posture routines with reminders, streaks and progress.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    categories: ["health", "fitness", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512?maskable=1", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Desk Quickie", short_name: "Quickie", url: "/?start=quickie" },
      { name: "Stealth Mode", short_name: "Stealth", url: "/?start=stealth" },
      { name: "Full Fix", short_name: "Full", url: "/?start=full" },
    ],
  };
}
