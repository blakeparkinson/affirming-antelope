import { AMANDA, BLAKE, personId, showCurrentEmployer, type Person } from "@/lib/people";
import { APP_URL, PILOT_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

import { BRAND_MARK } from "@/lib/mascot-art";

type Json = Record<string, unknown>;

/** Renders schema.org JSON-LD, escaping `<` so content can't close the script tag. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const ORG_ID = `${SITE_URL}/#organization`;
const SITE_ID = `${SITE_URL}/#website`;
const APP_ID = `${SITE_URL}/#app`;

/** A Person node. Only the facts in lib/people.ts; `worksFor` follows `showCurrentEmployer`. */
export function personLd(p: Person): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(p),
    name: p.name,
    ...(p.credential ? { honorificSuffix: p.credential } : {}),
    ...(p.jobTitle ? { jobTitle: p.jobTitle } : {}),
    ...(p.page ? { url: `${SITE_URL}${p.page}` } : {}),
    ...(p.photo ? { image: `${SITE_URL}${p.photo.src}` } : {}),
    ...(p.memberOf?.length
      ? { memberOf: p.memberOf.map((o) => ({ "@type": "Organization", name: o.name, ...(o.url ? { url: o.url } : {}) })) }
      : {}),
    ...(showCurrentEmployer && p.employer ? { worksFor: { "@type": "Organization", name: p.employer.name } } : {}),
    ...(p.sameAs.length ? { sameAs: p.sameAs } : {}),
  };
}

/** A short reference to a Person, for use inside another node. */
function personRef(p: Person): Json {
  return {
    "@type": "Person",
    "@id": personId(p),
    name: p.name,
    ...(p.page ? { url: `${SITE_URL}${p.page}` } : {}),
  };
}

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}${BRAND_MARK.src}`,
    description: SITE_DESCRIPTION,
    founder: [personRef(AMANDA), personRef(BLAKE)],
    member: [personRef(AMANDA), personRef(BLAKE)],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      url: PILOT_URL,
      availableLanguage: "English",
    },
  };
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

export function softwareApplicationLd({
  description = SITE_DESCRIPTION,
  audience,
}: { description?: string; audience?: string } = {}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: SITE_NAME,
    url: APP_URL,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, iOS (coming soon)",
    description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORG_ID },
    ...(audience ? { audience: { "@type": "Audience", audienceType: audience } } : {}),
  };
}

export function faqPageLd(faq: { q: string; a: string }[], url: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url,
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: new URL(item.path, SITE_URL).toString(),
    })),
  };
}

export function articleLd(a: {
  title: string;
  description: string;
  path: string;
  updated: string;
  published?: string;
  keywords?: string[];
  /** Set only when the guide has been reviewed. */
  reviewer?: Person;
}): Json {
  const url = new URL(a.path, SITE_URL).toString();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.title,
    description: a.description,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: `${url}/opengraph-image`,
    datePublished: a.published ?? a.updated,
    dateModified: a.updated,
    inLanguage: "en",
    ...(a.keywords?.length ? { keywords: a.keywords.join(", ") } : {}),
    author: { "@id": ORG_ID, "@type": "Organization", name: SITE_NAME },
    ...(a.reviewer
      ? { reviewedBy: personRef(a.reviewer), contributor: personRef(a.reviewer) }
      : {}),
    publisher: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: `${SITE_URL}${BRAND_MARK.src}` },
    },
  };
}

export function learningResourceLd(r: {
  name: string;
  description: string;
  path: string;
  difficulty: string;
  teaches: string[];
  audienceType: string;
}): Json {
  const url = new URL(r.path, SITE_URL).toString();
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    "@id": `${url}#resource`,
    name: r.name,
    description: r.description,
    url,
    image: `${url}/opengraph-image`,
    inLanguage: "en",
    learningResourceType: "Role-play simulation",
    interactivityType: "active",
    educationalLevel: r.difficulty,
    teaches: r.teaches,
    isAccessibleForFree: true,
    audience: { "@type": "Audience", audienceType: r.audienceType },
    isPartOf: { "@type": "CollectionPage", name: "Role-play scenarios", url: `${SITE_URL}/scenarios` },
    provider: { "@type": "Organization", "@id": ORG_ID, name: SITE_NAME },
  };
}
