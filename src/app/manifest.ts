import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "JA MAKER", short_name: "JA MAKER", description: "Studio SaaS de création, automatisation et publication.", start_url: "/dashboard", display: "standalone", background_color: "#f7f5ed", theme_color: "#17211a", orientation: "any", icons: [{ src: "/jamaker-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }, { src: "/jamaker-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }] };
}
