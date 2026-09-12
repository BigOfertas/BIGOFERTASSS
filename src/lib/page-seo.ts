import { BRAND } from "@/config/brand";

const DEFAULT_OG_IMAGE = `${BRAND.siteUrl}/og-image.jpg`;

type PageSeoOptions = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

function buildCanonicalUrl(path: string) {
  const normalizedPath = path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${BRAND.siteUrl}${normalizedPath}`;
}

export function buildPageHead({ title, description, path, noindex = false }: PageSeoOptions) {
  const resolvedTitle = title.includes(BRAND.officialName)
    ? title
    : `${title} | ${BRAND.officialName}`;
  const canonicalUrl = buildCanonicalUrl(path);

  return {
    meta: [
      { title: resolvedTitle },
      { name: "description", content: description },
      {
        name: "robots",
        content: noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large",
      },
      { property: "og:title", content: resolvedTitle },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: BRAND.officialName },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:image", content: DEFAULT_OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: `${BRAND.officialName} - Loja esportiva` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: resolvedTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: DEFAULT_OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
  };
}
