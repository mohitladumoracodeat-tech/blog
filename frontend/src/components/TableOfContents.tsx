import { useState } from "react";
import { ChevronDown, ListTree } from "lucide-react";

export interface TocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

/**
 * Cleanly turns heading text into a web-safe anchor slug
 */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Extracts H2 and H3 headings from markdown or HTML content
 * and assigns unique, stable IDs handling duplicates safely.
 */
export function extractHeadings(content: string): TocItem[] {
  if (!content) return [];
  const lines = content.split("\n");
  const headings: TocItem[] = [];
  const seenSlugs = new Map<string, number>();

  for (const line of lines) {
    const trimmed = line.trim();
    let level: 2 | 3 | null = null;
    let title = "";

    // 1. Markdown syntax
    if (trimmed.startsWith("### ")) {
      level = 3;
      title = trimmed.slice(4).trim();
    } else if (trimmed.startsWith("## ")) {
      level = 2;
      title = trimmed.slice(3).trim();
    }
    // 2. HTML syntax fallback (e.g. <h2 id="..."> or <h2>)
    else if (/^<h2[^>]*>(.*?)<\/h2>/i.test(trimmed)) {
      const match = trimmed.match(/^<h2[^>]*>(.*?)<\/h2>/i);
      if (match && match[1]) {
        level = 2;
        title = match[1].replace(/<[^>]+>/g, "").trim();
      }
    } else if (/^<h3[^>]*>(.*?)<\/h3>/i.test(trimmed)) {
      const match = trimmed.match(/^<h3[^>]*>(.*?)<\/h3>/i);
      if (match && match[1]) {
        level = 3;
        title = match[1].replace(/<[^>]+>/g, "").trim();
      }
    }

    if (level && title) {
      const baseSlug = slugifyHeading(title) || "section";
      const count = seenSlugs.get(baseSlug) || 0;
      seenSlugs.set(baseSlug, count + 1);
      const id = count === 0 ? baseSlug : `${baseSlug}-${count}`;

      headings.push({ id, text: title, level });
    }
  }

  return headings;
}

export interface TableOfContentsProps {
  items: TocItem[];
  activeId?: string;
  className?: string;
  layout?: "collapsible" | "sidebar";
}

/**
 * TableOfContents
 *
 * Renders an automatic table of contents with smooth scroll navigation,
 * sticky-header offset compensation, active heading highlighting,
 * and keyboard accessibility.
 */
export function TableOfContents({
  items,
  activeId = "",
  className = "",
  layout = "collapsible",
}: TableOfContentsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // If there are less than 2 headings, hide the TOC cleanly
  if (!items || items.length < 2) {
    return null;
  }

  function handleNavigate(id: string) {
    const elem = document.getElementById(id);
    if (!elem) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const headerOffset = 84; // Header height + safe margin
    const elementPosition = elem.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    if (typeof history !== "undefined" && history.pushState) {
      history.pushState(null, "", `#${id}`);
    }

    // Auto-close collapsible mobile menu upon navigation
    if (layout === "collapsible") {
      setIsExpanded(false);
    }
  }

  // 1. Mobile & Tablet Collapsible Accordion Layout
  if (layout === "collapsible") {
    return (
      <nav
        aria-label="Table of contents"
        className={`mb-8 overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface-elevated/60 shadow-sm backdrop-blur transition-all ${className}`}
      >
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-xs font-bold uppercase tracking-wider text-moss dark:text-primary transition hover:bg-black/[.03] dark:hover:bg-white/[.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-moss"
        >
          <span className="flex items-center gap-2.5">
            <ListTree size={16} className="shrink-0" />
            <span>Table of Contents</span>
            <span className="rounded-full bg-black/[.06] dark:bg-white/[.1] px-2 py-0.5 text-[10px] font-semibold text-muted normal-case">
              {items.length} sections
            </span>
          </span>
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>

        {isExpanded && (
          <div className="border-t border-black/[.06] dark:border-white/[.06] px-4 py-4 sm:px-5">
            <ul className="space-y-2 text-xs">
              {items.map((item) => {
                const isActive = activeId === item.id;
                return (
                  <li
                    key={item.id}
                    className={
                      item.level === 3
                        ? "ml-4 border-l-2 border-black/10 dark:border-white/10 pl-3"
                        : ""
                    }
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        handleNavigate(item.id);
                      }}
                      className={`block py-1 leading-snug transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                        isActive
                          ? "font-bold text-moss dark:text-primary"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.text}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>
    );
  }

  // 2. Desktop Sticky Sidebar Card Layout
  return (
    <nav
      aria-label="Table of contents"
      className={`rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 shadow-card transition-all ${className}`}
    >
      <div className="mb-3.5 flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-2.5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
          <ListTree size={14} />
          <span>Contents</span>
        </p>
        <span className="text-[10px] font-semibold text-muted">
          {items.length} parts
        </span>
      </div>

      <ul className="space-y-1.5 text-xs">
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              className={
                item.level === 3
                  ? "ml-3.5 border-l-2 border-black/10 dark:border-white/10 pl-2.5"
                  : ""
              }
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigate(item.id);
                }}
                className={`block py-1 leading-snug transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-moss ${
                  isActive
                    ? "font-bold text-moss dark:text-primary"
                    : "text-muted hover:text-ink"
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
