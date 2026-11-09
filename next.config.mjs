/**
 * Two build modes:
 *  - default: the full app for Vercel (server routes for sync + push reminders)
 *  - GITHUB_PAGES=1: plain static files under /upright for GitHub Pages (no server needed)
 */
const pages = process.env.GITHUB_PAGES === "1";
const basePath = pages ? process.env.PAGES_BASE_PATH || "/upright" : "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_STATIC: pages ? "1" : "0",
  },
  ...(pages
    ? {
        output: "export",
        basePath,
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              source: "/sw.js",
              headers: [
                { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                { key: "Service-Worker-Allowed", value: "/" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
