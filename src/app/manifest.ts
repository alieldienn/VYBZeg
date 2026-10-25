import type { MetadataRoute } from "next";

/*
 * The web app manifest: tells phones and computers how to install VYBZ as an
 * app (name, icons, colours, opening full-screen without the browser bar).
 * Served at /manifest.webmanifest; Next.js adds the <link> to every page.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "VYBZ",
    short_name: "VYBZ",
    description: "Real friends. More vibes. Share everyday moments, keep your circles close, and make plans together.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0F",
    theme_color: "#8B5CF6",
    lang: "en",
    dir: "ltr",
    categories: ["social", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New vibe", short_name: "Post", url: "/post", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Plans", url: "/plans", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
