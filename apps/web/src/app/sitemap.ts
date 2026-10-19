import type { MetadataRoute } from "next";
import { AUDIENCE_SLUGS } from "@/lib/audiences";
import { AMANDA, BLAKE } from "@/lib/people";
import { getAllGuides } from "@/lib/guides";
import { getAllScenarios } from "@/lib/scenarios";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const guides = getAllGuides();
  const newestGuide = guides[0]?.updated;
  const built = new Date();

  return [
    { url: SITE_URL, lastModified: built, changeFrequency: "weekly", priority: 1 },
    ...AUDIENCE_SLUGS.map((slug) => ({
      url: `${SITE_URL}/for/${slug}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    {
      url: `${SITE_URL}/guides`,
      lastModified: newestGuide ? new Date(newestGuide) : built,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/scenarios`,
      lastModified: built,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...getAllScenarios().map((s) => ({
      url: `${SITE_URL}/scenarios/${s.id}`,
      lastModified: built,
      changeFrequency: "monthly" as const,
      priority: s.setting === "workplace" ? 0.7 : 0.6,
    })),
    { url: `${SITE_URL}/faq`, lastModified: built, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/about`, lastModified: built, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}${AMANDA.page}`, lastModified: built, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}${BLAKE.page}`, lastModified: built, changeFrequency: "monthly", priority: 0.5 },
    ...guides.map((g) => ({
      url: `${SITE_URL}/guides/${g.slug}`,
      lastModified: new Date(g.updated),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
