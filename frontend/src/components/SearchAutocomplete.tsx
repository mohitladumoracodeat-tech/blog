import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  X,
  BookOpen,
  ArrowUpRight,
  ArrowRight,
  Loader2,
  Clock,
  TrendingUp,
  Tag,
  Filter,
} from "lucide-react";
import { api, imageUrl } from "../lib/api";
import type { BlogPost } from "../types";

export interface SearchAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onClose?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  autoFocus?: boolean;
  id?: string;
  ariaLabel?: string;
  categoryScope?: string;
  onCategoryScopeChange?: (categorySlug: string) => void;
  availableCategories?: Array<{ id: string; name: string; slug: string }>;
}

export const RECENT_SEARCHES_STORAGE_KEY = "FIELDNOTES_RECENT_SEARCHES_V1";
export const MAX_RECENT_SEARCHES = 6;

// In-memory fallback if localStorage is disabled or throws an exception
let memoryRecentSearches: string[] = [];

/**
 * Safely retrieve recent search terms from localStorage with in-memory fallback.
 */
export function getRecentSearches(): string[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return memoryRecentSearches;
    }
    const raw = window.localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .slice(0, MAX_RECENT_SEARCHES);
    }
    return [];
  } catch {
    return memoryRecentSearches;
  }
}

/**
 * Safely add a search term to recent searches: deduplicates, bubbles to top, caps at MAX_RECENT_SEARCHES.
 */
export function saveRecentSearch(term: string): string[] {
  const clean = term.trim();
  if (!clean || clean.length < 2) return getRecentSearches();

  try {
    const existing = getRecentSearches();
    const filtered = existing.filter((item) => item.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, MAX_RECENT_SEARCHES);
    memoryRecentSearches = updated;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return memoryRecentSearches;
  }
}

/**
 * Safely delete an individual term from recent searches.
 */
export function removeRecentSearch(termToRemove: string): string[] {
  try {
    const existing = getRecentSearches();
    const updated = existing.filter((item) => item.toLowerCase() !== termToRemove.toLowerCase());
    memoryRecentSearches = updated;
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch {
    return memoryRecentSearches;
  }
}

/**
 * Clear all recent searches from localStorage and in-memory fallback.
 */
export function clearRecentSearches(): void {
  try {
    memoryRecentSearches = [];
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
    }
  } catch {
    memoryRecentSearches = [];
  }
}

/**
 * Curated popular search keywords derived from published categories, tags, and topics.
 */
export const DEFAULT_TRENDING_SEARCHES = [
  "React 19",
  "Tailwind CSS",
  "Architecture",
  "Microservices",
  "TypeScript",
  "Performance",
  "Clean Code",
];

/**
 * Highlights matching search query words inside a string case-insensitively.
 */
export function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query || !query.trim()) {
    return <>{text}</>;
  }

  const cleanQuery = query.trim();
  const words = cleanQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0) return <>{text}</>;

  const escapedWords = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const regex = new RegExp(`(${escapedWords})`, "gi");
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = words.some((w) => w.toLowerCase() === part.toLowerCase());
        return isMatch ? (
          <mark
            key={index}
            className="rounded-sm bg-accent/40 px-0.5 font-bold not-italic text-moss dark:bg-primary/25 dark:text-primary"
          >
            {part}
          </mark>
        ) : (
          part
        );
      })}
    </>
  );
}

export function SearchAutocomplete({
  value,
  onChange,
  onSubmit,
  onClose,
  placeholder = "Search stories, ideas...",
  className = "",
  inputClassName = "",
  dropdownClassName = "",
  autoFocus = false,
  id,
  ariaLabel = "Search stories",
  categoryScope,
  onCategoryScopeChange,
  availableCategories,
}: SearchAutocompleteProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingKeywords, setTrendingKeywords] = useState<string[]>(DEFAULT_TRENDING_SEARCHES);

  // Load recent searches on initial mount and when opened
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // Fetch dynamic trending keywords from public tags/categories if available
  useEffect(() => {
    let isSubscribed = true;
    api
      .get<{ data?: { tags?: Array<{ name: string }>; categories?: Array<{ name: string }> } }>(
        "/public/homepage",
      )
      .then((res) => {
        if (!isSubscribed) return;
        const tags = res.data?.data?.tags?.map((t) => t.name) || [];
        const cats = res.data?.data?.categories?.map((c) => c.name) || [];
        const combined = Array.from(new Set([...tags, ...cats, ...DEFAULT_TRENDING_SEARCHES]))
          .filter((t) => t && t.length > 2)
          .slice(0, 7);
        if (combined.length > 0) {
          setTrendingKeywords(combined);
        }
      })
      .catch(() => {
        // Graceful fallback to default curated trending list
      });
    return () => {
      isSubscribed = false;
    };
  }, []);

  // Debounced live search query execution with cancellation and category scoping
  useEffect(() => {
    const trimmed = value.trim();

    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      setSelectedIndex(-1);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const params: Record<string, string | number> = {
          search: trimmed,
          limit: 6,
          autocomplete: "true",
        };
        if (categoryScope) {
          params.category = categoryScope;
        }

        const response = await api.get<{ data: BlogPost[] }>("/public/posts", {
          params,
          signal: controller.signal,
        });
        const items = response.data.data ?? [];
        setSuggestions(items);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err: unknown) {
        if (
          (err as { name?: string })?.name !== "CanceledError" &&
          (err as { code?: string })?.code !== "ERR_CANCELED"
        ) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, categoryScope]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const handleSelectStory = useCallback(
    (story: BlogPost) => {
      if (value.trim()) {
        saveRecentSearch(value.trim());
        setRecentSearches(getRecentSearches());
      }
      setIsOpen(false);
      setSelectedIndex(-1);
      if (onClose) onClose();
      navigate(`/blogs/${story.slug}`);
    },
    [navigate, onClose, value],
  );

  const handleSubmitSearch = useCallback(
    (queryToSubmit: string) => {
      const clean = queryToSubmit.trim();
      if (clean) {
        saveRecentSearch(clean);
        setRecentSearches(getRecentSearches());
      }
      setIsOpen(false);
      setSelectedIndex(-1);
      if (onSubmit) {
        onSubmit(clean);
      } else if (clean) {
        if (onClose) onClose();
        const searchParams = new URLSearchParams();
        searchParams.set("search", clean);
        if (categoryScope) {
          searchParams.set("category", categoryScope);
        }
        navigate(`/blogs?${searchParams.toString()}`);
      }
    },
    [navigate, onClose, onSubmit, categoryScope],
  );

  function handleRecentClick(term: string) {
    onChange(term);
    handleSubmitSearch(term);
  }

  function handleTrendingClick(term: string) {
    onChange(term);
    handleSubmitSearch(term);
  }

  function handleRemoveRecent(e: React.MouseEvent, term: string) {
    e.stopPropagation();
    const updated = removeRecentSearch(term);
    setRecentSearches(updated);
  }

  function handleClearAllRecent(e: React.MouseEvent) {
    e.stopPropagation();
    clearRecentSearches();
    setRecentSearches([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmitSearch(value);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        if (onClose) onClose();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelectStory(suggestions[selectedIndex]);
        } else {
          handleSubmitSearch(value);
        }
        break;

      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        if (onClose && !value) onClose();
        break;

      case "Tab":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  }

  function handleClearInput() {
    onChange("");
    setSuggestions([]);
    setSelectedIndex(-1);
    setRecentSearches(getRecentSearches());
    inputRef.current?.focus();
  }

  const isQueryTyped = value.trim().length >= 2;
  const showDropdown = isOpen;

  // Find active category label if categoryScope is set
  const activeCategoryObj = availableCategories?.find(
    (c) => c.slug === categoryScope || c.id === categoryScope,
  );
  const activeCategoryLabel = activeCategoryObj?.name || categoryScope;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Container */}
      <div className="relative flex items-center">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          size={16}
        />

        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
          aria-controls={id ? `${id}-suggestions` : "search-suggestions-dropdown"}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          placeholder={
            categoryScope && activeCategoryLabel
              ? `Search in ${activeCategoryLabel}...`
              : placeholder
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            setRecentSearches(getRecentSearches());
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`field !pl-11 !pr-14 ${inputClassName}`}
        />

        {/* Right side controls: category scope badge, spinner, clear, and optional close */}
        <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5 text-muted">
          {categoryScope && onCategoryScopeChange && (
            <button
              type="button"
              onClick={() => onCategoryScopeChange("")}
              title={`Filtering in ${activeCategoryLabel}. Click to clear category filter.`}
              aria-label={`Clear category filter for ${activeCategoryLabel}`}
              className="hidden sm:inline-flex items-center gap-1 rounded-full bg-moss/10 dark:bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-moss dark:text-primary hover:bg-moss/20 transition"
            >
              <Filter size={10} />
              <span className="max-w-[70px] truncate">{activeCategoryLabel}</span>
              <X size={10} />
            </button>
          )}

          {loading && (
            <Loader2 size={15} className="animate-spin text-moss dark:text-primary" />
          )}

          {value && (
            <button
              type="button"
              onClick={handleClearInput}
              aria-label="Clear search query"
              title="Clear search query"
              className="grid size-6 place-items-center rounded-md hover:bg-black/[0.06] hover:text-ink dark:hover:bg-white/[0.08] transition"
            >
              <X size={13} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              title="Close search"
              className="grid size-6 place-items-center rounded-md hover:bg-black/[0.06] hover:text-ink dark:hover:bg-white/[0.08] transition"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Panel: Smart Discovery or Live Autocomplete */}
      {showDropdown && (
        <div
          id={id ? `${id}-suggestions` : "search-suggestions-dropdown"}
          role="listbox"
          className={`absolute top-full z-50 mt-2 max-h-[80vh] overflow-y-auto rounded-2xl border border-black/10 bg-surface p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#171B19] animate-in fade-in-50 slide-in-from-top-1 duration-150 ${
            dropdownClassName || "left-0 right-0 w-full"
          }`}
        >
          {/* Active Category Scope Banner inside Dropdown */}
          {categoryScope && (
            <div className="mb-2 flex items-center justify-between rounded-xl bg-moss/10 dark:bg-primary/15 px-3 py-1.5 text-xs text-moss dark:text-primary">
              <span className="flex items-center gap-1.5 font-semibold text-[11px]">
                <Filter size={12} />
                <span>Scoped to category:</span>
                <span className="font-bold underline">{activeCategoryLabel}</span>
              </span>
              {onCategoryScopeChange && (
                <button
                  type="button"
                  onClick={() => onCategoryScopeChange("")}
                  className="text-[10px] font-bold uppercase tracking-wider hover:underline flex items-center gap-1"
                >
                  Clear Scope
                </button>
              )}
            </div>
          )}

          {/* STATE A: Input is empty (< 2 chars) -> Show Recent Searches & Trending Keywords */}
          {!isQueryTyped ? (
            <div className="space-y-3 p-1">
              {/* 1. RECENT SEARCHES SECTION */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-moss dark:text-primary" />
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={handleClearAllRecent}
                      className="text-[10px] font-semibold text-muted hover:text-red-500 transition hover:underline"
                      aria-label="Clear all recent searches"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        onClick={() => handleRecentClick(term)}
                        className="group flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-xs text-ink transition hover:bg-paper dark:hover:bg-surface-elevated"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <Clock size={13} className="text-muted shrink-0 group-hover:text-moss dark:group-hover:text-primary transition" />
                          <span className="truncate font-medium">{term}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleRemoveRecent(e, term)}
                          aria-label={`Remove "${term}" from recent searches`}
                          title={`Remove "${term}" from history`}
                          className="grid size-6 place-items-center rounded-md text-muted hover:text-red-500 hover:bg-black/5 dark:hover:bg-white/5 transition"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. TRENDING SEARCHES SECTION */}
              {trendingKeywords.length > 0 && (
                <div className={recentSearches.length > 0 ? "border-t border-black/[0.06] dark:border-white/[0.06] pt-2.5" : ""}>
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                    <TrendingUp size={12} className="text-amber-500" />
                    <span>Trending Searches</span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap gap-1.5 px-2">
                    {trendingKeywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        onClick={() => handleTrendingClick(keyword)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-ink hover:border-moss/40 hover:text-moss dark:hover:border-primary/40 dark:hover:text-primary transition shadow-2xs"
                      >
                        <Tag size={11} className="text-muted" />
                        <span>{keyword}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick tip footer when empty */}
              <div className="border-t border-black/[0.06] dark:border-white/[0.06] px-2.5 pt-2 text-[11px] text-muted flex items-center justify-between">
                <span>Type 2 or more characters to search stories</span>
                <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px]">
                  <span>↵</span> to search
                </span>
              </div>
            </div>
          ) : /* STATE B: Input has text (>= 2 chars) -> Show Live Suggestions */
          loading && suggestions.length === 0 ? (
            <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-muted">
              <Loader2 size={16} className="animate-spin text-moss dark:text-primary" />
              <span>Searching Fieldnotes stories...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                <span>Story Suggestions</span>
                <span>
                  {suggestions.length} {suggestions.length === 1 ? "match" : "matches"}
                  {categoryScope ? ` in ${activeCategoryLabel}` : ""}
                </span>
              </div>

              {suggestions.map((story, index) => {
                const isSelected = index === selectedIndex;
                const formattedDate = story.publishedAt
                  ? new Date(story.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  : null;

                return (
                  <div
                    key={story.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => handleSelectStory(story)}
                    className={`group flex cursor-pointer items-center gap-3 rounded-xl p-2.5 transition duration-150 ${
                      isSelected
                        ? "bg-paper dark:bg-surface-elevated text-ink"
                        : "text-ink hover:bg-paper dark:hover:bg-surface-elevated"
                    }`}
                  >
                    {/* Story Thumbnail */}
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-black/[0.08] bg-paper dark:border-white/[0.08] dark:bg-surface-elevated">
                      {story.featuredImagePath ? (
                        <img
                          src={imageUrl(story.featuredImagePath)}
                          alt=""
                          className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center text-muted">
                          <BookOpen size={18} />
                        </div>
                      )}
                    </div>

                    {/* Story Meta & Highlighted Title */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[10px] font-semibold text-muted">
                        <span className="font-bold uppercase tracking-wider text-moss dark:text-primary">
                          {story.category}
                        </span>
                        {story.author && <span>· {story.author}</span>}
                        {formattedDate && <span>· {formattedDate}</span>}
                      </div>

                      <p className="mt-0.5 font-display text-xs sm:text-sm font-bold text-ink leading-snug line-clamp-1">
                        <HighlightMatch text={story.title} query={value} />
                      </p>

                      {story.excerpt && (
                        <p className="text-[11px] text-muted line-clamp-1 mt-0.5 leading-normal">
                          {story.excerpt}
                        </p>
                      )}
                    </div>

                    {/* Selection Indicator Arrow */}
                    <ArrowUpRight
                      size={15}
                      className={`shrink-0 transition-transform duration-150 ${
                        isSelected
                          ? "translate-x-0.5 -translate-y-0.5 text-moss dark:text-primary"
                          : "text-muted opacity-50 group-hover:opacity-100 group-hover:text-ink"
                      }`}
                    />
                  </div>
                );
              })}

              {/* Dropdown Footer: See All Results */}
              <div
                onClick={() => handleSubmitSearch(value)}
                className="mt-1 flex cursor-pointer items-center justify-between border-t border-black/[0.06] px-3 py-2 text-xs font-semibold text-moss transition hover:bg-paper dark:border-white/[0.06] dark:text-primary dark:hover:bg-surface-elevated rounded-b-xl"
              >
                <span className="flex items-center gap-1.5">
                  <span>See all stories matching</span>
                  <span className="font-bold underline underline-offset-2">"{value.trim()}"</span>
                  {categoryScope && <span className="opacity-80">in {activeCategoryLabel}</span>}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted font-normal">
                  <span>Press</span>
                  <kbd className="rounded border border-black/15 bg-surface px-1.5 py-0.5 font-mono text-[9px] shadow-2xs dark:border-white/15 dark:bg-[#1C201E]">
                    ↵ Enter
                  </kbd>
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="font-display text-xs sm:text-sm font-bold text-ink">
                No stories found for "{value.trim()}"
                {categoryScope ? ` in ${activeCategoryLabel}` : ""}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                Try searching for broader keywords, clearing the category filter, or exploring related topics.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {categoryScope && onCategoryScopeChange && (
                  <button
                    type="button"
                    onClick={() => onCategoryScopeChange("")}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-surface-elevated dark:hover:text-primary transition"
                  >
                    <span>Search all categories</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleSubmitSearch(value)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-paper px-3 py-1.5 text-xs font-semibold text-ink hover:border-moss/40 hover:text-moss dark:border-white/10 dark:bg-surface-elevated dark:hover:text-primary transition"
                >
                  <span>Search archive for "{value.trim()}"</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
