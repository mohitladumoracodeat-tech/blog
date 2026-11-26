import { useEffect } from "react";
import { imageUrl } from "../lib/api";

export interface SeoProps {
  title: string;
  description?: string | null;
  keywords?: string | null;
  /** Explicit canonical URL from the backend, if any. Falls back to the current URL. */
  canonicalUrl?: string | null;
  /** Open Graph / Twitter image path or absolute URL. */
  image?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  robotsIndex?: boolean | number | null;
  robotsFollow?: boolean | number | null;
  type?: "website" | "article";
  /** Structured-data object rendered as JSON-LD. */
  jsonLd?: Record<string, unknown> | null;
}

/** Create or update a <meta> element identified by its attribute + key. */
function upsertMeta(attr: "name" | "property", key: string, content?: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!content) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.append(el);
  }
  el.content = content;
}

function upsertLink(rel: string, href?: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!href) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.append(el);
  }
  el.href = href;
}

function upsertJsonLd(id: string, data?: Record<string, unknown> | null) {
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.append(el);
  }
  el.textContent = JSON.stringify(data);
}

/** Resolve an image path to an absolute URL suitable for social preview tags. */
function absoluteImage(image?: string | null): string | null {
  if (!image) return null;
  const resolved = imageUrl(image);
  if (!resolved) return null;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
  }
  return resolved;
}

/**
 * Centralized SEO head manager.
 * Mutates <head> so titles, descriptions, keywords, canonical URLs,
 * Open Graph, Twitter cards, robots directives, and JSON-LD structured data stay in sync.
 */
export function Seo({
  title,
  description,
  keywords,
  canonicalUrl,
  image,
  ogTitle,
  ogDescription,
  ogImage,
  twitterTitle,
  twitterDescription,
  twitterImage,
  robotsIndex = true,
  robotsFollow = true,
  type = "website",
  jsonLd,
}: SeoProps) {
  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description ?? undefined);
    upsertMeta("name", "keywords", keywords ?? undefined);

    const isIndex = robotsIndex === true || robotsIndex === 1 || robotsIndex === undefined;
    const isFollow = robotsFollow === true || robotsFollow === 1 || robotsFollow === undefined;
    upsertMeta("name", "robots", `${isIndex ? "index" : "noindex"}, ${isFollow ? "follow" : "nofollow"}`);

    const pageUrl = (() => {
      if (typeof window === "undefined") return canonicalUrl || "";
      if (canonicalUrl && /^https?:\/\//i.test(canonicalUrl)) return canonicalUrl;
      if (canonicalUrl) {
        return `${window.location.origin}${canonicalUrl.startsWith("/") ? "" : "/"}${canonicalUrl}`;
      }
      return window.location.href;
    })();
    const resolvedOgImage = absoluteImage(ogImage ?? image);
    const resolvedTwitterImage = absoluteImage(twitterImage ?? image ?? ogImage);

    // Open Graph
    upsertMeta("property", "og:title", ogTitle || title);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:description", ogDescription || description || undefined);
    upsertMeta("property", "og:url", pageUrl);
    if (resolvedOgImage) upsertMeta("property", "og:image", resolvedOgImage);

    // Twitter Card
    upsertMeta("name", "twitter:card", resolvedTwitterImage ? "summary_large_image" : "summary");
    upsertMeta("name", "twitter:title", twitterTitle || title);
    upsertMeta("name", "twitter:description", twitterDescription || description || undefined);
    if (resolvedTwitterImage) upsertMeta("name", "twitter:image", resolvedTwitterImage);

    // Canonical link
    upsertLink("canonical", pageUrl);

    // Structured data
    if (jsonLd) upsertJsonLd("page-jsonld", jsonLd);
  }, [
    title,
    description,
    keywords,
    canonicalUrl,
    image,
    ogTitle,
    ogDescription,
    ogImage,
    twitterTitle,
    twitterDescription,
    twitterImage,
    robotsIndex,
    robotsFollow,
    type,
    jsonLd,
  ]);

  return null;
}
