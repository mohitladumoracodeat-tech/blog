import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Flame,
  Heart,
  Loader2,
  Mail,
  MailCheck,
  MessageSquareText,
  Search,
  Send,
  Share2,
  Shield,
  Sparkles,
  Tag as TagIcon,
  TrendingUp,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  ArticleDetailSkeleton,
  Button,
  Card,
  EmptyState,
  Field,
  HeroSkeleton,
  Loading,
  Notice,
  PageHeading,
  Pagination,
  PostCardSkeleton,
  SelectField,
  SkeletonBox,
  TextArea,
} from "../components/UI";
import { Seo } from "../components/Seo";
import { SearchAutocomplete } from "../components/SearchAutocomplete";
import { ReadingProgressBar } from "../components/ReadingProgressBar";
import { TableOfContents, extractHeadings } from "../components/TableOfContents";
import { ArticleContent } from "../components/ArticleContent";
import { SocialShare } from "../components/SocialShare";
import { ReadingMode } from "../components/ReadingMode";
import { ArticleAudioPlayer, TranslatedArticleData } from "../components/ArticleAudioPlayer";
import { ListeningLanguage } from "../lib/speechUtils";
import { api, getErrorMessage, imageUrl } from "../lib/api";
import { confirmAction, showError, showSuccess, showToast, showWarning } from "../lib/alerts";
import type { AuthorProfileData, BlogPost, PageResult, SeoData, Taxonomy } from "../types";

/* ══════════════════════════════════════════════════════════════════════
   TYPES & SHARED DATA HOOK
   ══════════════════════════════════════════════════════════════════════ */

interface HomeData {
  featuredPosts: BlogPost[];
  trendingPosts?: BlogPost[];
  latestPosts: BlogPost[];
  popularPosts: BlogPost[];
  categories: Taxonomy[];
  tags: Taxonomy[];
  seo: SeoData | null;
}

function useRequest<T>(url: string, autoRefreshMs = 60000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<any>(url)
      .then((response) => {
        if (active) {
          const resBody = response.data;
          if (resBody && typeof resBody === "object" && Array.isArray(resBody.data) && "pagination" in resBody) {
            setData(resBody as unknown as T);
          } else if (resBody && typeof resBody === "object" && "data" in resBody) {
            setData(resBody.data as T);
          } else {
            setData(resBody as unknown as T);
          }
          setError(null);
        }
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefreshMs) return;
    const intervalId = setInterval(() => {
      let active = true;
      api
        .get<{ data: T }>(url)
        .then((response) => {
          if (active) {
            setData(response.data.data);
            setError(null);
          }
        })
        .catch((requestError: unknown) => {
          if (active) setError(getErrorMessage(requestError));
        });
      return () => {
        active = false;
      };
    }, autoRefreshMs);
    return () => clearInterval(intervalId);
  }, [autoRefreshMs, url]);

  return { data, loading, error };
}

export function BookOpenMark() {
  return (
    <div className="grid size-14 place-items-center rounded-2xl bg-moss dark:bg-primary text-lime dark:text-[#171B19] shadow-soft">
      <Sparkles size={24} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   REUSABLE POST CARD (MODERN EDITORIAL & CONTEMPORARY MAGAZINE)
   ══════════════════════════════════════════════════════════════════════ */

export function PostCard({
  post,
  featured = false,
  variant = "standard",
  index,
  trendingRank,
}: {
  post: BlogPost;
  featured?: boolean;
  variant?: "standard" | "featured" | "compact" | "spotlight";
  index?: number;
  trendingRank?: number;
}) {
  const wordCount = (post.excerpt || post.title || "").split(/\s+/).length * 10;
  const readMinutes = Math.max(2, Math.round(wordCount / 60));
  const isLead = featured || variant === "featured";

  // 1. Featured Lead Magazine Cover Story (Hero Edition)
  if (isLead) {
    return (
      <article className="group relative flex flex-col justify-between h-full overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:border-moss/40 hover:shadow-soft">
        <div>
          <Link
            to={`/blogs/${post.slug}`}
            className="relative block aspect-[16/10] w-full overflow-hidden bg-black/5 dark:bg-white/5"
          >
            {post.featuredImagePath ? (
              <img
                src={imageUrl(post.featuredImagePath)}
                alt={post.title}
                className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              />
            ) : (
              <div className="size-full grid place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
                <BookOpenMark />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
            <div className="absolute left-4 top-4 sm:left-5 sm:top-5 flex flex-wrap items-center gap-2 max-w-[calc(100%-2rem)]">
              <span className="rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
                {post.category}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 text-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest backdrop-blur border border-white/10">
                <Sparkles size={10} className="text-amber-400 fill-amber-400" />
                Featured Story
              </span>
            </div>
          </Link>

          <div className="p-7 sm:p-9">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted">
              <Link
                to={`/author/${encodeURIComponent(post.author)}`}
                className="inline-flex items-center gap-2 hover:text-moss dark:hover:text-primary transition-colors group/author"
                aria-label={`View ${post.author}'s profile`}
              >
                <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-accent/30 text-[11px] font-bold text-moss dark:text-primary">
                  {post.authorProfileImagePath ? (
                    <img src={imageUrl(post.authorProfileImagePath)} alt={post.author} className="size-full object-cover" />
                  ) : (
                    post.author.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="font-semibold text-ink group-hover/author:underline">{post.author}</span>
              </Link>
              <span>·</span>
              <span>
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Recently"}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {readMinutes} min read
              </span>
            </div>

            <Link to={`/blogs/${post.slug}`}>
              <h2 className="mt-4 font-display text-2xl font-bold leading-[1.18] tracking-tight text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary sm:text-3xl lg:text-[2.25rem]">
                {post.title}
              </h2>
            </Link>

            {post.excerpt && (
              <p className="mt-3.5 text-sm leading-relaxed text-muted line-clamp-3 sm:text-base">
                {post.excerpt}
              </p>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {post.tags.slice(0, 3).map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/tag/${tag.slug}`}
                    className="rounded-full bg-paper px-2.5 py-0.5 text-[11px] font-semibold text-muted transition hover:bg-moss hover:text-white dark:hover:bg-primary dark:hover:text-[#171B19]"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-7 sm:px-9 pb-7 pt-4">
          <div className="flex items-center justify-between border-t border-black/[.08] dark:border-white/[.08] pt-5">
            <div className="flex items-center gap-4 text-xs font-semibold text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Heart size={14} className="text-red-500" /> {post.likeCount ?? 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageSquareText size={14} /> {post.commentCount ?? 0}
              </span>
            </div>
            <Link
              to={`/blogs/${post.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary transition group-hover:translate-x-1 whitespace-nowrap shrink-0"
            >
              <span>Read full story</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </article>
    );
  }

  // 2. Compact Numbered Digest Item (e.g. 01, 02, 03 for Hero Sidebar / Editor's Desk)
  if (variant === "compact") {
    const formattedIndex = index !== undefined ? String(index + 1).padStart(2, "0") : null;
    return (
      <article className="group flex gap-4 py-4 border-b border-black/[.06] dark:border-white/[.06] last:border-0 items-start">
        {formattedIndex && (
          <span className="font-display text-2xl sm:text-3xl font-black text-moss/30 dark:text-primary/30 group-hover:text-moss dark:group-hover:text-primary transition-colors shrink-0 leading-none pt-1">
            {formattedIndex}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-muted mb-1">
            <span className="font-bold uppercase tracking-wider text-moss dark:text-primary">
              {post.category}
            </span>
            <span>·</span>
            <span>{readMinutes} min</span>
          </div>
          <Link to={`/blogs/${post.slug}`}>
            <h3 className="font-display text-base font-bold text-ink leading-snug line-clamp-2 transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary">
              {post.title}
            </h3>
          </Link>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <Link
              to={`/author/${encodeURIComponent(post.author)}`}
              className="font-medium text-ink/75 hover:text-moss dark:hover:text-primary hover:underline transition-colors"
            >
              {post.author}
            </Link>
            <span>·</span>
            <span>
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "Recent"}
            </span>
          </div>
        </div>
        {post.featuredImagePath && (
          <Link
            to={`/blogs/${post.slug}`}
            className="size-16 shrink-0 overflow-hidden rounded-xl bg-black/5 dark:bg-white/5 border border-black/[.08] dark:border-white/[.08]"
          >
            <img
              src={imageUrl(post.featuredImagePath)}
              alt=""
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </Link>
        )}
      </article>
    );
  }

  // 3. Spotlight Full-Width Horizontal Card
  if (variant === "spotlight") {
    return (
      <article className="group relative overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface-elevated p-6 sm:p-10 shadow-card transition-all duration-300 hover:border-moss/40 hover:shadow-soft md:grid md:grid-cols-12 md:gap-8 md:items-center">
        <div className="md:col-span-7">
          <div className="flex items-center gap-2.5 text-xs text-muted mb-3">
            <span className="rounded-full bg-accent/30 dark:bg-accent/20 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-moss dark:text-primary">
              {post.category}
            </span>
            <span>·</span>
            <span>{readMinutes} min read</span>
          </div>
          <Link to={`/blogs/${post.slug}`}>
            <h3 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary">
              {post.title}
            </h3>
          </Link>
          {post.excerpt && (
            <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-2 sm:line-clamp-3">
              {post.excerpt}
            </p>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Link
              to={`/blogs/${post.slug}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-5 py-2 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink"
            >
              Read story <ArrowRight size={14} />
            </Link>
            <span className="text-xs text-muted">By {post.author}</span>
          </div>
        </div>
        <div className="mt-6 md:mt-0 md:col-span-5">
          <Link
            to={`/blogs/${post.slug}`}
            className="block aspect-[16/10] overflow-hidden rounded-2xl bg-black/5 dark:bg-white/5 border border-black/[.08] dark:border-white/[.08]"
          >
            {post.featuredImagePath ? (
              <img
                src={imageUrl(post.featuredImagePath)}
                alt={post.title}
                className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="grid size-full place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
                <BookOpenMark />
              </div>
            )}
          </Link>
        </div>
      </article>
    );
  }

  // 4. Standard Digital Magazine Grid Card
  return (
    <article className="group flex flex-col justify-between h-full overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft">
      <div>
        <Link
          to={`/blogs/${post.slug}`}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-black/5 dark:bg-white/5"
        >
          {post.featuredImagePath ? (
            <img
              src={imageUrl(post.featuredImagePath)}
              alt={post.title}
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
              <BookOpenMark />
            </div>
          )}
          <div className="absolute left-4 top-4 flex items-center gap-1.5">
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
              {post.category}
            </span>
            {Boolean(post.isFeatured) && !trendingRank && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
                <Sparkles size={10} className="text-amber-500 fill-amber-500" />
                Featured
              </span>
            )}
          </div>
          {trendingRank !== undefined && (
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-amber-500 text-white dark:bg-amber-400 dark:text-[#171B19] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider shadow-md backdrop-blur">
              <TrendingUp size={11} /> #{trendingRank} Trending
            </span>
          )}
        </Link>

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              to={`/author/${encodeURIComponent(post.author)}`}
              className="inline-flex items-center gap-2 hover:text-moss dark:hover:text-primary transition-colors group/author"
              aria-label={`View ${post.author}'s profile`}
            >
              <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-accent/30 text-[10px] font-bold text-moss dark:text-primary">
                {post.authorProfileImagePath ? (
                  <img src={imageUrl(post.authorProfileImagePath)} alt={post.author} className="size-full object-cover" />
                ) : (
                  post.author.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="font-semibold text-ink group-hover/author:underline">{post.author}</span>
            </Link>
            <span>·</span>
            <span>
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recently"}
            </span>
          </div>

          <Link to={`/blogs/${post.slug}`}>
            <h3 className="mt-3.5 font-display text-xl sm:text-2xl font-bold leading-snug tracking-tight text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {post.excerpt && (
            <p className="mt-2.5 text-sm leading-relaxed text-muted line-clamp-2">
              {post.excerpt}
            </p>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 2).map((tag) => (
                <Link
                  key={tag.id}
                  to={`/tag/${tag.slug}`}
                  className="rounded-full bg-paper px-2.5 py-0.5 text-[10px] font-semibold text-muted transition hover:text-moss dark:hover:text-primary"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/[.06] dark:border-white/[.08] px-6 py-4 text-xs">
        <div className="flex items-center gap-3.5 font-semibold text-muted">
          <span className="inline-flex items-center gap-1">
            <Heart size={13} className="text-red-500" /> {post.likeCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquareText size={13} /> {post.commentCount ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {readMinutes}m
          </span>
        </div>
        <Link
          to={`/blogs/${post.slug}`}
          className="inline-flex items-center gap-1 font-bold text-moss dark:text-primary transition hover:underline"
        >
          Read <ArrowUpRight size={14} />
        </Link>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   RECOMMENDED STORY CARD
   ══════════════════════════════════════════════════════════════════════ */

export function RecommendedStoryCard({ post }: { post: BlogPost }) {
  const wordCount = (post.excerpt || post.title || "").split(/\s+/).length * 10;
  const readMinutes = Math.max(2, Math.round(wordCount / 60));

  return (
    <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft">
      <div>
        <Link
          to={`/blogs/${post.slug}`}
          className="relative block aspect-[16/10] w-full overflow-hidden bg-black/5 dark:bg-white/5"
          aria-label={post.title}
        >
          {post.featuredImagePath ? (
            <img
              src={imageUrl(post.featuredImagePath)}
              alt={post.title}
              className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
              <BookOpenMark />
            </div>
          )}
          {post.category && (
            <span className="absolute left-3 top-3 rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
              {post.category}
            </span>
          )}
        </Link>

        <div className="p-5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Link
              to={`/author/${encodeURIComponent(post.author)}`}
              className="inline-flex items-center gap-2 hover:text-moss dark:hover:text-primary transition-colors group/author min-w-0"
              aria-label={`View ${post.author}'s profile`}
            >
              <span className="grid size-5 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/30 text-[10px] font-bold text-moss dark:text-primary">
                {post.authorProfileImagePath ? (
                  <img src={imageUrl(post.authorProfileImagePath)} alt={post.author} className="size-full object-cover" />
                ) : (
                  (post.author || "A").slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="font-semibold text-ink truncate max-w-[110px] group-hover/author:underline">{post.author}</span>
            </Link>
            <span>·</span>
            <span>
              {post.publishedAt
                ? new Date(post.publishedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recently"}
            </span>
          </div>

          <Link to={`/blogs/${post.slug}`} className="block mt-2.5 group-hover:text-moss dark:group-hover:text-primary transition-colors">
            <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-ink line-clamp-2">
              {post.title}
            </h3>
          </Link>

          {post.excerpt && (
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted line-clamp-2">
              {post.excerpt}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-black/[.06] dark:border-white/[.08] px-5 py-3.5 text-xs">
        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
          <Clock size={12} /> {readMinutes} min read
        </span>
        <Link
          to={`/blogs/${post.slug}`}
          className="inline-flex items-center gap-1 font-bold text-moss dark:text-primary transition hover:underline"
        >
          Read story <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   RICH EDITORIAL CATEGORY CARD (Phase 2B)
   ══════════════════════════════════════════════════════════════════════ */

export function CategoryCard({ category }: { category: Taxonomy }) {
  const [imgError, setImgError] = useState(false);
  const storyCount = category.postCount ?? 0;
  const countLabel = storyCount === 1 ? "1 Story" : `${storyCount} Stories`;

  return (
    <Link
      to={`/category/${category.slug}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-moss/40 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-moss dark:focus-visible:outline-primary"
      aria-label={`Explore ${category.name} — ${countLabel}`}
    >
      <div>
        {/* Cover Image Container with Consistent 16:10 Ratio */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/5 dark:bg-white/5">
          {category.imagePath && !imgError ? (
            <img
              src={imageUrl(category.imagePath)}
              alt={category.name}
              className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="grid size-full place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
              <span className="grid size-12 place-items-center rounded-2xl bg-surface/90 text-moss dark:text-primary shadow-sm backdrop-blur">
                <Sparkles size={24} />
              </span>
            </div>
          )}

          {/* Vignette gradient overlay for depth and high contrast text */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

          {/* Floating Category Story Count Pill */}
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 dark:bg-black/75 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur shadow-sm border border-white/10">
            {countLabel}
          </span>
        </div>

        {/* Card Content: Title & Short Description */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-moss dark:text-primary">
              Collection
            </span>
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold leading-snug tracking-tight text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary">
            {category.name}
          </h3>
          <p className="mt-2 text-xs sm:text-sm leading-relaxed text-muted line-clamp-2">
            {category.description || `Explore thoughtful essays, blueprints, and guides in ${category.name}.`}
          </p>
        </div>
      </div>

      {/* Footer CTA cue */}
      <div className="border-t border-black/[.06] dark:border-white/[.08] px-5 sm:px-6 py-3.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-moss dark:text-primary bg-paper/40 dark:bg-surface-elevated/40">
        <span>Explore Collection</span>
        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NEWSLETTER SUBSCRIPTION SECTION (Phase 2C — Letters Worth Reading)
   ══════════════════════════════════════════════════════════════════════ */

export function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setStatusMessage({ type: "error", text: "Please provide a valid email address." });
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<{
        message: string;
        status: string;
        emailDelivered: boolean;
        providerConfigured: boolean;
        devVerificationToken?: string;
      }>("/public/newsletter/subscribe", { email: cleanEmail });

      const msg = response.data?.message || "Thank you for subscribing! Please check your email to verify your subscription.";
      setStatusMessage({ type: "success", text: msg });
      setEmail("");

      await showSuccess(msg, "Subscription Received");
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message || err?.message || "Failed to subscribe. Please try again later.";
      setStatusMessage({ type: "error", text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section aria-label="Newsletter Subscription" className="overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card sm:p-14 relative">
      <div className="max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 dark:bg-accent/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
          <Mail size={13} /> Weekly Editorial Dispatch
        </span>
        <h2 className="mt-5 font-display text-3xl font-bold text-ink sm:text-4xl">
          Letters Worth Reading
        </h2>
        <p className="mt-3 text-muted leading-relaxed">
          Get thoughtful stories, ideas, and insights from Fieldnotes Journal delivered to your inbox.
        </p>

        <form onSubmit={handleSubscribe} className="mt-6 flex flex-col sm:flex-row gap-3 max-w-lg">
          <div className="relative flex-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@domain.com"
              required
              aria-label="Email address for newsletter"
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-paper/60 dark:bg-background/60 px-4 py-3 text-sm text-ink placeholder:text-muted focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/20 dark:focus:border-primary dark:focus:ring-primary/20 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-moss dark:bg-primary px-6 py-3 text-sm font-bold text-white dark:text-[#171B19] shadow-sm hover:opacity-90 disabled:opacity-50 transition-all shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Subscribing...</span>
              </>
            ) : (
              <>
                <span>Subscribe</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </form>

        {statusMessage && (
          <div
            className={`mt-4 rounded-xl p-3.5 text-xs font-medium leading-relaxed max-w-lg flex items-start gap-2.5 ${
              statusMessage.type === "success"
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20"
                : statusMessage.type === "error"
                ? "bg-red-500/10 text-red-800 dark:text-red-300 border border-red-500/20"
                : "bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
            )}
            <div>
              <p>{statusMessage.text}</p>
              <p className="mt-1 text-[11px] opacity-80">
                Notice: Double opt-in verification required. Subscriptions remain pending until confirmed.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 text-[11px] text-muted">
          <Shield size={12} className="text-moss dark:text-primary shrink-0" />
          <span>Double opt-in verification. Strictly no spam, unsubscribe with one click anytime.</span>
        </div>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   HOME PAGE (CONTEMPORARY DIGITAL MAGAZINE)
   ══════════════════════════════════════════════════════════════════════ */

export function HomePage() {
  const { data, loading, error } = useRequest<HomeData>("/public/homepage");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  function handleSearchSubmit(query?: string) {
    const q = typeof query === "string" ? query : searchQuery;
    if (q.trim()) {
      navigate(`/blogs?search=${encodeURIComponent(q.trim())}`);
    }
  }

  if (loading) {
    return (
      <div className="space-y-16 sm:space-y-20 lg:space-y-24">
        <HeroSkeleton />
        <section>
          <div className="mb-8 border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <SkeletonBox className="h-4 w-36 mb-2" />
            <SkeletonBox className="h-8 w-64" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <PostCardSkeleton count={6} />
          </div>
        </section>
      </div>
    );
  }
  if (error || !data) return <Notice>{error ?? "Could not load the homepage."}</Notice>;

  const lead = data.featuredPosts[0];
  const sideDispatches = data.featuredPosts.slice(1, 4).length > 0
    ? data.featuredPosts.slice(1, 4)
    : data.latestPosts.filter((p) => p.id !== lead?.id).slice(0, 3);
  const spotlightPost = data.featuredPosts.length > 4 ? data.featuredPosts[4] : (data.trendingPosts?.[0] ?? data.popularPosts?.[0]);
  const trendingStories = (data.trendingPosts && data.trendingPosts.length > 0)
    ? data.trendingPosts
    : data.popularPosts;

  return (
    <div className="space-y-16 sm:space-y-20 lg:space-y-24">
      <Seo
        title={data.seo?.title ?? "Fieldnotes — Ideas Worth Keeping"}
        description={
          data.seo?.description ??
          "Thoughtful stories, practical guides, and fresh perspectives from writers and thinkers."
        }
        keywords={data.seo?.keywords}
        canonicalUrl={data.seo?.canonicalUrl}
        ogTitle={data.seo?.ogTitle}
        ogDescription={data.seo?.ogDescription}
        ogImage={data.seo?.ogImageUrl}
        twitterTitle={data.seo?.twitterTitle}
        twitterDescription={data.seo?.twitterDescription}
        twitterImage={data.seo?.twitterImageUrl}
        robotsIndex={data.seo?.robotsIndex}
        robotsFollow={data.seo?.robotsFollow}
      />

      {/* 1. EDITORIAL MAGAZINE HERO SECTION */}
      <section className="relative">
        {/* Editorial Top Headline Banner */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between border-b-2 border-black/10 dark:border-white/10 pb-4 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
              <Sparkles size={14} />
              <span>The Front Page · Edition {new Date().getFullYear()}</span>
            </div>
            <h1 className="mt-1 font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink">
              Ideas worth <em className="font-normal italic text-moss dark:text-primary">keeping</em>.
            </h1>
          </div>
          <div className="w-full sm:w-80 shrink-0">
            <SearchAutocomplete
              value={searchQuery}
              onChange={setSearchQuery}
              onSubmit={handleSearchSubmit}
              placeholder="Search stories, ideas..."
              inputClassName="!py-2 text-xs"
              dropdownClassName="left-0 sm:right-0 sm:left-auto w-full sm:w-[400px]"
              availableCategories={data.categories}
            />
          </div>
        </div>

        {/* Asymmetric Hero Grid (Left 7 Cols: Lead Story, Right 5 Cols: Curated Digest) */}
        {lead ? (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-stretch">
            {/* Left Column: Lead Cover Story */}
            <div className="lg:col-span-7 flex flex-col">
              <PostCard post={lead} featured />
            </div>

            {/* Right Column: The Editorial Digest (Numbered 01, 02, 03) */}
            <div className="lg:col-span-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 sm:p-8 shadow-card flex flex-col justify-between h-full">
              <div>
                <div className="flex items-center justify-between border-b border-black/[.08] dark:border-white/[.08] pb-3 mb-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-moss dark:text-primary flex items-center gap-1.5">
                    <Sparkles size={13} className="text-amber-500 fill-amber-500" />
                    Featured Stories · Curated
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Editorial Selection
                  </span>
                </div>
                <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
                  {sideDispatches.map((post, idx) => (
                    <PostCard key={post.id} post={post} variant="compact" index={idx} />
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t border-black/[.08] dark:border-white/[.08] pt-4 flex items-center justify-between text-xs">
                <span className="text-muted font-medium">Looking for more topics?</span>
                <Link
                  to="/blogs"
                  className="inline-flex items-center gap-1 font-bold text-moss dark:text-primary hover:underline uppercase tracking-wider"
                >
                  Browse all <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-12 text-center">
            <h2 className="font-display text-3xl font-bold text-ink">Welcome to Fieldnotes Journal</h2>
            <p className="mt-3 text-muted">Published essays and dispatches will appear here soon.</p>
          </div>
        )}
      </section>

      {/* 2. RICH EDITORIAL CATEGORY CARDS (Phase 2B — Explore by Category) */}
      <section aria-label="Explore by Category">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4 gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">
              <Sparkles size={14} />
              <span>Curated Collections</span>
            </div>
            <h2 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
              Explore by Category
            </h2>
          </div>
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
          >
            All collections <ArrowRight size={14} />
          </Link>
        </div>

        {data.categories && data.categories.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mx-auto w-full">
            {data.categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        ) : (
          <EmptyState title="No categories available">
            Categories will appear here once published by editors.
          </EmptyState>
        )}
      </section>

      {/* 3. EDITORIAL SPOTLIGHT SECTION */}
      {spotlightPost && (
        <section>
          <div className="mb-6 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Editorial Spotlight</p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">Worth a closer read</h2>
            </div>
          </div>
          <PostCard post={spotlightPost} variant="spotlight" />
        </section>
      )}

      {/* 4. LATEST STORIES MAGAZINE GRID */}
      <section>
        <div className="mb-8 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Just Published</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Fresh from the journal</h2>
          </div>
          <Link
            to="/blogs?sort=latest"
            className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline sm:flex"
          >
            View all stories <ArrowRight size={14} />
          </Link>
        </div>

        {data.latestPosts.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.latestPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <EmptyState title="The first story is on its way">
            Come back soon for fresh ideas and new perspectives.
          </EmptyState>
        )}
      </section>

      {/* 5. SMART TRENDING STORIES (Time-Decay Engagement Model — Phase 2A) */}
      {trendingStories && trendingStories.length > 0 && (
        <section aria-label="Trending Stories">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4 gap-2">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                <Flame size={14} className="fill-amber-500 text-amber-500 animate-pulse" />
                <span>Trending Now · Reader Velocity</span>
              </div>
              <h2 className="mt-1 font-display text-3xl sm:text-4xl font-bold tracking-tight text-ink">
                Stories gaining momentum
              </h2>
            </div>
            <Link
              to="/blogs?sort=popular"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
            >
              View all trending <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trendingStories.map((post, rank) => (
              <PostCard key={post.id} post={post} trendingRank={rank + 1} />
            ))}
          </div>
        </section>
      )}

      {/* 6. TRENDING TOPIC LABELS / TAGS */}
      {data.tags && data.tags.length > 0 && (
        <section>
          <div className="mb-6 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Topic Index</p>
              <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">Trending labels</h2>
            </div>
            <Link to="/tags" className="text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline">
              All tags <ArrowRight className="inline" size={14} />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {data.tags.map((tag) => (
              <Link
                key={tag.id}
                to={`/tag/${tag.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-semibold text-muted shadow-sm transition hover:border-moss/40 hover:bg-paper hover:text-ink"
              >
                <TagIcon size={12} className="text-moss dark:text-primary" />
                #{tag.name}
                {tag.postCount !== undefined && <span className="text-[10px] text-muted">({tag.postCount})</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 7. NEWSLETTER SUBSCRIPTION (Phase 2C — Letters Worth Reading) */}
      <NewsletterSection />

      {/* 8. CREATOR / CONTRIBUTOR CALLOUT */}
      <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface-elevated p-8 shadow-card sm:flex sm:items-center sm:justify-between sm:p-12">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Voices of the Journal</p>
          <h2 className="mt-2 max-w-xl font-display text-3xl font-bold text-ink sm:text-4xl">
            Your perspective belongs in the conversation.
          </h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Whether you are documenting software craft, reflecting on design, or sharing lived experiences.
          </p>
        </div>
        <Link
          to="/register"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-moss dark:bg-primary px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90 sm:mt-0"
        >
          Start writing <ArrowUpRight size={16} />
        </Link>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   BLOG LISTING PAGE
   ══════════════════════════════════════════════════════════════════════ */

export function BlogListPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const categoryFilter = params.get("category") ?? "";
  const tagFilter = params.get("tag") ?? "";
  const sortOption = params.get("sort") ?? "latest";
  const page = Number(params.get("page") ?? 1);

  // Load categories and tags for filter dropdowns
  const { data: categoriesData } = useRequest<PageResult<Taxonomy>>("/public/categories?page=1&limit=50");
  const { data: tagsData } = useRequest<PageResult<Taxonomy>>("/public/tags?page=1&limit=50");

  const queryUrl = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", "9");
    if (params.get("search")) q.set("search", params.get("search")!);
    if (categoryFilter) q.set("category", categoryFilter);
    if (tagFilter) q.set("tag", tagFilter);
    if (sortOption) q.set("sort", sortOption);
    return `/public/posts?${q.toString()}`;
  }, [page, params, categoryFilter, tagFilter, sortOption]);

  const { data, loading, error } = useRequest<PageResult<BlogPost>>(queryUrl);

  const categoriesList: Taxonomy[] = Array.isArray(categoriesData)
    ? categoriesData
    : (categoriesData?.data ?? []);
  const tagsList: Taxonomy[] = Array.isArray(tagsData)
    ? tagsData
    : (tagsData?.data ?? []);
  const postsList: BlogPost[] = Array.isArray(data)
    ? data
    : (data?.data ?? []);
  const paginationData = (data as any)?.pagination;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (search.trim()) next.set("search", search.trim());
    else next.delete("search");
    next.set("page", "1");
    setParams(next);
  }

  function handleFilterChange(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set("page", "1");
    setParams(next);
  }

  function clearFilter(key: string) {
    const next = new URLSearchParams(params);
    next.delete(key);
    if (key === "search") setSearch("");
    next.set("page", "1");
    setParams(next);
  }

  function clearAllFilters() {
    setSearch("");
    setParams(new URLSearchParams({ page: "1", sort: "latest" }));
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    setParams(next);
  }

  const hasActiveFilters = Boolean(search || categoryFilter || tagFilter || sortOption !== "latest");

  return (
    <>
      <Seo
        title="Stories for Curious Minds — Fieldnotes"
        description="Browse, filter, and explore thoughtful articles, guides, and stories."
      />
      <PageHeading
        eyebrow="The Journal"
        title="Explore all stories."
        description="Filter by topic, label, or popularity to find exactly what you're looking for."
      />

      {/* Filter & Search Toolbar */}
      <div className="mb-10 space-y-4 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-8">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="field !pl-11"
              placeholder="Search by title, excerpt, or keywords..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  clearFilter("search");
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Button type="submit" className="shadow-sm">
            Search
          </Button>
        </form>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Filter by Category"
            value={categoryFilter}
            onChange={(e) => handleFilterChange("category", e.target.value)}
          >
            <option value="">All Categories</option>
            {categoriesList.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Filter by Tag"
            value={tagFilter}
            onChange={(e) => handleFilterChange("tag", e.target.value)}
          >
            <option value="">All Tags</option>
            {tagsList.map((tag) => (
              <option key={tag.id} value={tag.slug}>
                #{tag.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Sort By"
            value={sortOption}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
          >
            <option value="latest">Latest Stories</option>
            <option value="popular">Most Popular (Likes)</option>
          </SelectField>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] dark:border-white/[.08] pt-4 text-xs">
            <span className="font-semibold text-muted">Active filters:</span>
            {params.get("search") && (
              <button
                type="button"
                onClick={() => clearFilter("search")}
                className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 font-semibold text-ink hover:text-red-600 transition"
              >
                <span>Search: &ldquo;{params.get("search")}&rdquo;</span>
                <X size={12} />
              </button>
            )}
            {categoryFilter && (
              <button
                type="button"
                onClick={() => clearFilter("category")}
                className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 font-semibold text-ink hover:text-red-600 transition"
              >
                <span>Category: {categoryFilter}</span>
                <X size={12} />
              </button>
            )}
            {tagFilter && (
              <button
                type="button"
                onClick={() => clearFilter("tag")}
                className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 font-semibold text-ink hover:text-red-600 transition"
              >
                <span>Tag: #{tagFilter}</span>
                <X size={12} />
              </button>
            )}
            {sortOption !== "latest" && (
              <button
                type="button"
                onClick={() => clearFilter("sort")}
                className="inline-flex items-center gap-1 rounded-full bg-paper px-3 py-1 font-semibold text-ink hover:text-red-600 transition"
              >
                <span>Sort: {sortOption}</span>
                <X size={12} />
              </button>
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="ml-auto text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
            >
              Reset all
            </button>
          </div>
        )}
      </div>

      {/* Story Grid */}
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCardSkeleton count={6} />
        </div>
      ) : error ? (
        <Notice>{error}</Notice>
      ) : postsList.length ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {postsList.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 9}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={changePage}
            />
          )}
        </>
      ) : (
        <EmptyState
          title="No stories found matching your criteria"
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                variant="primary"
                onClick={clearAllFilters}
                className="shadow-sm uppercase tracking-wider text-xs"
              >
                Clear all filters
              </Button>
              <Link
                to="/categories"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 bg-surface px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink shadow-sm hover:bg-paper transition-all"
              >
                Browse collections
              </Link>
            </div>
          }
        >
          <p className="mb-4 text-sm text-muted">
            We couldn't find any articles matching {search ? `"${search}"` : "your selected filters"}.
            Try refining your keywords or explore our curated collections below.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Suggestions:</span>
            {["Web Development", "Cloud & DevOps", "Software Architecture", "UI/UX Design"].map((catName) => (
              <button
                key={catName}
                type="button"
                onClick={() => {
                  const matchingCat = categoriesList.find((c) => c.name.toLowerCase() === catName.toLowerCase());
                  if (matchingCat) {
                    handleFilterChange("category", matchingCat.slug);
                  } else {
                    handleFilterChange("search", catName);
                  }
                }}
                className="rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1 text-xs font-semibold text-moss dark:text-primary hover:bg-paper transition"
              >
                {catName}
              </button>
            ))}
          </div>
        </EmptyState>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   TAXONOMY LIST PAGE (CATEGORIES / TAGS)
   ══════════════════════════════════════════════════════════════════════ */

export function TaxonomyListPage({ kind }: { kind: "categories" | "tags" }) {
  const { data, loading, error } = useRequest<PageResult<Taxonomy>>(`/public/${kind}?page=1&limit=100`);
  const noun = kind === "categories" ? "Categories" : "Tags";
  const path = kind === "categories" ? "/category/" : "/tag/";

  return (
    <>
      <Seo
        title={`Browse ${noun} — Fieldnotes`}
        description="Follow an interest and find stories that speak your language."
      />
      <PageHeading
        eyebrow="Explore"
        title={`Browse ${noun}.`}
        description="Follow an interest and find stories that speak your language."
      />
      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <PostCardSkeleton count={6} />
        </div>
      ) : error ? (
        <Notice>{error}</Notice>
      ) : data?.data.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.data.map((item) => (
            <Link
              key={item.id}
              to={`${path}${item.slug}`}
              className="group rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary">
                  <Sparkles size={20} />
                </span>
                <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-moss dark:text-primary">
                  {item.postCount ?? 0} {Number(item.postCount ?? 0) === 1 ? "story" : "stories"}
                </span>
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary">
                {item.name}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-2">
                {item.description || `Read the latest published stories and discussions about ${item.name.toLowerCase()}.`}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${noun.toLowerCase()} yet`}>Published topics will show up here.</EmptyState>
      )}
    </>
  );
}

interface TaxonomyPosts {
  category?: Taxonomy & { imagePath?: string };
  tag?: Taxonomy;
  posts: BlogPost[];
}

export function CategoryPage({ kind }: { kind: "categories" | "tags" }) {
  const { slug = "" } = useParams();
  const page = 1;
  const endpoint = kind === "categories" ? "categories" : "tags";
  const { data, loading, error } = useRequest<TaxonomyPosts>(
    `/public/${endpoint}/${encodeURIComponent(slug)}/posts?page=${page}&limit=20`,
  );
  const taxonomy = data?.category ?? data?.tag;

  return (
    <>
      <Link
        to={`/${endpoint}`}
        className="mb-8 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
      >
        <ArrowDown className="rotate-90" size={14} /> All {endpoint}
      </Link>
      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PostCardSkeleton count={6} />
        </div>
      ) : error ? (
        <Notice>{error}</Notice>
      ) : (
        <>
          <Seo
            title={`${taxonomy?.name ?? "Stories"} — Fieldnotes`}
            description={taxonomy?.description ?? undefined}
            image={data?.category?.imagePath}
          />
          <PageHeading
            eyebrow={kind === "categories" ? "Category Archive" : "Topic Tag"}
            title={taxonomy?.name ?? "Stories"}
            description={taxonomy?.description ?? undefined}
          />
          {kind === "categories" && data?.category?.imagePath && (
            <img
              src={imageUrl(data.category.imagePath)}
              alt={taxonomy?.name}
              className="mb-10 aspect-[21/9] w-full rounded-3xl object-cover shadow-soft border border-black/[.08] dark:border-white/[.08]"
            />
          )}
          {data?.posts.length ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {data.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <EmptyState title="No stories here yet">There are no published stories in this collection yet.</EmptyState>
          )}
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SINGLE BLOG DETAILS PAGE
   ══════════════════════════════════════════════════════════════════════ */

interface DetailPost extends BlogPost {
  id: string;
  content: string;
  categoryName: string;
  categorySlug: string;
  tags: Taxonomy[];
  comments: Array<{
    id: string;
    content: string;
    createdAt: string;
    username: string;
    profileImagePath: string | null;
  }>;
  images: Array<{ id: string; path: string; caption?: string | null }>;
  relatedPosts?: BlogPost[];
  isLiked?: boolean;
  isBookmarked?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImageUrl?: string | null;
  robotsIndex?: boolean | number | null;
  robotsFollow?: boolean | number | null;
}

export function BlogDetailPage() {
  const { slug = "" } = useParams();
  const { data, loading, error } = useRequest<DetailPost>(`/public/posts/${encodeURIComponent(slug)}`);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const [activeSpeechDomId, setActiveSpeechDomId] = useState<string | null>(null);

  // Phase 1G: Multilingual listening & Hindi translation support
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

  const displayTitle = listeningLanguage === "hi" && translatedArticle ? translatedArticle.title : data?.title || "";
  const displayExcerpt = listeningLanguage === "hi" && translatedArticle ? (translatedArticle.excerpt ?? data?.excerpt) : data?.excerpt;
  const displayContent = listeningLanguage === "hi" && translatedArticle ? translatedArticle.content : data?.content || "";

  const contentRef = useRef<HTMLDivElement>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");

  const headings = useMemo(() => {
    return displayContent ? extractHeadings(displayContent) : [];
  }, [displayContent]);

  useEffect(() => {
    if (headings.length === 0) return;

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
        rootMargin: "0px 0px -65% 0px",
        threshold: 0,
      }
    );

    headingElements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [headings]);

  useEffect(() => {
    if (!data) return;
    setLikeCount(Number(data.likeCount ?? 0));
    setLiked(false);
    if (user) {
      api
        .get<{ data: { liked: boolean; likeCount: number } }>(`/user/posts/${data.id}/like`)
        .then((response) => {
          setLiked(response.data.data.liked);
          setLikeCount(response.data.data.likeCount);
        })
        .catch((requestError: unknown) => setActionError(getErrorMessage(requestError)));

      api
        .get<{ data: { isBookmarked: boolean } }>(`/user/bookmarks/${data.id}/status`)
        .then((response) => {
          setBookmarked(response.data.data.isBookmarked);
        })
        .catch(() => {
          // Fall back to initial data.isBookmarked
          if (data.isBookmarked !== undefined) {
            setBookmarked(Boolean(data.isBookmarked));
          }
        });
    } else {
      setBookmarked(Boolean(data.isBookmarked));
    }
  }, [data, user]);

  async function handleToggleBookmark() {
    if (!user) {
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!data || bookmarkLoading) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        await api.delete(`/user/bookmarks/${data.id}`);
        setBookmarked(false);
        showToast({ title: "Removed from saved stories", icon: "success" });
      } else {
        await api.post(`/user/bookmarks/${data.id}`);
        setBookmarked(true);
        showToast({ title: "Saved to your reading list", icon: "success" });
      }
    } catch (err) {
      await showError("Bookmark Error", getErrorMessage(err));
    } finally {
      setBookmarkLoading(false);
    }
  }

  const jsonLd = data
    ? {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: data.title,
        description: data.seoDescription ?? data.excerpt ?? "",
        image: imageUrl(data.ogImageUrl ?? data.featuredImagePath) ?? undefined,
        author: {
          "@type": "Person",
          name: data.author,
        },
        datePublished: data.publishedAt,
        publisher: {
          "@type": "Organization",
          name: "Fieldnotes",
        },
        mainEntityOfPage: data.canonicalUrl || window.location.href,
      }
    : null;

  async function likePost() {
    if (!user) {
      const willLogin = await confirmAction({
        title: "Sign in required",
        text: "You must be signed in to appreciate stories on Fieldnotes.",
        confirmText: "Sign In",
        cancelText: "Stay Here",
        icon: "info",
      });
      if (willLogin) navigate("/login");
      return;
    }
    try {
      const result = liked
        ? await api.delete<{ data: { liked: boolean; likeCount: number } }>(`/user/posts/${data!.id}/like`)
        : await api.post<{ data: { liked: boolean; likeCount: number } }>(`/user/posts/${data!.id}/like`);
      setLiked(result.data.data.liked);
      setLikeCount(result.data.data.likeCount);
      setMessage(result.data.data.liked ? "You liked this blog post." : "Like removed.");
      showToast({
        title: result.data.data.liked ? "Story appreciated" : "Appreciation removed",
        icon: "success",
      });
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Appreciation Failed", msg);
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    if (!user) {
      const willLogin = await confirmAction({
        title: "Sign in required",
        text: "Please sign in to join the reader discussion.",
        confirmText: "Sign In",
        cancelText: "Cancel",
        icon: "info",
      });
      if (willLogin) navigate("/login");
      return;
    }
    if (!comment.trim()) {
      await showWarning("Comment Empty", "Please write a thoughtful comment before submitting.");
      return;
    }
    try {
      await api.post(`/public/posts/${encodeURIComponent(slug)}/comments`, { content: comment.trim() });
      setComment("");
      setActionError(null);
      setMessage("Your comment has been submitted and is pending administrator approval.");
      await showSuccess(
        "Perspective Submitted",
        "Thank you for sharing your thoughts. Your perspective has been sent to our editors for moderation."
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Comment Submission Failed", msg);
    }
  }

  if (loading) return <ArticleDetailSkeleton />;
  if (error || !data) return <Notice>{error ?? "Story not found."}</Notice>;

  const wordCount = (displayContent || "").trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <article className="mx-auto max-w-5xl">
      {/* Distraction-Free Reading Mode Modal Overlay (Phase 1E) */}
      {isReadingMode && (
        <ReadingMode
          post={
            listeningLanguage === "hi" && translatedArticle
              ? { ...data, title: displayTitle, excerpt: displayExcerpt ?? null, content: displayContent }
              : data
          }
          onClose={() => setIsReadingMode(false)}
          bookmarked={bookmarked}
          onToggleBookmark={handleToggleBookmark}
          bookmarkLoading={bookmarkLoading}
          liked={liked}
          likeCount={likeCount}
          onLike={likePost}
        />
      )}

      {/* 1. Thin Reading Progress Bar based strictly on story reading content */}
      <ReadingProgressBar targetRef={contentRef} />

      <Seo
        title={data.seoTitle ?? data.title}
        description={data.seoDescription ?? data.excerpt ?? undefined}
        keywords={data.seoKeywords}
        canonicalUrl={data.canonicalUrl}
        image={data.ogImageUrl ?? data.featuredImagePath}
        ogTitle={data.ogTitle ?? data.seoTitle ?? data.title}
        ogDescription={data.ogDescription ?? data.seoDescription ?? data.excerpt}
        ogImage={data.ogImageUrl ?? data.featuredImagePath}
        twitterTitle={data.twitterTitle ?? data.seoTitle ?? data.title}
        twitterDescription={data.twitterDescription ?? data.seoDescription ?? data.excerpt}
        twitterImage={data.twitterImageUrl ?? data.ogImageUrl ?? data.featuredImagePath}
        robotsIndex={data.robotsIndex}
        robotsFollow={data.robotsFollow}
        type="article"
        jsonLd={jsonLd}
      />

      <Link
        to="/blogs"
        className="mb-8 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
      >
        <ArrowDown className="rotate-90" size={14} /> Back to all stories
      </Link>

      {/* Article Header: Category, Hindi View Badge, Reading Time, Editorial Title, Author Meta & Action Buttons */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link
            to={`/category/${data.categorySlug}`}
            className="inline-flex rounded-full border border-black/10 dark:border-white/10 bg-accent/30 dark:bg-accent/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary transition hover:bg-accent/50"
          >
            {data.categoryName}
          </Link>
          {listeningLanguage === "hi" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
              हिंदी अनुवाद (Hindi View)
            </span>
          )}
          <span className="text-muted text-xs">·</span>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            {readTime} min read
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.22] sm:leading-[1.15] lg:leading-[1.1] tracking-tight text-ink">
          {displayTitle}
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-black/[.08] dark:border-white/[.08] pb-6 text-xs text-muted sm:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/author/${encodeURIComponent(data.author)}`}
              className="flex items-center gap-2.5 hover:text-moss dark:hover:text-primary transition-colors group/author"
            >
              <span className="grid size-9 place-items-center overflow-hidden rounded-full bg-accent/30 text-sm font-bold text-moss dark:text-primary">
                {data.authorProfileImagePath ? (
                  <img src={imageUrl(data.authorProfileImagePath)} alt="" className="size-full object-cover" />
                ) : (
                  data.author.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="font-semibold text-ink group-hover/author:underline">{data.author}</span>
            </Link>
            <span>·</span>
            <span>
              {data.publishedAt
                ? new Date(data.publishedAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recently published"}
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Eye size={14} /> {data.viewCount ?? 0} views
            </span>
          </div>

          {/* Bookmark & Reading Mode Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleBookmark}
              disabled={bookmarkLoading}
              aria-label={bookmarked ? "Remove bookmark" : "Save story"}
              title={bookmarked ? "Saved to your reading list" : "Save this story to read later"}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all border ${
                bookmarked
                  ? "border-moss/40 bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary font-bold shadow-sm"
                  : "border-black/10 dark:border-white/10 text-muted hover:text-ink hover:border-black/20"
              } disabled:opacity-50`}
            >
              <Bookmark size={14} fill={bookmarked ? "currentColor" : "none"} />
              <span>{bookmarked ? "Saved" : "Save"}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReadingMode(true)}
              aria-label="Enter distraction-free reading mode"
              title="Distraction-Free Reading Mode (Zen view)"
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:text-moss dark:hover:text-primary hover:border-moss/30 dark:hover:border-primary/30 transition-all shadow-sm"
            >
              <BookOpen size={14} className="text-moss dark:text-primary" />
              <span>Reading Mode</span>
            </button>
          </div>
        </div>
      </header>

      {/* Listen to Article Audio Player (Phase 1F + 1G) */}
      <ArticleAudioPlayer
        content={data.content}
        title={data.title}
        excerpt={data.excerpt}
        storyId={data.id}
        onSegmentChange={setActiveSpeechDomId}
        onLanguageChange={handleLanguageChange}
        variant="card"
      />

      {/* Featured Cover Image */}
      {data.featuredImagePath && (
        <figure className="mb-12">
          <img
            src={imageUrl(data.featuredImagePath)}
            alt={displayTitle}
            className="max-h-[560px] w-full rounded-3xl object-cover shadow-soft border border-black/[.08] dark:border-white/[.08]"
          />
        </figure>
      )}

      {/* Content Area: Editorial Article Reading Layout with TOC */}
      <div className="relative mb-12">
        {/* Collapsible Table of Contents for Mobile & Tablet (< xl) */}
        {headings.length >= 2 && (
          <div className="mx-auto max-w-3xl xl:hidden mb-8">
            <TableOfContents items={headings} activeId={activeHeadingId} layout="collapsible" />
          </div>
        )}

        <div className={headings.length >= 2 ? "xl:grid xl:grid-cols-[1fr_260px] xl:gap-12 xl:items-start" : ""}>
          <div className="mx-auto max-w-3xl xl:mx-0 xl:max-w-none min-w-0" ref={contentRef}>
            {displayExcerpt && (
              <div className="editorial-pullquote mb-10 border-l-4 border-moss dark:border-primary pl-5 py-2 font-display text-xl italic leading-relaxed text-ink/90">
                &ldquo;{displayExcerpt}&rdquo;
              </div>
            )}

            {/* Article Reading Content with Formatted Headings and Drop-Cap */}
            <ArticleContent content={displayContent} activeSpeechDomId={activeSpeechDomId} />

            {data.images && data.images.length > 0 && (
              <div className="my-10 grid gap-4 sm:grid-cols-2">
                {data.images.map((image) => (
                  <figure key={image.id} className="overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card">
                    <img src={imageUrl(image.path)} alt={image.caption ?? ""} className="aspect-video w-full object-cover" />
                    {image.caption && (
                      <figcaption className="px-4 py-3 text-center text-xs text-muted">{image.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            {/* Tags */}
            {data.tags && data.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {data.tags.map((tag) => (
                  <Link
                    key={tag.id}
                    to={`/tag/${tag.slug}`}
                    className="rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-muted shadow-sm transition hover:border-moss/40 hover:bg-paper hover:text-ink"
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Author Profile Card */}
            <Card className="my-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
              <Link
                to={`/author/${encodeURIComponent(data.author)}`}
                className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/30 font-bold text-moss dark:text-primary shadow-soft hover:opacity-90 transition-opacity"
              >
                {data.authorProfileImagePath ? (
                  <img src={imageUrl(data.authorProfileImagePath)} alt={data.author} className="size-full object-cover" />
                ) : (
                  <span className="text-xl">{data.author.slice(0, 1).toUpperCase()}</span>
                )}
              </Link>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">About the Author</p>
                <h3 className="mt-0.5 font-display text-xl font-bold text-ink">
                  <Link to={`/author/${encodeURIComponent(data.author)}`} className="hover:underline">
                    {data.author}
                  </Link>
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  {data.authorBio || "Author and contributor sharing thoughtful perspectives on Fieldnotes."}
                </p>
              </div>
            </Card>

            {/* Appreciation & Social Sharing Card */}
            <Card className="my-10">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-display text-xl font-bold text-ink">Enjoyed this perspective?</p>
                  <p className="text-xs text-muted mt-0.5">
                    {likeCount} {likeCount === 1 ? "reader appreciated" : "readers appreciated"} this article
                  </p>
                </div>
                <Button variant={liked ? "primary" : "secondary"} onClick={likePost} className="shadow-sm">
                  <Heart size={16} fill={liked ? "currentColor" : "none"} className={liked ? "text-white dark:text-[#171B19]" : "text-red-500"} />
                  {liked ? "Liked" : "Like this story"}
                </Button>
              </div>

              {/* Social Sharing Section */}
              <div className="mt-6 border-t border-black/[.08] dark:border-white/[.08] pt-5">
                <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                    <Share2 size={15} className="text-moss dark:text-primary" />
                    <span>Share this dispatch</span>
                  </div>
                  <SocialShare
                    title={data.title}
                    url={`/blogs/${data.slug}`}
                    excerpt={data.seoDescription ?? data.excerpt}
                  />
                </div>
              </div>
            </Card>

            {/* Previous / Next Editorial Navigator (Phase 3) */}
            {data.relatedPosts && data.relatedPosts.length > 0 && (
              <nav aria-label="Story navigation" className="my-10 grid gap-4 sm:grid-cols-2">
                {data.relatedPosts[0] && (
                  <Link
                    to={`/blogs/${data.relatedPosts[0].slug}`}
                    className="group flex flex-col justify-between rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card hover:border-moss/40 hover:shadow-soft transition-all"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center gap-1.5">
                        <ArrowLeft size={12} className="group-hover:-translate-x-1 transition-transform" /> Previous Story
                      </span>
                      <p className="mt-2.5 font-display text-lg font-bold text-ink line-clamp-2 group-hover:text-moss dark:group-hover:text-primary transition-colors">
                        {data.relatedPosts[0].title}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-black/[.06] dark:border-white/[.08] flex items-center justify-between text-xs text-muted">
                      <span>By {data.relatedPosts[0].author}</span>
                      <span className="font-semibold text-moss dark:text-primary uppercase tracking-wider text-[11px]">Read story</span>
                    </div>
                  </Link>
                )}
                {data.relatedPosts.length > 1 && data.relatedPosts[1] && (
                  <Link
                    to={`/blogs/${data.relatedPosts[1].slug}`}
                    className="group flex flex-col justify-between rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card hover:border-moss/40 hover:shadow-soft transition-all"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted flex items-center justify-end gap-1.5">
                        Next Story <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
                      </span>
                      <p className="mt-2.5 font-display text-lg font-bold text-ink line-clamp-2 text-right group-hover:text-moss dark:group-hover:text-primary transition-colors">
                        {data.relatedPosts[1].title}
                      </p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-black/[.06] dark:border-white/[.08] flex items-center justify-between text-xs text-muted">
                      <span className="font-semibold text-moss dark:text-primary uppercase tracking-wider text-[11px]">Read story</span>
                      <span>By {data.relatedPosts[1].author}</span>
                    </div>
                  </Link>
                )}
              </nav>
            )}

            {message && (
              <div className="mb-6">
                <Notice variant="success">{message}</Notice>
              </div>
            )}
            {actionError && (
              <div className="mb-6">
                <Notice>{actionError}</Notice>
              </div>
            )}

        {/* Community Comments Section */}
        <section className="mt-12 space-y-8 border-t border-black/[.08] dark:border-white/[.08] pt-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Community Exchange</p>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink">Discussion ({data.comments.length})</h2>
            <p className="mt-1 text-xs text-muted">Submissions are reviewed by our editors before appearing publicly.</p>
          </div>

          {/* Comments list */}
          <div className="space-y-4">
            {data.comments.length ? (
              data.comments.map((item) => (
                <Card key={item.id} className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center overflow-hidden rounded-full bg-accent/30 text-sm font-bold text-moss dark:text-primary">
                        {item.profileImagePath ? (
                          <img src={imageUrl(item.profileImagePath)} alt="" className="size-full object-cover" />
                        ) : (
                          item.username.slice(0, 1).toUpperCase()
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-ink">{item.username}</p>
                        <p className="text-xs text-muted">{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Approved
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink/85 whitespace-pre-wrap">{item.content}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted italic">No comments yet. Be the first to start the conversation!</p>
            )}
          </div>

          {/* Comment Form */}
          {user ? (
            <form onSubmit={submitComment} className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-7">
              <h3 className="font-display text-2xl font-bold text-ink">Leave a comment</h3>
              <p className="mt-1 text-xs text-muted">
                Commenting as <strong className="text-ink">{user.username}</strong>. Submissions are reviewed.
              </p>
              <div className="mt-4">
                <TextArea
                  label="Your comment"
                  required
                  minLength={1}
                  maxLength={5000}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Share your thoughts, experiences, or constructive feedback..."
                />
              </div>
              <Button className="mt-4 w-full sm:w-auto shadow-sm">
                <Send size={15} /> Submit comment
              </Button>
            </form>
          ) : (
            <Card className="p-8 text-center">
              <h3 className="font-display text-2xl font-bold text-ink">Join the discussion</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                You must be logged in to leave a comment or like this story.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="rounded-full bg-moss dark:bg-primary px-6 py-2.5 text-sm font-bold text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
                >
                  Log in to comment
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-black/10 dark:border-white/10 bg-surface px-6 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-paper"
                >
                  Create an account
                </Link>
              </div>
            </Card>
          )}
        </section>
          </div>

          {/* Sticky Table of Contents for Desktop (xl:block) */}
          {headings.length >= 2 && (
            <aside className="sticky top-28 hidden xl:block">
              <TableOfContents items={headings} activeId={activeHeadingId} layout="sidebar" />
            </aside>
          )}
        </div>
      </div>

      {/* Related Stories Section */}
      {data.relatedPosts && data.relatedPosts.filter((p) => p.id !== data.id).length > 0 && (
        <section className="mt-16 border-t border-black/[.08] dark:border-white/[.08] pt-12 sm:mt-20 sm:pt-16">
          <div className="mb-8 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Keep Reading</p>
              <h2 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
                More in {data.categoryName}
              </h2>
            </div>
            <Link
              to={`/category/${data.categorySlug}`}
              className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline sm:flex"
            >
              All {data.categoryName} stories <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.relatedPosts
              .filter((p) => p.id !== data.id)
              .slice(0, 3)
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={{
                    ...post,
                    category: post.category || data.categoryName,
                    categorySlug: post.categorySlug || data.categorySlug,
                  }}
                />
              ))}
          </div>
        </section>
      )}
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NOT FOUND (404) PAGE
   ══════════════════════════════════════════════════════════════════════ */

export function NotFoundPage() {
  return (
    <section className="page-wrap py-28 text-center">
      <Seo
        title="404 — Page Not Found | Fieldnotes"
        description="The page you requested could not be found on Fieldnotes Journal."
        robotsIndex={false}
        robotsFollow={false}
      />
      <p className="font-display text-8xl font-bold text-moss dark:text-primary sm:text-9xl">404</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink sm:text-5xl">Page not found.</h1>
      <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted">
        The link may have changed, the article was unpublished, or the page you are looking for has moved to another section.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-moss dark:bg-primary px-7 py-3.5 text-sm font-bold text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
      >
        Back to journal home <ArrowRight size={16} />
      </Link>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CONTACT PAGE (EDITORIAL DESK)
   ══════════════════════════════════════════════════════════════════════ */

export function ContactPage() {
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api.post("/public/contact", Object.fromEntries(form.entries()));
      setSuccess(true);
      formElement.reset();
      await showSuccess(
        "Message Dispatched",
        "Thank you for contacting our editorial desk. Our staff has received your message and will review it promptly."
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Failed to Send Message", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-12 lg:grid-cols-12 lg:gap-16 items-start">
      <Seo
        title="Contact the Editorial Desk — Fieldnotes Digital Magazine"
        description="Reach out to our editorial team with feedback, article pitches, or inquiries."
      />

      {/* Left column (5 cols): Editorial Desk & Pitch Guidelines */}
      <div className="lg:col-span-5 space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
            <Sparkles size={14} />
            <span>Editorial Desk</span>
          </div>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight text-ink">
            Get in touch with our team.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted font-normal leading-relaxed">
            Have a question about a published piece, a research proposal, or constructive feedback? Every message sent through this desk reaches our editorial staff directly.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary">
                <MessageSquareText size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Story Submissions</p>
                <p className="mt-0.5 text-sm font-bold text-ink">Pitching an Article</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  We look for deep research, nuanced analysis, and distinctive voices. Please include a short outline and any relevant previous writing samples.
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary">
                <Mail size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Letters to the Editors</p>
                <p className="mt-0.5 text-sm font-bold text-ink">Reader Correspondence</p>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  We welcome thoughtful responses, corrections, and reflections on our published work. Selected reader letters may be featured in future issues.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Right column (7 cols): Contact Form */}
      <div className="lg:col-span-7">
        <form
          onSubmit={submit}
          className="space-y-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card sm:p-10"
        >
          <div className="border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Direct Message</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Send an inquiry</h2>
          </div>

          {success && (
            <Notice variant="success">Your message has been sent to the editorial team. Thank you for writing to us.</Notice>
          )}
          {error && <Notice>{error}</Notice>}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Your name" name="name" required maxLength={120} placeholder="Jane Doe" />
            <Field label="Email address" name="email" type="email" required maxLength={254} placeholder="jane@example.com" />
          </div>
          <Field label="Subject" name="subject" required maxLength={200} placeholder="Story pitch, feedback, or general inquiry..." />
          <TextArea
            label="Message"
            name="message"
            required
            minLength={10}
            maxLength={10000}
            rows={5}
            placeholder="Share your message with our editors..."
          />
          <Button type="submit" disabled={busy} className="w-full sm:w-auto shadow-sm uppercase tracking-wider text-xs">
            {busy ? "Sending message..." : "Send message"} <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   ABOUT PAGE (EDITORIAL MANIFESTO)
   ══════════════════════════════════════════════════════════════════════ */

export function AboutPage() {
  return (
    <div className="space-y-16 py-4 sm:space-y-20 lg:space-y-24">
      <Seo
        title="About Us &amp; Editorial Mission — Fieldnotes"
        description="Learn more about our publication philosophy, editorial rigor, and team at Fieldnotes."
      />

      {/* Editorial manifesto header */}
      <div className="max-w-4xl border-b-2 border-black/10 dark:border-white/10 pb-10">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
          <Sparkles size={14} />
          <span>The Manifesto</span>
        </div>
        <h1 className="mt-3 font-display text-4xl sm:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight text-ink">
          Good ideas deserve <em className="font-normal text-moss dark:text-primary italic">room</em> to breathe.
        </h1>
        <p className="mt-6 text-lg sm:text-xl leading-relaxed text-muted font-normal max-w-3xl">
          Fieldnotes was founded on an unapologetic belief: the modern web does not need more shallow noise or algorithmic reaction. It needs depth, craft, clarity, and generous storytelling.
        </p>
      </div>

      {/* Mission banner */}
      <div className="relative overflow-hidden rounded-3xl bg-[#263C35] dark:bg-[#1A2520] p-8 text-white shadow-soft sm:p-14 lg:p-16 border border-black/[.08] dark:border-white/[.08]">
        <div className="pointer-events-none absolute -right-16 -top-20 size-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-32 -bottom-20 size-96 rounded-full border border-white/10" />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#B5C5B5] dark:text-[#A8C1AE] backdrop-blur">
            <Sparkles size={14} /> Our Calling
          </span>
          <h2 className="mt-6 font-display text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">
            Less reaction. More reflection. Always human.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg">
            We provide an independent, distraction-free home for thoughtful writers, developers, designers, and essayists to publish work that stands the test of time.
          </p>
        </div>
      </div>

      {/* Editorial Principles & Standards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
        <Card className="p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">01 · Principle</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">Depth Over Speed</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Understanding takes patience. Our contributors are encouraged to explore nuances, revise drafts with editors, and prioritize genuine insight over trending hot takes. Every dispatch is written to be reread.
          </p>
        </Card>

        <Card className="p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">02 · Standard</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">Editorial Rigor</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            From software architecture diagrams to cultural critiques, every article undergoes careful editorial review. We value factual precision, clarity of prose, and deep respect for the reader&apos;s attention.
          </p>
        </Card>

        <Card className="p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">03 · Ethos</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">Craft &amp; Typography</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Reading on screen should feel as tactile and dignified as holding a finely printed journal. We obsess over line lengths, font hierarchy, contrast ratios, and distraction-free layouts.
          </p>
        </Card>

        <Card className="p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">04 · Community</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink">Constructive Discourse</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Comments and feedback are moderated to foster thoughtful exchange. We cultivate a community where experts and curious beginners learn alongside one another.
          </p>
        </Card>
      </div>

      {/* Contributor Call to Action */}
      <div className="flex flex-col items-start gap-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface-elevated p-8 sm:flex-row sm:items-center sm:justify-between sm:p-12 shadow-card">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Join the Roster</p>
          <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">
            Want to contribute your voice?
          </h3>
          <p className="mt-1 text-sm text-muted">
            Submit your essays, field reports, or technical analyses to our editors.
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 rounded-full bg-moss dark:bg-primary px-7 py-3.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
        >
          Create writer account <ArrowUpRight size={16} />
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AUTHENTICATION PAGES (LOGIN / REGISTER)
   ══════════════════════════════════════════════════════════════════════ */

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  function getSafeDestination(role?: string) {
    if (returnUrl && returnUrl.startsWith("/") && !returnUrl.startsWith("//")) {
      return returnUrl;
    }
    return role === "admin" ? "/admin" : "/dashboard";
  }

  useEffect(() => {
    if (user) navigate(getSafeDestination(user.role), { replace: true });
  }, [navigate, user, returnUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      let signedInUser;
      if (isRegister) {
        signedInUser = await register({
          username: String(form.get("username")),
          email,
          password,
          confirmPassword: String(form.get("confirmPassword")),
        });
      } else {
        signedInUser = await login(email, password);
      }
      navigate(getSafeDestination(signedInUser.role));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-6 sm:py-10">
      <Seo
        title={isRegister ? "Join Fieldnotes — Writer Registration" : "Sign In to Fieldnotes — Journal Portal"}
        description="Access your creator portal and member profile on Fieldnotes Digital Magazine."
        robotsIndex={false}
        robotsFollow={false}
      />

      <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card sm:p-10">
        <div className="text-center">
          <Link
            to="/"
            className="inline-grid size-14 place-items-center rounded-2xl bg-moss dark:bg-primary text-lime dark:text-[#171B19] shadow-soft transition hover:scale-105"
          >
            <Sparkles size={24} />
          </Link>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">
            {isRegister ? "The Community" : "Welcome Back"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-black text-ink sm:text-4xl">
            {isRegister ? "Create account" : "Log in to Fieldnotes"}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {isRegister
              ? "Publish stories, engage in respectful discussions, and join our readership."
              : "Access your contributor dashboard and saved dispatches."}
          </p>
        </div>

        {error && (
          <div className="mt-6">
            <Notice>{error}</Notice>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          {isRegister && (
            <Field
              label="Username"
              name="username"
              required
              minLength={3}
              maxLength={50}
              pattern="[A-Za-z0-9_-]+"
              autoComplete="username"
              placeholder="e.g. janedoe"
            />
          )}
          <Field label="Email address" name="email" type="email" required autoComplete="email" placeholder="you@domain.com" />

          {/* Password field with visibility toggle */}
          <div className="relative">
            <Field
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={isRegister ? 12 : 1}
              maxLength={128}
              autoComplete={isRegister ? "new-password" : "current-password"}
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-[38px] text-muted hover:text-ink transition"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {isRegister && (
            <Field
              label="Confirm password"
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              placeholder="••••••••••••"
            />
          )}

          <div className="pt-2">
            <Button className="w-full shadow-sm uppercase tracking-wider text-xs !h-11" type="submit" disabled={busy}>
              {busy ? "Please wait..." : isRegister ? "Create account" : "Log in to Fieldnotes"} <ArrowRight size={16} />
            </Button>
          </div>
        </form>

        <div className="mt-6 border-t border-black/[.08] dark:border-white/[.08] pt-5 text-center text-xs text-muted">
          <p>
            {isRegister ? "Already have an account?" : "New to Fieldnotes?"}{" "}
            <Link className="font-bold text-moss dark:text-primary hover:underline" to={isRegister ? "/login" : "/register"}>
              {isRegister ? "Log in here" : "Create an account"}
            </Link>
          </p>
          {!isRegister && (
            <p className="mt-3">
              <Link className="font-semibold text-muted hover:text-moss dark:hover:text-primary hover:underline" to="/forgot-password">
                Forgot your password?
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   FORGOT PASSWORD PAGE
   ══════════════════════════════════════════════════════════════════════ */

export function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResetToken(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.post<{ data: { requested: boolean; resetToken?: string } }>("/auth/forgot-password", {
        email: String(form.get("email")),
      });
      if (result.data.data.resetToken) {
        setResetToken(result.data.data.resetToken);
      } else {
        setError("If an account exists for that email, a reset link has been issued. Email delivery is not enabled in this environment.");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Seo
        title="Forgot Password — Fieldnotes"
        description="Reset your Fieldnotes account password."
        robotsIndex={false}
        robotsFollow={false}
      />
      <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Account Security</p>
          <h1 className="mt-1 font-display text-3xl font-black text-ink">Reset password</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Enter your account email to receive your password reset token.
          </p>
        </div>

        {error && (
          <div className="mt-5">
            <Notice variant="info">{error}</Notice>
          </div>
        )}
        {resetToken && (
          <div className="mt-5 space-y-3 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-5 text-emerald-900 dark:text-emerald-200">
            <p className="text-sm font-semibold">A reset link was issued for that account.</p>
            <p className="text-xs leading-relaxed">
              Email delivery is simulated in this environment. Use the link below to set your new password before it expires.
            </p>
            <Link
              to={`/reset-password?token=${encodeURIComponent(resetToken)}`}
              className="inline-flex items-center gap-2 rounded-full bg-moss dark:bg-primary px-5 py-2.5 text-xs font-bold text-white dark:text-[#171B19] shadow-sm uppercase tracking-wider"
            >
              Continue to reset <ArrowRight size={15} />
            </Link>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email address" name="email" type="email" required autoComplete="email" placeholder="you@domain.com" />
          <Button className="w-full shadow-sm uppercase tracking-wider text-xs !h-11" type="submit" disabled={busy}>
            {busy ? "Please wait..." : "Send reset link"} <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 border-t border-black/[.08] dark:border-white/[.08] pt-5 text-center text-xs text-muted">
          Remembered your password?{" "}
          <Link className="font-bold text-moss dark:text-primary hover:underline" to="/login">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   RESET PASSWORD PAGE
   ══════════════════════════════════════════════════════════════════════ */

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const token = params.get("token") ?? "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      await api.post("/auth/reset-password", {
        token,
        password: String(form.get("password")),
        confirmPassword: String(form.get("confirmPassword")),
      });
      setSuccess(true);
      await showSuccess(
        "Password Reset Successful",
        "Your password has been changed. You may now sign in with your new credentials."
      );
      navigate("/login");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Reset Failed", msg);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md py-12">
        <Notice>That reset link is missing a token. Request a new one to continue.</Notice>
        <div className="mt-5 text-center">
          <Link to="/forgot-password" className="text-sm font-bold text-moss dark:text-primary hover:underline">
            Request a reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md py-12">
        <Notice variant="success">Your password was updated successfully. Redirecting you to log in...</Notice>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <Seo
        title="Set New Password — Fieldnotes"
        description="Enter your new password."
        robotsIndex={false}
        robotsFollow={false}
      />
      <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card sm:p-10">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Account Security</p>
          <h1 className="mt-1 font-display text-3xl font-black text-ink">Set new password</h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Choose a strong password containing at least 12 characters.
          </p>
        </div>

        {error && (
          <div className="mt-5">
            <Notice>{error}</Notice>
          </div>
        )}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field
            label="New password"
            name="password"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            placeholder="••••••••••••"
          />
          <Field
            label="Confirm new password"
            name="confirmPassword"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            placeholder="••••••••••••"
          />
          <div className="pt-2">
            <Button className="w-full shadow-sm uppercase tracking-wider text-xs !h-11" type="submit" disabled={busy}>
              {busy ? "Please wait..." : "Update password"} <ArrowRight size={16} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   AUTHOR PROFILE PAGE (/author/:username)
   ══════════════════════════════════════════════════════════════════════ */

export function AuthorProfilePage() {
  const { username = "" } = useParams<{ username: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageParam = Math.max(1, Number(searchParams.get("page")) || 1);

  const queryUrl = useMemo(() => {
    return `/public/authors/${encodeURIComponent(username)}?page=${pageParam}&limit=9`;
  }, [username, pageParam]);

  const { data, loading, error } = useRequest<AuthorProfileData>(queryUrl);

  if (loading) {
    return <Loading label={`Loading profile for @${username}...`} />;
  }

  if (error || !data || !data.author) {
    return (
      <div className="py-12 sm:py-16">
        <Seo
          title="Author Not Found — Fieldnotes"
          description="The requested author profile could not be found."
          robotsIndex={false}
          robotsFollow={false}
        />
        <EmptyState
          title="Author Not Found"
          action={
            <Link to="/blogs" className="btn btn-primary inline-flex items-center gap-2">
              <ArrowDown className="rotate-90" size={14} /> Browse All Stories
            </Link>
          }
        >
          We could not find an author profile for &ldquo;@{username}&rdquo;. The contributor may have changed their username or has not published any public dispatches.
        </EmptyState>
      </div>
    );
  }

  const { author, posts = [], pagination } = data;
  const publishedCount = Number(author.publishedStoryCount ?? pagination?.total ?? posts.length);
  const formattedJoinedDate = author.createdAt
    ? new Date(author.createdAt).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      })
    : null;

  function handlePageChange(newPage: number) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newPage <= 1) {
        next.delete("page");
      } else {
        next.set("page", String(newPage));
      }
      return next;
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-12 sm:space-y-16">
      <Seo
        title={`${author.displayName || author.username} — Fieldnotes Author`}
        description={
          author.bio ||
          `Explore articles, essays, and stories written by ${author.displayName || author.username} on Fieldnotes.`
        }
        canonicalUrl={`/author/${encodeURIComponent(author.username)}`}
        image={author.profileImagePath ?? undefined}
      />

      {/* Navigation Breadcrumb / Back link */}
      <div>
        <Link
          to="/blogs"
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
        >
          <ArrowDown className="rotate-90" size={14} /> Back to all stories
        </Link>
      </div>

      {/* Author Profile Header Hero */}
      <header className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-10 shadow-card transition-all">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          {/* Avatar Portrait */}
          <div className="relative grid size-24 sm:size-28 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-moss/20 dark:border-primary/20 bg-moss/10 dark:bg-primary/20 font-bold text-moss dark:text-primary shadow-soft">
            {author.profileImagePath ? (
              <img
                src={imageUrl(author.profileImagePath)}
                alt={author.displayName || author.username}
                className="size-full object-cover"
              />
            ) : (
              <span className="text-3xl font-display uppercase">
                {(author.displayName || author.username).slice(0, 1)}
              </span>
            )}
          </div>

          {/* Profile Meta & Bio */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-black/10 dark:border-white/10 bg-accent/30 dark:bg-accent/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
                Contributing Writer
              </span>
              <span className="text-xs text-muted font-medium">@{author.username}</span>
            </div>

            <h1 className="mt-2 font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-ink">
              {author.displayName || author.username}
            </h1>

            <p className="mt-3 text-sm sm:text-base leading-relaxed text-muted max-w-2xl">
              {author.bio ||
                "Author and contributor sharing thoughtful perspectives, essays, and stories on Fieldnotes."}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-muted border-t border-black/[.06] dark:border-white/[.06] pt-4">
              <span className="inline-flex items-center gap-1.5 text-ink">
                <span className="font-bold text-moss dark:text-primary">{publishedCount}</span>
                <span>{publishedCount === 1 ? "Published Story" : "Published Stories"}</span>
              </span>
              {formattedJoinedDate && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-muted">
                    <span>Contributing since {formattedJoinedDate}</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Published Stories Section */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4 gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">
              Publications Library
            </p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">
              Stories by {author.displayName || author.username}
            </h2>
          </div>
          <span className="text-xs font-semibold text-muted">
            {publishedCount} {publishedCount === 1 ? "article" : "articles"} in total
          </span>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="No published stories yet"
            action={
              <Link to="/blogs" className="btn btn-secondary inline-flex items-center gap-2">
                Explore Other Stories
              </Link>
            }
          >
            @{author.username} has not published any public stories yet. Check back soon or explore stories from other writers.
          </EmptyState>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {pagination && (pagination.totalPages > 1 || pagination.total > (pagination.limit || 9)) && (
              <Pagination
                page={pagination.page || pageParam}
                limit={pagination.limit || 9}
                total={pagination.total || publishedCount}
                onChange={handlePageChange}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NEWSLETTER DOUBLE OPT-IN VERIFICATION PAGE (Phase 2C)
   ══════════════════════════════════════════════════════════════════════ */

export function NewsletterVerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");
  const [subscriberEmail, setSubscriberEmail] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("No verification token provided. Please check the link in your email.");
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const response = await api.get<{
          message: string;
          status: string;
          email?: string;
        }>(`/public/newsletter/verify?token=${encodeURIComponent(token)}`);

        if (isMounted) {
          setSuccess(true);
          setMessage(response.data?.message || "Your subscription has been confirmed! Welcome to Fieldnotes Journal.");
          setSubscriberEmail(response.data?.email || "");
        }
      } catch (err: any) {
        if (isMounted) {
          setSuccess(false);
          setMessage(err?.response?.data?.error?.message || "Invalid or expired verification link. Please subscribe again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center py-12 px-4">
      <Seo
        title="Newsletter Verification — Fieldnotes"
        robotsIndex={false}
        robotsFollow={false}
      />
      <div className="w-full max-w-md rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card text-center">
        {loading ? (
          <div className="py-8">
            <Loader2 size={36} className="animate-spin text-moss dark:text-primary mx-auto" />
            <p className="mt-4 font-semibold text-ink text-sm">Verifying your subscription...</p>
          </div>
        ) : success ? (
          <div className="py-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Subscription Confirmed</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>
            {subscriberEmail && (
              <p className="mt-2 inline-block rounded-full bg-paper px-3 py-1 text-xs font-mono text-muted">
                {subscriberEmail}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3">
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-moss dark:bg-primary py-3 text-sm font-bold text-white dark:text-[#171B19] shadow-sm hover:opacity-90 transition-all"
              >
                <span>Return to Homepage</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                to="/blogs"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-black/10 dark:border-white/10 py-3 text-sm font-bold text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              >
                <span>Explore Stories</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Verification Failed</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-moss dark:bg-primary py-3 text-sm font-bold text-white dark:text-[#171B19] shadow-sm hover:opacity-90 transition-all"
              >
                <span>Go to Homepage</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NEWSLETTER UNSUBSCRIBE PAGE (Phase 2C)
   ══════════════════════════════════════════════════════════════════════ */

export function NewsletterUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("No unsubscribe token provided. Please check the link from your email.");
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const response = await api.get<{
          message: string;
          status: string;
        }>(`/public/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);

        if (isMounted) {
          setSuccess(true);
          setMessage(response.data?.message || "You have been successfully unsubscribed from Fieldnotes Journal.");
        }
      } catch (err: any) {
        if (isMounted) {
          setSuccess(false);
          setMessage(err?.response?.data?.error?.message || "Invalid or expired unsubscribe link.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center py-12 px-4">
      <Seo
        title="Newsletter Verification — Fieldnotes"
        robotsIndex={false}
        robotsFollow={false}
      />
      <div className="w-full max-w-md rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card text-center">
        {loading ? (
          <div className="py-8">
            <Loader2 size={36} className="animate-spin text-moss dark:text-primary mx-auto" />
            <p className="mt-4 font-semibold text-ink text-sm">Processing unsubscribe request...</p>
          </div>
        ) : success ? (
          <div className="py-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary mx-auto">
              <MailCheck size={32} />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Unsubscribed</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>
            <p className="mt-3 text-xs text-muted">
              We're sorry to see you go. You can re-subscribe anytime from our homepage.
            </p>
            <div className="mt-8">
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-moss dark:bg-primary py-3 text-sm font-bold text-white dark:text-[#171B19] shadow-sm hover:opacity-90 transition-all"
              >
                <span>Return to Fieldnotes Journal</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h1 className="mt-5 font-display text-2xl font-bold text-ink">Unsubscribe Request Failed</h1>
            <p className="mt-2 text-sm text-muted leading-relaxed">{message}</p>
            <div className="mt-8">
              <Link
                to="/"
                className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-moss dark:bg-primary py-3 text-sm font-bold text-white dark:text-[#171B19] shadow-sm hover:opacity-90 transition-all"
              >
                <span>Go to Homepage</span>
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
