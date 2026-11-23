import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Facebook,
  Heart,
  Linkedin,
  Mail,
  MessageSquareText,
  Search,
  Send,
  Share2,
  Sparkles,
  Tag as TagIcon,
  Twitter,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, Loading, Notice, Pagination, SelectField, TextArea } from "../components/UI";
import { Seo } from "../components/Seo";
import { api, getErrorMessage, imageUrl } from "../lib/api";
import { confirmAction, showError, showSuccess, showToast, showWarning } from "../lib/alerts";
import type { BlogPost, PageResult, SeoData, Taxonomy } from "../types";

/* ══════════════════════════════════════════════════════════════════════
   TYPES & SHARED DATA HOOK
   ══════════════════════════════════════════════════════════════════════ */

interface HomeData {
  featuredPosts: BlogPost[];
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
}: {
  post: BlogPost;
  featured?: boolean;
  variant?: "standard" | "featured" | "compact" | "spotlight";
  index?: number;
}) {
  const wordCount = (post.excerpt || post.title || "").split(/\s+/).length * 10;
  const readMinutes = Math.max(2, Math.round(wordCount / 60));
  const isLead = featured || variant === "featured";

  // 1. Featured Lead Magazine Cover Story
  if (isLead) {
    return (
      <article className="group relative overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:border-moss/40 hover:shadow-soft lg:grid lg:grid-cols-12 lg:gap-0">
        <Link
          to={`/blogs/${post.slug}`}
          className="relative block min-h-[300px] overflow-hidden bg-black/5 dark:bg-white/5 sm:min-h-[360px] lg:col-span-7 lg:min-h-[460px]"
        >
          {post.featuredImagePath ? (
            <img
              src={imageUrl(post.featuredImagePath)}
              alt={post.title}
              className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
              <BookOpenMark />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent lg:hidden" />
          <div className="absolute left-5 top-5 flex items-center gap-2">
            <span className="rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
              {post.category}
            </span>
            <span className="rounded-full bg-black/40 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest backdrop-blur">
              Cover Story
            </span>
          </div>
        </Link>

        <div className="flex flex-col justify-between p-7 sm:p-10 lg:col-span-5 lg:p-10 xl:p-12">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted">
              <span className="grid size-6 place-items-center overflow-hidden rounded-full bg-accent/30 text-[11px] font-bold text-moss dark:text-primary">
                {post.authorProfileImagePath ? (
                  <img src={imageUrl(post.authorProfileImagePath)} alt="" className="size-full object-cover" />
                ) : (
                  post.author.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="font-semibold text-ink">{post.author}</span>
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
              <h2 className="mt-4 font-display text-2xl font-bold leading-[1.15] tracking-tight text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary sm:text-3xl lg:text-4xl">
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

          <div className="mt-8 flex items-center justify-between border-t border-black/[.08] dark:border-white/[.08] pt-5">
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
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary transition group-hover:translate-x-1"
            >
              Read full story <ArrowRight size={14} />
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
            <span className="font-medium text-ink/75">{post.author}</span>
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
    <article className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft">
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
          <span className="absolute left-4 top-4 rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
            {post.category}
          </span>
        </Link>

        <div className="p-6 sm:p-7">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-accent/30 text-[10px] font-bold text-moss dark:text-primary">
              {post.authorProfileImagePath ? (
                <img src={imageUrl(post.authorProfileImagePath)} alt="" className="size-full object-cover" />
              ) : (
                post.author.slice(0, 1).toUpperCase()
              )}
            </span>
            <span className="font-semibold text-ink">{post.author}</span>
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
   HOME PAGE (CONTEMPORARY DIGITAL MAGAZINE)
   ══════════════════════════════════════════════════════════════════════ */

export function HomePage() {
  const { data, loading, error } = useRequest<HomeData>("/public/homepage");
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/blogs?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  if (loading) return <Loading label="Gathering the latest stories..." />;
  if (error || !data) return <Notice>{error ?? "Could not load the homepage."}</Notice>;

  const lead = data.featuredPosts[0];
  const sideDispatches = data.featuredPosts.slice(1, 4).length > 0
    ? data.featuredPosts.slice(1, 4)
    : data.latestPosts.slice(0, 3);
  const spotlightPost = data.featuredPosts.length > 4 ? data.featuredPosts[4] : data.popularPosts[0];

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
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={15} />
            <input
              type="text"
              placeholder="Search stories, ideas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field !py-2 !pl-9 text-xs"
            />
          </form>
        </div>

        {/* Asymmetric Hero Grid (Left 7 Cols: Lead Story, Right 5 Cols: Curated Digest) */}
        {lead ? (
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Lead Cover Story */}
            <div className="lg:col-span-7">
              <PostCard post={lead} featured />
            </div>

            {/* Right Column: The Editorial Digest (Numbered 01, 02, 03) */}
            <div className="lg:col-span-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 sm:p-8 shadow-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-black/[.08] dark:border-white/[.08] pb-3 mb-3">
                  <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-moss dark:text-primary">
                    The Digest · Curated
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Editor&apos;s Selection
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

      {/* 2. CATEGORIES MARQUEE / SECTIONS RIBBON */}
      <section>
        <div className="mb-6 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Curated Sections</p>
            <h2 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-ink">Explore by topic</h2>
          </div>
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
          >
            All sections <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.categories.map((category) => (
            <Link
              key={category.id}
              to={`/category/${category.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-surface p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-xl bg-accent/25 dark:bg-accent/20 text-moss dark:text-primary group-hover:scale-110 transition-transform">
                  <Sparkles size={14} />
                </span>
                <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-muted">
                  {category.postCount ?? 0}
                </span>
              </div>
              <h3 className="mt-3 font-display text-sm font-bold text-ink group-hover:text-moss dark:group-hover:text-primary transition-colors truncate">
                {category.name}
              </h3>
            </Link>
          ))}
          {data.categories.length === 0 && (
            <p className="col-span-full text-sm text-muted">Categories will appear here once stories are published.</p>
          )}
        </div>
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

      {/* 5. READER FAVORITES / MOST DISCUSSED */}
      {data.popularPosts && data.popularPosts.length > 0 && (
        <section>
          <div className="mb-8 flex items-end justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Reader Favorites</p>
              <h2 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">Most discussed stories</h2>
            </div>
            <Link
              to="/blogs?sort=popular"
              className="hidden items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline sm:flex"
            >
              View all popular <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.popularPosts.map((post) => (
              <PostCard key={post.id} post={post} />
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

      {/* 7. FROM THE EDITORS (NEUTRAL EDITORIAL DISPATCH) */}
      <section className="overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-8 shadow-card sm:p-14">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 dark:bg-accent/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
            <Mail size={13} /> The Fieldnotes Colophon
          </span>
          <h2 className="mt-5 font-display text-3xl font-bold text-ink sm:text-4xl">
            Thoughtful publishing, written with craft.
          </h2>
          <p className="mt-3 text-muted leading-relaxed">
            Email newsletter subscriptions are currently not available. In the meantime, you can explore all our published stories, long-form investigations, and essays directly through the journal archives.
          </p>
          <div className="mt-6">
            <Link
              to="/blogs"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
            >
              Explore latest stories <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

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
   BLOG LISTING PAGE (THE ARCHIVE)
   ══════════════════════════════════════════════════════════════════════ */

export function BlogListPage() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") ?? "");
  const categoryFilter = params.get("category") ?? "";
  const tagFilter = params.get("tag") ?? "";
  const sortOption = params.get("sort") ?? "latest";
  const page = Number(params.get("page") ?? 1);

  // Load categories and tags for filter dropdowns & horizontal pill bar
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hasActiveFilters = Boolean(search || categoryFilter || tagFilter || sortOption !== "latest");

  return (
    <>
      <Seo
        title="The Archive — Fieldnotes Digital Magazine"
        description="Browse, filter, and explore thoughtful articles, guides, investigations, and stories."
      />

      {/* Editorial Archive Masthead */}
      <div className="mb-10 border-b-2 border-black/10 dark:border-white/10 pb-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
          <Sparkles size={14} />
          <span>The Fieldnotes Archive</span>
        </div>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink">
          Curated Stories &amp; Dispatches.
        </h1>
        <p className="mt-3 max-w-2xl text-base sm:text-lg text-muted font-normal leading-relaxed">
          Filter through our complete collection of long-form essays, critical reviews, craft explorations, and perspectives.
        </p>

        {/* 1-Click Category Pills Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => handleFilterChange("category", "")}
            className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
              !categoryFilter
                ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                : "border border-black/10 dark:border-white/10 bg-surface text-muted hover:text-ink hover:bg-paper dark:hover:bg-surface-elevated"
            }`}
          >
            All Sections
          </button>
          {categoriesList.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleFilterChange("category", cat.slug === categoryFilter ? "" : cat.slug)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                categoryFilter === cat.slug
                  ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                  : "border border-black/10 dark:border-white/10 bg-surface text-muted hover:text-ink hover:bg-paper dark:hover:bg-surface-elevated"
              }`}
            >
              {cat.name}
              {cat.postCount !== undefined && (
                <span className="ml-1.5 opacity-70">({cat.postCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="mb-10 space-y-4 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-8">
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={submitSearch}>
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="field pl-11 !h-12"
              placeholder="Search stories by title, topic, excerpt, or keyword..."
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
          <Button type="submit" className="shadow-sm sm:!h-12 sm:px-7 uppercase tracking-wider">
            Search Archive
          </Button>
        </form>

        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="Category"
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
            label="Tag"
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
            label="Sort Order"
            value={sortOption}
            onChange={(e) => handleFilterChange("sort", e.target.value)}
          >
            <option value="latest">Latest Published</option>
            <option value="popular">Most Appreciated (Likes)</option>
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
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Story Grid */}
      {loading ? (
        <Loading label="Fetching journal articles..." />
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
        <EmptyState title="No stories found matching your criteria">
          Try clearing your search query or adjusting your filters to find what you are looking for.
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
  const taxonomyList: Taxonomy[] = Array.isArray(data) ? data : (data?.data ?? []);

  return (
    <>
      <Seo
        title={`Browse ${noun} — Fieldnotes Digital Magazine`}
        description="Follow an interest and find stories that speak your language."
      />
      <div className="mb-10 border-b-2 border-black/10 dark:border-white/10 pb-8">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
          <Sparkles size={14} />
          <span>Curated Index</span>
        </div>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink">
          Browse {noun}.
        </h1>
        <p className="mt-3 max-w-2xl text-base sm:text-lg text-muted font-normal leading-relaxed">
          Follow your curiosity across dedicated topics, craft disciplines, and long-term research subjects.
        </p>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : taxonomyList.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {taxonomyList.map((item) => (
            <Link
              key={item.id}
              to={`${path}${item.slug}`}
              className="group rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card transition-all duration-200 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <span className="grid size-12 place-items-center rounded-2xl bg-accent/30 dark:bg-accent/20 text-moss dark:text-primary group-hover:scale-105 transition-transform">
                    <Sparkles size={22} />
                  </span>
                  <span className="rounded-full bg-paper px-3 py-1 text-xs font-bold text-moss dark:text-primary">
                    {item.postCount ?? 0} {Number(item.postCount) === 1 ? "story" : "stories"}
                  </span>
                </div>
                <h2 className="mt-6 font-display text-2xl font-bold text-ink transition-colors duration-200 group-hover:text-moss dark:group-hover:text-primary">
                  {kind === "tags" ? `#${item.name}` : item.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-3">
                  {item.description || `Read the latest published stories and discussions about ${item.name.toLowerCase()}.`}
                </p>
              </div>

              <div className="mt-6 border-t border-black/[.06] dark:border-white/[.08] pt-4 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
                <span>View collection</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
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
        <Loading />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : (
        <>
          <Seo
            title={`${taxonomy?.name ?? "Stories"} — Fieldnotes Digital Magazine`}
            description={taxonomy?.description ?? undefined}
            image={data?.category?.imagePath}
          />
          <div className="mb-10 border-b-2 border-black/10 dark:border-white/10 pb-8">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-moss dark:text-primary">
              <Sparkles size={14} />
              <span>{kind === "categories" ? "Section Archive" : "Topic Label"}</span>
            </div>
            <h1 className="mt-2 font-display text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-ink">
              {taxonomy?.name ?? "Stories"}
            </h1>
            {taxonomy?.description && (
              <p className="mt-3 max-w-2xl text-base sm:text-lg text-muted font-normal leading-relaxed">
                {taxonomy.description}
              </p>
            )}
          </div>

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
   SINGLE BLOG DETAILS PAGE (CONTEMPORARY MAGAZINE ARTICLE)
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
  const [copied, setCopied] = useState(false);

  const shareUrl = typeof window !== "undefined" && data ? `${window.location.origin}/blogs/${data.slug}` : "";

  function handleCopyLink() {
    if (!shareUrl) return;
    if (navigator?.clipboard?.writeText) {
      void navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } finally {
        textArea.remove();
      }
    }
  }

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
    }
  }, [data, user]);

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

  if (loading) return <Loading label="Opening this story..." />;
  if (error || !data) return <Notice>{error ?? "Story not found."}</Notice>;

  const wordCount = (data.content || "").trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <article className="mx-auto max-w-4xl">
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

      {/* Article Header: Kicker, Headline, Byline Bar */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link
            to={`/category/${data.categorySlug}`}
            className="inline-flex rounded-full border border-black/10 dark:border-white/10 bg-accent/30 dark:bg-accent/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary transition hover:bg-accent/50"
          >
            {data.categoryName}
          </Link>
          <span className="text-muted text-xs">·</span>
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">
            {readTime} min read
          </span>
        </div>

        <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.1] tracking-tight text-ink">
          {data.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-black/[.08] dark:border-white/[.08] pb-6 text-xs text-muted sm:text-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-accent/30 text-sm font-bold text-moss dark:text-primary shadow-sm">
              {data.authorProfileImagePath ? (
                <img src={imageUrl(data.authorProfileImagePath)} alt="" className="size-full object-cover" />
              ) : (
                data.author.slice(0, 1).toUpperCase()
              )}
            </span>
            <div>
              <p className="font-bold text-ink leading-tight">{data.author}</p>
              <p className="text-[11px] text-muted">
                {data.publishedAt
                  ? new Date(data.publishedAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Recently published"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Eye size={15} /> {data.viewCount ?? 0} views
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Heart size={15} className="text-red-500" /> {likeCount} likes
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <MessageSquareText size={15} /> {data.comments.length} {data.comments.length === 1 ? "comment" : "comments"}
            </span>
          </div>
        </div>
      </header>

      {/* Featured Cover Image */}
      {data.featuredImagePath && (
        <figure className="mb-12">
          <img
            src={imageUrl(data.featuredImagePath)}
            alt={data.title}
            className="max-h-[560px] w-full rounded-3xl object-cover shadow-soft border border-black/[.08] dark:border-white/[.08]"
          />
        </figure>
      )}

      {/* Content Area: Editorial Article Reading Layout */}
      <div className="mx-auto max-w-3xl">
        {data.excerpt && (
          <div className="editorial-pullquote mb-10">
            &ldquo;{data.excerpt}&rdquo;
          </div>
        )}

        {/* Article Reading Content with Drop-Cap Styling */}
        <div className="editorial-article reading-content editorial-dropcap drop-cap">
          {data.content}
        </div>

        {/* Image Gallery */}
        {data.images.length > 0 && (
          <div className="my-12 grid gap-5 sm:grid-cols-2">
            {data.images.map((image) => (
              <figure key={image.id} className="overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card">
                <img src={imageUrl(image.path)} alt={image.caption ?? ""} className="aspect-video w-full object-cover" />
                {image.caption && (
                  <figcaption className="px-4 py-3 text-center text-xs text-muted font-medium italic">{image.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        )}

        {/* Tags Bar */}
        {data.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap items-center gap-2 border-t border-black/[.08] dark:border-white/[.08] pt-6">
            <span className="text-xs font-bold uppercase tracking-wider text-muted mr-1">Tags:</span>
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
        <Card className="my-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6 p-7 sm:p-8">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full bg-accent/30 font-bold text-moss dark:text-primary shadow-soft">
            {data.authorProfileImagePath ? (
              <img src={imageUrl(data.authorProfileImagePath)} alt={data.author} className="size-full object-cover" />
            ) : (
              <span className="text-2xl">{data.author.slice(0, 1).toUpperCase()}</span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Contributing Writer</p>
            </div>
            <h3 className="mt-0.5 font-display text-2xl font-bold text-ink">{data.author}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {data.authorBio || "Author and contributor sharing thoughtful perspectives, essays, and stories on Fieldnotes."}
            </p>
          </div>
        </Card>

        {/* Appreciation & Social Sharing Card */}
        <Card className="my-10 p-7 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-2xl font-bold text-ink">Enjoyed this perspective?</p>
              <p className="text-xs text-muted mt-1">
                {likeCount} {likeCount === 1 ? "reader has appreciated" : "readers have appreciated"} this article
              </p>
            </div>
            <Button variant={liked ? "primary" : "secondary"} onClick={likePost} className="shadow-sm uppercase tracking-wider text-xs">
              <Heart size={16} fill={liked ? "currentColor" : "none"} className={liked ? "text-white dark:text-[#171B19]" : "text-red-500"} />
              {liked ? "Liked" : "Like this story"}
            </Button>
          </div>

          {/* Social Sharing Section */}
          <div className="mt-6 border-t border-black/[.08] dark:border-white/[.08] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
                <Share2 size={15} className="text-moss dark:text-primary" />
                <span>Share this dispatch</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(data.title)}&url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share story on X / Twitter"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#1DA1F2] hover:text-[#1DA1F2] hover:bg-[#1DA1F2]/5"
                >
                  <Twitter size={14} className="text-[#1DA1F2]" />
                  <span>X / Twitter</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share story on Facebook"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#1877F2] hover:text-[#1877F2] hover:bg-[#1877F2]/5"
                >
                  <Facebook size={14} className="text-[#1877F2]" />
                  <span>Facebook</span>
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share story on LinkedIn"
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-[#0A66C2] hover:text-[#0A66C2] hover:bg-[#0A66C2]/5"
                >
                  <Linkedin size={14} className="text-[#0A66C2]" />
                  <span>LinkedIn</span>
                </a>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  aria-label="Copy story link to clipboard"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                    copied
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
                      : "border-black/10 dark:border-white/10 bg-paper text-ink hover:border-moss hover:bg-moss hover:text-white"
                  }`}
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-600 dark:text-emerald-400" />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
            {copied && (
              <p className="mt-2 text-right text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Article URL copied to clipboard!
              </p>
            )}
          </div>
        </Card>

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

        {/* Community Discussion & Letters Section */}
        <section className="mt-14 space-y-8 border-t-2 border-black/10 dark:border-white/10 pt-10">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">
              <MessageSquareText size={15} />
              <span>Letters &amp; Discourse</span>
            </div>
            <h2 className="mt-1 font-display text-3xl font-bold text-ink">
              {`Discussion (${data.comments.length})`}
            </h2>
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
            <form onSubmit={submitComment} className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card sm:p-8">
              <h3 className="font-display text-2xl font-bold text-ink">Leave a comment</h3>
              <p className="mt-1 text-xs text-muted">
                Commenting as <strong className="text-ink">{user.username}</strong>. Submissions are reviewed by editors.
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
              <Button className="mt-4 w-full sm:w-auto shadow-sm uppercase tracking-wider text-xs">
                <Send size={15} /> Submit comment
              </Button>
            </form>
          ) : (
            <Card className="p-8 text-center rounded-3xl">
              <h3 className="font-display text-2xl font-bold text-ink">Join the conversation</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
                You must be logged in to leave a comment or appreciate this story.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="rounded-full bg-moss dark:bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
                >
                  Log in to comment
                </Link>
                <Link
                  to="/register"
                  className="rounded-full border border-black/10 dark:border-white/10 bg-surface px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-ink shadow-sm transition hover:bg-paper"
                >
                  Create an account
                </Link>
              </div>
            </Card>
          )}
        </section>
      </div>

      {/* Related Stories Section */}
      {data.relatedPosts && data.relatedPosts.filter((p) => p.id !== data.id).length > 0 && (
        <section className="mt-16 border-t-2 border-black/10 dark:border-white/10 pt-12 sm:mt-20 sm:pt-16">
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
      <p className="font-display text-8xl font-bold text-moss dark:text-primary sm:text-9xl">404</p>
      <h1 className="mt-4 font-display text-4xl font-bold text-ink sm:text-5xl">Story not found.</h1>
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isRegister = mode === "register";

  useEffect(() => {
    if (user) navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [navigate, user]);

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
      navigate(signedInUser.role === "admin" ? "/admin" : "/dashboard");
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
      <Seo title="Forgot Password — Fieldnotes" description="Reset your Fieldnotes account password." />
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
      <Seo title="Set New Password — Fieldnotes" description="Enter your new password." />
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
