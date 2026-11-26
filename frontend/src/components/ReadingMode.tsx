import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Coffee,
  Heart,
  Moon,
  Share2,
  Sun,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { imageUrl } from "../lib/api";
import { ArticleContent } from "./ArticleContent";
import { TableOfContents, extractHeadings } from "./TableOfContents";
import { ReadingProgressBar } from "./ReadingProgressBar";
import { SocialShare } from "./SocialShare";
import { ArticleAudioPlayer, TranslatedArticleData } from "./ArticleAudioPlayer";
import { ListeningLanguage } from "../lib/speechUtils";
import type { BlogPost, Taxonomy } from "../types";

export interface ReadingModeDetailPost extends BlogPost {
  id: string;
  content: string;
  categoryName: string;
  categorySlug: string;
  tags: Taxonomy[];
  images: Array<{ id: string; path: string; caption?: string | null }>;
  isLiked?: boolean;
  isBookmarked?: boolean;
  authorBio?: string | null;
  seoDescription?: string | null;
}

export type ReadingFontSize = "small" | "default" | "large" | "xlarge";
export type ReadingWidth = "narrow" | "comfortable" | "wide";
export type ReadingTheme = "light" | "dark" | "sepia";

export interface ReadingPreferences {
  fontSize: ReadingFontSize;
  readingWidth: ReadingWidth;
  theme: ReadingTheme;
}

const STORAGE_KEY = "fieldnotes_reading_mode_prefs";

function getSavedPreferences(): ReadingPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const validFontSizes: ReadingFontSize[] = ["small", "default", "large", "xlarge"];
      const validWidths: ReadingWidth[] = ["narrow", "comfortable", "wide"];
      const validThemes: ReadingTheme[] = ["light", "dark", "sepia"];

      return {
        fontSize: validFontSizes.includes(parsed.fontSize) ? parsed.fontSize : "default",
        readingWidth: validWidths.includes(parsed.readingWidth) ? parsed.readingWidth : "comfortable",
        theme: validThemes.includes(parsed.theme) ? parsed.theme : "sepia",
      };
    }
  } catch {
    // Fallback if localStorage or JSON is unavailable
  }
  return {
    fontSize: "default",
    readingWidth: "comfortable",
    theme: "sepia",
  };
}

function savePreferences(prefs: ReadingPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage quota errors
  }
}

export interface ReadingModeProps {
  post: ReadingModeDetailPost;
  onClose: () => void;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  bookmarkLoading?: boolean;
  liked: boolean;
  likeCount: number;
  onLike: () => void;
}

/**
 * Distraction-Free Reading Mode (Phase 1E)
 *
 * Fullscreen focused editorial view. Isolates theme (Light, Dark, Sepia)
 * from global site theme, hides all promotional chrome, and provides
 * responsive typography and column-width controls with localStorage persistence.
 */
export function ReadingMode({
  post,
  onClose,
  bookmarked,
  onToggleBookmark,
  bookmarkLoading = false,
  liked,
  likeCount,
  onLike,
}: ReadingModeProps) {
  const [prefs, setPrefs] = useState<ReadingPreferences>(getSavedPreferences);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState("");
  const [activeSpeechDomId, setActiveSpeechDomId] = useState<string | null>(null);

  // Phase 1G: Listening language & translation integration
  const [listeningLanguage, setListeningLanguage] = useState<ListeningLanguage>("en");
  const [translatedArticle, setTranslatedArticle] = useState<TranslatedArticleData | null>(null);

  function handleLanguageChange(lang: ListeningLanguage, translated?: TranslatedArticleData) {
    setListeningLanguage(lang);
    if (lang === "hi" && translated) {
      setTranslatedArticle(translated);
    } else {
      setTranslatedArticle(null);
    }
  }

  const displayTitle = listeningLanguage === "hi" && translatedArticle ? translatedArticle.title : post.title;
  const displayExcerpt = listeningLanguage === "hi" && translatedArticle ? (translatedArticle.excerpt ?? post.excerpt) : post.excerpt;
  const displayContent = listeningLanguage === "hi" && translatedArticle ? translatedArticle.content : post.content;

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const wordCount = useMemo(() => {
    return (displayContent || "").split(/\s+/).filter(Boolean).length;
  }, [displayContent]);

  const readTime = useMemo(() => {
    return Math.max(1, Math.round(wordCount / 200));
  }, [wordCount]);

  const headings = useMemo(() => {
    return extractHeadings(displayContent);
  }, [displayContent]);

  // Keyboard shortcut listener: Escape exits reading mode or closes popover
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, settingsOpen]);

  // Lock body & html scroll while reading mode is active to prevent double scrollbars
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Heading IntersectionObserver for Table of Contents within the scroll container
  useEffect(() => {
    if (headings.length === 0 || !containerRef.current) return;

    const headingElements = headings
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headingElements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveHeadingId(entry.target.id);
            break;
          }
        }
      },
      {
        root: containerRef.current,
        rootMargin: "0px 0px -65% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  function updatePref<K extends keyof ReadingPreferences>(key: K, value: ReadingPreferences[K]) {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      savePreferences(next);
      return next;
    });
  }

  // Column width class mapping
  const widthClass = {
    narrow: "reading-width-narrow",
    comfortable: "reading-width-comfortable",
    wide: "reading-width-wide",
  }[prefs.readingWidth];

  // Font size class mapping
  const sizeClass = {
    small: "reading-size-small",
    default: "reading-size-default",
    large: "reading-size-large",
    xlarge: "reading-size-xlarge",
  }[prefs.fontSize];

  // Isolated reading theme class
  const themeClass = {
    light: "reading-theme-light",
    dark: "reading-theme-dark",
    sepia: "reading-theme-sepia",
  }[prefs.theme];

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Distraction-Free Reading Mode"
      className={`fixed inset-0 z-50 overflow-y-auto ${themeClass} ${sizeClass} transition-colors duration-200`}
      style={{
        backgroundColor: "var(--bg-app)",
        color: "var(--color-text)",
      }}
    >
      {/* 1. Thin Reading Progress Bar pinned at top of reading mode container */}
      <ReadingProgressBar targetRef={contentRef} scrollContainerRef={containerRef} />

      {/* 2. Minimal Sticky Top Navigation Toolbar */}
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--bg-app)]/90 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Left: Exit Reading Mode */}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text)] shadow-sm hover:border-[var(--color-primary)] transition-all"
            aria-label="Exit Reading Mode (Press Escape)"
            title="Exit Reading Mode (Esc)"
          >
            <ArrowLeft size={14} />
            <span>Exit</span>
            <kbd className="hidden sm:inline-block ml-1 rounded bg-black/10 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-mono font-medium">
              Esc
            </kbd>
          </button>

          {/* Center: Truncated Story Headline */}
          <span className="hidden md:block truncate max-w-sm lg:max-w-md font-display text-xs font-semibold text-[var(--color-text-muted)] text-center px-4">
            {displayTitle}
          </span>

          {/* Right: Audio Narration, Typography Settings, Bookmark */}
          <div className="flex items-center gap-2">
            {/* Compact Audio Narration Player */}
            <ArticleAudioPlayer
              content={post.content}
              title={post.title}
              excerpt={post.excerpt}
              storyId={post.id}
              variant="compact"
              onSegmentChange={setActiveSpeechDomId}
              onLanguageChange={handleLanguageChange}
            />

            {/* Appearance / Typography Popover Trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-all ${
                  settingsOpen
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)] shadow-sm"
                    : "border-[var(--color-border)] bg-[var(--bg-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                }`}
                aria-label="Typography and display settings"
                aria-expanded={settingsOpen}
                title="Appearance settings"
              >
                <span className="font-serif text-sm font-black">Aa</span>
                <span className="hidden sm:inline text-xs">Settings</span>
              </button>

              {/* Popover Settings Panel */}
              {settingsOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{ backgroundColor: "var(--bg-surface)", color: "var(--color-text)" }}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)] mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                      Reader Preferences
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      className="rounded-full p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      aria-label="Close settings"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Theme Selector */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => updatePref("theme", "light")}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                          prefs.theme === "light"
                            ? "border-[#263C35] ring-2 ring-[#263C35]/30 bg-white text-[#242824] shadow-sm font-bold"
                            : "border-black/10 bg-[#F8F7F3] text-[#242824]/70 hover:bg-white"
                        }`}
                      >
                        <Sun size={15} />
                        <span>Light</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updatePref("theme", "sepia")}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                          prefs.theme === "sepia"
                            ? "border-[#784F25] ring-2 ring-[#784F25]/30 bg-[#EFE7D3] text-[#3C2F2F] shadow-sm font-bold"
                            : "border-[#3C2F2F]/15 bg-[#F7F1E3] text-[#3C2F2F]/80 hover:bg-[#EFE7D3]"
                        }`}
                      >
                        <Coffee size={15} />
                        <span>Sepia</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updatePref("theme", "dark")}
                        className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-xs font-semibold transition-all ${
                          prefs.theme === "dark"
                            ? "border-[#A8C1AE] ring-2 ring-[#A8C1AE]/30 bg-[#222925] text-[#F1F0E9] shadow-sm font-bold"
                            : "border-white/10 bg-[#171B19] text-[#F1F0E9]/70 hover:bg-[#222925]"
                        }`}
                      >
                        <Moon size={15} />
                        <span>Dark</span>
                      </button>
                    </div>
                  </div>

                  {/* Font Size Selector */}
                  <div className="mb-4">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                      Font Size
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(["small", "default", "large", "xlarge"] as const).map((size) => {
                        const labels = {
                          small: "Small",
                          default: "Medium",
                          large: "Large",
                          xlarge: "XL",
                        };
                        const isActive = prefs.fontSize === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            onClick={() => updatePref("fontSize", size)}
                            className={`rounded-xl border py-1.5 text-center text-xs transition-all ${
                              isActive
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)] font-bold shadow-sm"
                                : "border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            {labels[size]}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Reading Column Width Selector */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
                      Column Width
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {(["narrow", "comfortable", "wide"] as const).map((width) => {
                        const labels = {
                          narrow: "Narrow",
                          comfortable: "Default",
                          wide: "Wide",
                        };
                        const isActive = prefs.readingWidth === width;
                        return (
                          <button
                            key={width}
                            type="button"
                            onClick={() => updatePref("readingWidth", width)}
                            className={`rounded-xl border py-1.5 text-center text-xs transition-all ${
                              isActive
                                ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)] font-bold shadow-sm"
                                : "border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                            }`}
                          >
                            {labels[width]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bookmark button */}
            <button
              type="button"
              onClick={onToggleBookmark}
              disabled={bookmarkLoading}
              aria-label={bookmarked ? "Remove bookmark" : "Save story"}
              title={bookmarked ? "Saved to reading list" : "Save story"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                bookmarked
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/15 text-[var(--color-primary)] font-bold"
                  : "border-[var(--color-border)] bg-[var(--bg-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-hover)]"
              } disabled:opacity-50`}
            >
              <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              <span className="hidden sm:inline">{bookmarked ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 3. Main Reading Canvas */}
      <main
        lang={listeningLanguage}
        className={`mx-auto ${widthClass} px-5 sm:px-8 py-10 sm:py-16 ${listeningLanguage === "hi" ? "lang-hi" : ""}`}
      >
        {/* Story Header */}
        <header className="mb-10 sm:mb-12">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--bg-surface-elevated)] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-[var(--color-primary)]">
              {post.categoryName}
            </span>
            {listeningLanguage === "hi" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
                हिंदी अनुवाद (Hindi Mode)
              </span>
            )}
            <span className="text-[var(--color-text-muted)] text-xs">·</span>
            <span className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              {readTime} min read
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black leading-[1.15] tracking-tight text-[var(--color-text)]">
            {displayTitle}
          </h1>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-border)] pb-6 text-xs text-[var(--color-text-muted)] sm:text-sm">
            <div className="flex items-center gap-3">
              <Link
                to={`/author/${encodeURIComponent(post.author)}`}
                className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-surface-elevated)] text-sm font-bold text-[var(--color-primary)] shadow-sm hover:ring-2 hover:ring-[var(--color-primary)]/40 transition-all"
                aria-label={`View ${post.author}'s profile`}
              >
                {post.authorProfileImagePath ? (
                  <img src={imageUrl(post.authorProfileImagePath)} alt={post.author} className="size-full object-cover" />
                ) : (
                  (post.author || "A").slice(0, 1).toUpperCase()
                )}
              </Link>
              <div>
                <Link
                  to={`/author/${encodeURIComponent(post.author)}`}
                  className="font-bold text-[var(--color-text)] leading-tight hover:text-[var(--color-primary)] hover:underline transition-colors block"
                >
                  {post.author}
                </Link>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  {post.publishedAt
                    ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "Recently published"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
              <span>{post.viewCount ?? 0} views</span>
              <span>·</span>
              <span>{likeCount} likes</span>
            </div>
          </div>
        </header>

        {/* Listen to Article Audio Player (Phase 1F + 1G) */}
        <ArticleAudioPlayer
          content={post.content}
          title={post.title}
          excerpt={post.excerpt}
          storyId={post.id}
          onSegmentChange={setActiveSpeechDomId}
          onLanguageChange={handleLanguageChange}
          variant="card"
        />

        {/* Featured Cover Image */}
        {post.featuredImagePath && (
          <figure className="mb-10 sm:mb-12">
            <img
              src={imageUrl(post.featuredImagePath)}
              alt={displayTitle}
              className="max-h-[500px] w-full rounded-2xl object-cover border border-[var(--color-border)] shadow-soft"
            />
          </figure>
        )}

        {/* Collapsible Table of Contents */}
        {headings.length >= 2 && (
          <div className="mb-10">
            <TableOfContents items={headings} activeId={activeHeadingId} layout="collapsible" />
          </div>
        )}

        {/* Story Reading Content */}
        <div ref={contentRef} className="reading-content min-w-0">
          {displayExcerpt && (
            <div className="editorial-pullquote mb-10 border-l-4 border-[var(--color-primary)] pl-5 py-2 italic text-lg sm:text-xl text-[var(--color-text)] opacity-95">
              &ldquo;{displayExcerpt}&rdquo;
            </div>
          )}

          <ArticleContent content={displayContent} activeSpeechDomId={activeSpeechDomId} />

          {/* Multiple Additional Story Images Gallery */}
          {post.images && post.images.length > 0 && (
            <div className="my-10 grid gap-4 sm:grid-cols-2">
              {post.images.map((img) => (
                <figure
                  key={img.id}
                  className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] shadow-card"
                >
                  <img src={imageUrl(img.path)} alt={img.caption ?? ""} className="aspect-video w-full object-cover" />
                  {img.caption && (
                    <figcaption className="px-4 py-2.5 text-center text-xs text-[var(--color-text-muted)] italic font-medium">
                      {img.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] pt-6">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)] mr-1">Tags:</span>
              {post.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)]"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Author Card in Reading Mode */}
        <div className="my-10 flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-card">
          <Link
            to={`/author/${encodeURIComponent(post.author)}`}
            className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--bg-surface-elevated)] font-bold text-[var(--color-primary)] shadow-sm hover:ring-2 hover:ring-[var(--color-primary)]/40 transition-all"
            aria-label={`View ${post.author}'s profile`}
          >
            {post.authorProfileImagePath ? (
              <img src={imageUrl(post.authorProfileImagePath)} alt={post.author} className="size-full object-cover" />
            ) : (
              <span className="text-xl">{(post.author || "A").slice(0, 1).toUpperCase()}</span>
            )}
          </Link>
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)]">
              Contributing Writer
            </span>
            <Link
              to={`/author/${encodeURIComponent(post.author)}`}
              className="mt-0.5 block font-display text-xl font-bold text-[var(--color-text)] hover:text-[var(--color-primary)] hover:underline transition-colors"
            >
              {post.author}
            </Link>
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
              {post.authorBio || "Author and contributor sharing thoughtful perspectives, essays, and stories on Fieldnotes."}
            </p>
          </div>
        </div>

        {/* Reader Appreciation & Sharing Bar */}
        <div className="my-10 rounded-2xl border border-[var(--color-border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-card">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-display text-xl font-bold text-[var(--color-text)]">
                Enjoyed this perspective?
              </p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {likeCount} {likeCount === 1 ? "reader has appreciated" : "readers have appreciated"} this article
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={onLike}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                  liked
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"
                    : "border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                }`}
              >
                <Heart size={14} fill={liked ? "currentColor" : "none"} className={liked ? "text-white" : "text-red-500"} />
                <span>{liked ? "Liked" : "Like"}</span>
              </button>

              <button
                type="button"
                onClick={onToggleBookmark}
                disabled={bookmarkLoading}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all shadow-sm ${
                  bookmarked
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-contrast)]"
                    : "border-[var(--color-border)] bg-[var(--bg-app)] text-[var(--color-text)] hover:border-[var(--color-primary)]"
                }`}
              >
                <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
                <span>{bookmarked ? "Saved" : "Save Story"}</span>
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--color-border)] pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              <Share2 size={14} className="text-[var(--color-primary)]" />
              <span>Share this dispatch</span>
            </span>
            <SocialShare
              title={post.title}
              url={`/blogs/${post.slug}`}
              excerpt={post.seoDescription ?? post.excerpt}
            />
          </div>
        </div>

        {/* Bottom Exit Button */}
        <div className="mt-12 text-center pt-8 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--bg-surface)] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-[var(--color-text)] shadow-sm hover:border-[var(--color-primary)] transition-all"
          >
            <ArrowLeft size={15} />
            <span>Return to Standard Article View</span>
          </button>
        </div>
      </main>
    </div>
  );
}
