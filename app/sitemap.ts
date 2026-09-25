import type { MetadataRoute } from "next";
import { projects } from "@/content/projects";

// TODO: replace with the real production domain once deployed.
const BASE_URL = "https://example.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE_URL, priority: 1 },
    { url: `${BASE_URL}/about`, priority: 0.6 },
    ...projects.map((p) => ({ url: `${BASE_URL}/work/${p.slug}`, priority: 0.8 })),
  ];
}
