import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FilePlus2,
  FolderKanban,
  Heart,
  MessageSquareText,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  TrendingDown,
  Upload,
  Users,
  UserX,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button, DateRangeFilter, EmptyState, Field, Loading, Notice, PageHeading, Pagination, SelectField, TableSkeleton, TextArea } from "../components/UI";
import { Seo } from "../components/Seo";
import { api, getErrorMessage, imageUrl } from "../lib/api";
import { confirmAction, confirmDestructive, showError, showSuccess, showToast } from "../lib/alerts";
import type {
  NewsletterStats,
  NewsletterSubscriber,
  PageResult,
  SearchAnalyticsLogItem,
  SearchAnalyticsOverview,
  Taxonomy,
  TopZeroResultKeyword,
} from "../types";

interface DashboardData {
  stats: {
    totalUsers: number;
    totalPosts: number;
    publishedPosts: number;
    pendingPosts: number;
    rejectedPosts: number;
    totalCategories: number;
    totalTags: number;
    totalComments: number;
    pendingComments: number;
    totalLikes: number;
  };
  recentPosts: Array<{
    id: string;
    title: string;
    slug: string;
    status: string;
    author: string;
    category: string;
    createdAt: string;
  }>;
  recentUsers: Array<{
    id: string;
    username: string;
    email: string;
    role: string;
    createdAt: string;
  }>;
  recentComments: Array<{
    id: string;
    content: string;
    status: string;
    author: string;
    postTitle: string;
    postSlug: string;
  }>;
  pendingApprovals: { posts: number; comments: number };
  popularPosts: Array<{ id: string; title: string; slug: string; likeCount: number }>;
  monthlyPosts: Array<{ month: string; count: number }>;
  monthlyUsers: Array<{ month: string; count: number }>;
}

interface AdminPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  isFeatured?: boolean;
  featuredOrder?: number;
  authorUsername: string;
  authorId: string;
  category: string;
  likeCount: number;
  commentCount: number;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt?: string;
}

interface AdminComment {
  id: string;
  content: string;
  status: string;
  createdAt: string;
  authorUsername: string;
  postTitle: string;
  postSlug: string;
}

function useAdminData<T>(url: string, autoRefreshMs: number = 60000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = () => setRefreshToken((v) => v + 1);

  // Initial/fetch on url or manual refresh
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get<any>(url)
      .then((res) => {
        if (active) {
          const resBody = res.data;
          if (resBody && typeof resBody === "object" && "pagination" in resBody && resBody.data && typeof resBody.data === "object") {
            (resBody.data as any).pagination = resBody.pagination;
          }
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
      .catch((e) => {
        if (active) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [url, refreshToken]);

  // Auto‑refresh interval (defaults to 60s)
  useEffect(() => {
    if (!autoRefreshMs) return;
    const interval = setInterval(refresh, autoRefreshMs);
    return () => clearInterval(interval);
  }, [autoRefreshMs, url]);

  return { data, loading, error, refresh };
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const style =
    normalized === "APPROVED" || normalized === "ACTIVE" || normalized === "RESOLVED"
      ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
      : normalized === "PENDING" || normalized === "NEW"
      ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25"
      : normalized === "REJECTED" || normalized === "DISABLED"
      ? "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/25"
      : "bg-paper dark:bg-surface-elevated text-ink/75 border-black/[.08] dark:border-white/[.08]";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${style}`}
    >
      {value}
    </span>
  );
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-36 rounded bg-black/[.08] dark:bg-white/[.08]" />
        <div className="h-10 w-72 rounded-xl bg-black/[.08] dark:bg-white/[.08]" />
        <div className="h-4 w-96 max-w-full rounded bg-black/[.08] dark:bg-white/[.08]" />
      </div>

      <div className="space-y-4">
        <div className="h-4 w-48 rounded bg-black/[.08] dark:bg-white/[.08]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-surface dark:bg-surface-elevated border border-black/[.08] dark:border-white/[.08] p-5 space-y-3">
              <div className="h-3 w-24 rounded bg-black/[.08] dark:bg-white/[.08]" />
              <div className="h-8 w-20 rounded bg-black/[.08] dark:bg-white/[.08]" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        <div className="h-80 rounded-3xl bg-surface dark:bg-surface-elevated border border-black/[.08] dark:border-white/[.08]" />
        <div className="h-80 rounded-3xl bg-[#12231b] border border-white/10" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="h-72 rounded-3xl bg-surface dark:bg-surface-elevated border border-black/[.08] dark:border-white/[.08]" />
        <div className="h-72 rounded-3xl bg-surface dark:bg-surface-elevated border border-black/[.08] dark:border-white/[.08]" />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  variant = "default",
}: {
  label: string;
  value: number;
  note?: string;
  icon: typeof BarChart3;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const accentBorder =
    variant === "success"
      ? "border-l-emerald-500 dark:border-l-emerald-400"
      : variant === "warning"
      ? "border-l-amber-500 dark:border-l-amber-400"
      : variant === "danger"
      ? "border-l-rose-500 dark:border-l-rose-400"
      : "border-l-moss dark:border-l-primary";

  return (
    <div className={`group relative rounded-2xl border border-black/[.08] dark:border-white/[.08] border-l-4 ${accentBorder} bg-surface dark:bg-surface-elevated p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md flex flex-col justify-between`}>
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-muted font-sans">{label}</p>
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-paper dark:bg-surface text-moss dark:text-primary border border-moss/10 dark:border-white/10 transition group-hover:bg-lime/30 dark:group-hover:bg-primary/20">
            <Icon size={16} />
          </span>
        </div>
        <p className="mt-3 font-display text-4xl font-bold tracking-tight text-ink">
          {Number(value ?? 0).toLocaleString()}
        </p>
      </div>
      {note && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted font-sans pt-2 border-t border-black/[.04] dark:border-white/[.04]">
          <span className="truncate">{note}</span>
        </div>
      )}
    </div>
  );
}

export function AdminDashboardPage() {
  const { data, loading, error } = useAdminData<DashboardData>("/admin/dashboard");

  if (loading) return <AdminDashboardSkeleton />;
  if (error || !data) return <Notice>{error ?? "Dashboard data is unavailable."}</Notice>;

  const audienceStats = [
    { label: "Total Readers", value: data.stats.totalUsers, note: "Registered member accounts", icon: Users, variant: "default" as const },
    { label: "Total Articles", value: data.stats.totalPosts, note: "Drafts, pending & live", icon: BarChart3, variant: "default" as const },
    { label: "Published Stories", value: data.stats.publishedPosts, note: "Active on public journal", icon: Check, variant: "success" as const },
    { label: "Reader Appreciations", value: data.stats.totalLikes, note: "Total community likes", icon: Heart, variant: "success" as const },
  ];

  const governanceStats = [
    { label: "Pending Stories", value: data.stats.pendingPosts, note: "Awaiting editorial review", icon: AlertTriangle, variant: data.stats.pendingPosts > 0 ? ("warning" as const) : ("default" as const) },
    { label: "Returned Drafts", value: data.stats.rejectedPosts, note: "Revisions requested", icon: X, variant: data.stats.rejectedPosts > 0 ? ("danger" as const) : ("default" as const) },
    { label: "Pending Comments", value: data.stats.pendingComments, note: "Reader moderation queue", icon: AlertTriangle, variant: data.stats.pendingComments > 0 ? ("warning" as const) : ("default" as const) },
    { label: "Total Comments", value: data.stats.totalComments, note: "Community discourse", icon: MessageSquareText, variant: "default" as const },
  ];

  const taxonomyStats = [
    { label: "Topic Categories", value: data.stats.totalCategories, note: "Journal sections & hubs", icon: FolderKanban, variant: "default" as const },
    { label: "Topical Tags", value: data.stats.totalTags, note: "Cross-cutting labels", icon: TagIcon, variant: "default" as const },
  ];

  const chartData = data.monthlyPosts.map((item) => ({
    month: item.month,
    posts: Number(item.count),
    users: Number(data.monthlyUsers.find((user) => user.month === item.month)?.count ?? 0),
  }));
  const chartMaximum = Math.max(1, ...chartData.flatMap((item) => [item.posts, item.users]));

  return (
    <>
      <Seo title="Admin Dashboard — Fieldnotes Control Center" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Editorial Control Center"
        title="Publication Overview"
        description="Live overview of readership, content lifecycle, pending editorial queues, and database metrics."
      />

      {/* Semantic Group 1: Audience & Publication Lifecycle */}
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Audience & Reach</span>
            <div className="h-px flex-1 bg-black/[.06] dark:bg-white/[.06]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {audienceStats.map((item) => (
              <StatCard key={item.label} label={item.label} value={Number(item.value)} note={item.note} icon={item.icon} variant={item.variant} />
            ))}
          </div>
        </div>

        {/* Semantic Group 2: Editorial Governance & Queues */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">Governance & Queues</span>
            <div className="h-px flex-1 bg-black/[.06] dark:bg-white/[.06]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {governanceStats.map((item) => (
              <StatCard key={item.label} label={item.label} value={Number(item.value)} note={item.note} icon={item.icon} variant={item.variant} />
            ))}
          </div>
        </div>

        {/* Semantic Group 3: Taxonomy & Discovery */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted">Taxonomy & Indexing</span>
            <div className="h-px flex-1 bg-black/[.06] dark:bg-white/[.06]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {taxonomyStats.map((item) => (
              <StatCard key={item.label} label={item.label} value={Number(item.value)} note={item.note} icon={item.icon} variant={item.variant} />
            ))}
          </div>
        </div>
      </div>

      {/* Charts & Review Queues */}
      <div className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
        {/* Editorial Volume Section */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-4 sm:p-8 shadow-soft">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-black/[.06] dark:border-white/[.06] pb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Volume & Cadence</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Monthly Publication & Audience Growth
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-xs font-semibold text-muted">
              <span className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-moss dark:bg-primary" />
                Published Articles
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block size-3 rounded-full bg-lime border border-black/10 dark:border-white/10" />
                User Signups
              </span>
            </div>
          </div>

          <div className="h-[280px] w-full pt-4 overflow-x-auto no-scrollbar">
            {chartData.length ? (
              <div className="grid h-full min-w-[460px] sm:min-w-0 grid-cols-12 items-end gap-1.5 border-b border-black/[.08] dark:border-white/[.08] px-2 sm:gap-3">
                {chartData.map((item) => (
                  <div
                    key={item.month}
                    title={`${item.month}: ${item.posts} published posts, ${item.users} user registrations`}
                    className="flex h-full min-w-0 flex-col items-center justify-end gap-2"
                  >
                    <div className="flex h-[88%] w-full items-end justify-center gap-1 sm:gap-1.5">
                      <span
                        className="w-1/2 max-w-[18px] rounded-t bg-moss dark:bg-primary transition-all hover:opacity-85"
                        style={{ height: `${(item.posts / chartMaximum) * 100}%` }}
                      />
                      <span
                        className="w-1/2 max-w-[18px] rounded-t bg-lime transition-all hover:opacity-85"
                        style={{ height: `${(item.users / chartMaximum) * 100}%` }}
                      />
                    </div>
                    <span className="w-full truncate text-center font-mono text-[10px] font-medium text-muted">
                      {item.month.slice(-2)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No monthly activity recorded">Activity data will render here as records grow.</EmptyState>
            )}
          </div>
        </section>

        {/* Attention Box: Moderation Queue */}
        <section className="flex flex-col justify-between rounded-3xl bg-[#12231b] dark:bg-[#0e1a14] border border-white/10 p-5 sm:p-8 text-white shadow-soft">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.18em] text-lime">Editorial Oversight</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white">Moderation Queue</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Review incoming articles and comments to safeguard the publication's voice and quality standards.
            </p>
            <div className="mt-6 space-y-3">
              <Link
                to="/admin/posts?status=PENDING"
                className="group flex items-center justify-between rounded-2xl bg-white/10 p-4 backdrop-blur-sm transition hover:bg-white/15"
              >
                <div>
                  <span className="block text-sm font-semibold text-white">Pending Posts</span>
                  <span className="text-xs text-white/70">Awaiting editorial review</span>
                </div>
                <strong className="font-display text-3xl font-bold text-lime transition group-hover:scale-105">
                  {data.pendingApprovals.posts}
                </strong>
              </Link>
              <Link
                to="/admin/comments?status=PENDING"
                className="group flex items-center justify-between rounded-2xl bg-white/10 p-4 backdrop-blur-sm transition hover:bg-white/15"
              >
                <div>
                  <span className="block text-sm font-semibold text-white">Pending Comments</span>
                  <span className="text-xs text-white/70">Reader submissions</span>
                </div>
                <strong className="font-display text-3xl font-bold text-lime transition group-hover:scale-105">
                  {data.pendingApprovals.comments}
                </strong>
              </Link>
            </div>
          </div>
          <Link
            to="/admin/posts"
            className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-lime hover:underline"
          >
            Manage all publications <BarChart3 size={15} />
          </Link>
        </section>
      </div>

      {/* Recent Activity Sections: Posts & Popular */}
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {/* Recent Posts */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 shadow-soft sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Recent Submissions</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Recent Articles</h2>
            </div>
            <Link to="/admin/posts" className="text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
            {data.recentPosts.map((post) => (
              <div key={post.id} className="flex items-center justify-between gap-4 py-3.5 transition hover:bg-paper/40 dark:hover:bg-surface/50 rounded-xl px-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{post.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    <span className="font-medium text-ink/80">{post.author}</span> · {post.category} · {new Date(post.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusPill value={post.status} />
              </div>
            ))}
          </div>
        </section>

        {/* Popular Posts */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 shadow-soft sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Top Performing Stories</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Most Popular Posts</h2>
            </div>
            <span className="text-xs font-semibold text-muted">Ranked by Likes</span>
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
            {data.popularPosts.map((post, index) => (
              <div key={post.id} className="flex items-center gap-4 py-3.5 transition hover:bg-paper/40 dark:hover:bg-surface/50 rounded-xl px-2">
                <span className="font-display text-lg font-bold text-muted/60 w-6">#{index + 1}</span>
                <Link
                  to={`/blogs/${post.slug}`}
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-moss dark:hover:text-primary transition"
                >
                  {post.title}
                </Link>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-500/10 dark:bg-rose-500/20 px-3 py-1 text-xs font-bold text-rose-800 dark:text-rose-300 border border-rose-500/25">
                  <Heart size={13} className="text-red-500 fill-red-500" /> {post.likeCount} likes
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Activity Sections: Users & Comments */}
      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {/* Recent Registered Users */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 shadow-soft sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Community Members</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Recent Registered Users</h2>
            </div>
            <Link to="/admin/users" className="text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
            {data.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-4 py-3.5 transition hover:bg-paper/40 dark:hover:bg-surface/50 rounded-xl px-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-lime/40 text-xs font-bold text-moss">
                    {u.username.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{u.username}</p>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusPill value={u.role} />
                  <span className="text-xs text-muted font-sans">{new Date(u.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent Comments */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 shadow-soft sm:p-7">
          <div className="mb-5 flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Reader Discussions</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Recent Comments</h2>
            </div>
            <Link to="/admin/comments" className="text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
            {data.recentComments.map((cm) => (
              <div key={cm.id} className="py-3.5 transition hover:bg-paper/40 dark:hover:bg-surface/50 rounded-xl px-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-ink truncate">
                    {cm.author} <span className="font-normal text-muted">on</span>{" "}
                    <span className="font-semibold text-moss dark:text-primary">{cm.postTitle}</span>
                  </p>
                  <StatusPill value={cm.status} />
                </div>
                <p className="mt-1.5 line-clamp-1 text-sm text-muted/90 italic">
                  &ldquo;{cm.content}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

export function AdminPostsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(new URLSearchParams(window.location.search).get("status") ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const url = useMemo(
    () =>
      `/admin/posts?page=${page}&limit=10&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`,
    [page, search, status, startDate, endDate],
  );
  const { data, loading, error, refresh } = useAdminData<PageResult<AdminPost>>(url);
  const postsList: AdminPost[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    if (decision === "APPROVED") {
      const confirmed = await confirmAction({
        title: "Publish Story?",
        text: "This story will be approved and published immediately to the public journal.",
        confirmText: "Publish Story",
        icon: "question",
      });
      if (!confirmed) return;
    }
    try {
      await api.post(`/admin/posts/${id}/review`, {
        decision,
        reason: decision === "REJECTED" ? reason : undefined,
      });
      setRejecting(null);
      setReason("");
      setActionError(null);
      refresh();
      await showSuccess(
        decision === "APPROVED" ? "Story Published" : "Submission Returned",
        decision === "APPROVED"
          ? "The story is now live for all readers."
          : "Editorial feedback was delivered to the author."
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError(decision === "APPROVED" ? "Failed to Publish" : "Failed to Reject", msg);
    }
  }

  async function remove(id: string) {
    const confirmed = await confirmDestructive({
      title: "Delete Story Permanently?",
      text: "Are you sure you want to delete this story? This action cannot be undone and will permanently remove all associated comments.",
      confirmText: "Delete Story",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/posts/${id}`);
      refresh();
      await showSuccess("Story Deleted", "The story was permanently removed.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Delete Story", msg);
    }
  }

  async function toggleFeatured(id: string, isFeatured: boolean) {
    try {
      await api.patch(`/admin/posts/${id}/featured`, { isFeatured });
      refresh();
      await showSuccess(
        isFeatured ? "Story Featured" : "Removed from Featured",
        isFeatured
          ? "This story is now highlighted in the editorial Featured Stories section."
          : "This story has been unfeatured from the homepage hero section."
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Update Featured Status", msg);
    }
  }

  return (
    <>
      <Seo title="Post Management — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Editorial Operations"
        title="Post Management"
        description="Review incoming submissions, approve or return drafts, modify articles, and inspect reader reception."
        action={
          <Link
            to="/admin/posts/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-moss px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90"
          >
            <FilePlus2 size={17} />
            <span>Create Post</span>
          </Link>
        }
      />

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {/* Filter and Full-Width Search Bar */}
      <div className="mb-8 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(input.trim());
              setPage(1);
            }}
            className="relative flex-1"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="field !pl-11 h-12 text-sm shadow-sm"
              placeholder="Search publication catalog by title, slug, or author..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </form>

          <div className="sm:w-60">
            <SelectField
              label=""
              className="h-12 text-sm shadow-sm mt-0"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Published (Live)</option>
              <option value="DRAFT">Draft</option>
              <option value="REJECTED">Rejected</option>
            </SelectField>
          </div>
        </div>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(val) => {
            setStartDate(val);
            setPage(1);
          }}
          onEndDateChange={(val) => {
            setEndDate(val);
            setPage(1);
          }}
          onClear={() => {
            setStartDate("");
            setEndDate("");
            setPage(1);
          }}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : postsList.length ? (
        <>
          <div className="space-y-4">
            {postsList.map((post) => (
              <div
                key={post.id}
                className="rounded-2xl border border-black/[.08] dark:border-white/[.08] border-l-4 border-l-moss dark:border-l-primary bg-surface dark:bg-surface-elevated p-5 sm:p-6 shadow-soft transition-all duration-200 hover:border-black/20 dark:hover:border-white/20 hover:shadow-md"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="rounded-full bg-lime/40 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-[#12231b] border border-lime/60">
                        {post.category}
                      </span>
                      <StatusPill value={post.status} />
                      {Boolean(post.isFeatured) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Sparkles size={11} className="text-amber-500 fill-amber-500" />
                          Featured Story
                        </span>
                      )}
                      <span className="text-[11px] text-muted font-sans">
                        {post.submittedAt
                          ? `Submitted ${new Date(post.submittedAt).toLocaleDateString()}`
                          : `Created ${new Date(post.publishedAt ?? Date.now()).toLocaleDateString()}`}
                      </span>
                    </div>

                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      className="mt-2 block font-display text-xl font-bold tracking-tight text-ink hover:text-moss dark:hover:text-primary sm:text-2xl transition"
                    >
                      {post.title}
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>
                        Author: <strong className="font-semibold text-ink">{post.authorUsername}</strong>
                      </span>
                      <span>·</span>
                      <span>{post.likeCount} likes</span>
                      <span>·</span>
                      <span>{post.commentCount} comments</span>
                      <span>·</span>
                      <span className="font-mono text-[11px]">/{post.slug}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                    {post.status === "APPROVED" && (
                      <button
                        type="button"
                        onClick={() => void toggleFeatured(post.id, !post.isFeatured)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-sm transition ${
                          post.isFeatured
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/25"
                            : "border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated text-muted hover:text-ink hover:bg-paper"
                        }`}
                        title={post.isFeatured ? "Remove from Featured Stories" : "Mark as Featured Story on Homepage"}
                      >
                        <Sparkles size={13} className={post.isFeatured ? "text-amber-500 fill-amber-500" : ""} />
                        {post.isFeatured ? "Featured" : "Feature"}
                      </button>
                    )}

                    {post.status === "APPROVED" && (
                      <Link
                        to={`/blogs/${post.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-paper dark:hover:bg-surface transition"
                      >
                        View Public
                      </Link>
                    )}

                    <Link
                      to={`/admin/posts/${post.id}/edit`}
                      aria-label="Edit story"
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm hover:bg-paper hover:text-moss dark:hover:text-primary transition"
                    >
                      <Pencil size={14} /> Edit
                    </Link>

                    {post.status === "PENDING" && (
                      <>
                        <button
                          type="button"
                          onClick={() => void review(post.id, "APPROVED")}
                          className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-4 py-1.5 text-xs font-semibold text-white dark:text-[#171B19] shadow-sm hover:bg-ink transition"
                        >
                          <Check size={14} /> Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(post.id)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-red-300 dark:border-red-800 bg-surface dark:bg-surface-elevated px-4 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 shadow-sm hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                        >
                          <X size={14} /> Reject
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => void remove(post.id)}
                      className="rounded-full p-2 text-muted hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400 transition"
                      aria-label="Delete story"
                      title="Delete story permanently"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {rejecting === post.id && (
                  <form
                    className="mt-5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20 p-5 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void review(post.id, "REJECTED");
                    }}
                  >
                    <div>
                      <h4 className="font-display text-base font-bold text-red-900 dark:text-red-300">Return Story to Contributor</h4>
                      <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
                        Please provide actionable feedback explaining why this submission was rejected or what changes are required.
                      </p>
                    </div>
                    <TextArea
                      label="Editorial Rejection Reason"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      maxLength={1000}
                      required
                      className="min-h-24 bg-surface dark:bg-surface"
                      placeholder="Explain why this article cannot be published in its current form..."
                    />
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="danger" type="submit">
                        Confirm Rejection
                      </Button>
                      <Button variant="secondary" type="button" onClick={() => setRejecting(null)}>
                        <X size={15} /> Cancel
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ))}
          </div>

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 10}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="No stories match your criteria">
          Try adjusting your search terms or create a new story from the button above.
        </EmptyState>
      )}
    </>
  );
}

export function AdminTaxonomyPage({ kind }: { kind: "categories" | "tags" }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const url = useMemo(
    () => `/admin/${kind}?page=${page}&limit=10&search=${encodeURIComponent(search)}`,
    [kind, page, search],
  );
  const { data, loading, error, refresh } = useAdminData<PageResult<Taxonomy>>(url);
  const taxonomyList: Taxonomy[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [editing, setEditing] = useState<Taxonomy | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const isCategory = kind === "categories";
  const [imageId, setImageId] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setImageId(editing?.imageId ?? null);
    setImagePath(editing?.imagePath ?? null);
  }, [editing]);

  async function uploadCategoryImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await api.post<{ data: { id: string; path: string } }>("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setImageId(result.data.data.id);
      setImagePath(result.data.data.path);
    } catch (requestError) {
      setFormError(getErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body = {
      name: String(form.get("name")),
      description: String(form.get("description") || ""),
      isActive: form.get("isActive") === "on",
      ...(isCategory ? { imageId } : {}),
    };
    try {
      if (editing) {
        await api.patch(`/admin/${kind}/${editing.id}`, body);
        await showSuccess(
          `${isCategory ? "Category" : "Tag"} Updated`,
          `“${body.name}” changes were saved successfully.`
        );
      } else {
        await api.post(`/admin/${kind}`, body);
        await showSuccess(
          `${isCategory ? "Category" : "Tag"} Created`,
          `“${body.name}” was added successfully.`
        );
      }
      setEditing(null);
      setFormError(null);
      refresh();
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setFormError(msg);
      await showError(`Failed to Save ${isCategory ? "Category" : "Tag"}`, msg);
    }
  }

  async function remove(item: Taxonomy) {
    const confirmed = await confirmDestructive({
      title: `Delete ${isCategory ? "Category" : "Tag"}?`,
      text: `Are you sure you want to delete “${item.name}”? Any associated posts will have this ${isCategory ? "category" : "tag"} unlinked.`,
      confirmText: `Delete ${isCategory ? "Category" : "Tag"}`,
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/${kind}/${item.id}`);
      refresh();
      await showSuccess(
        `${isCategory ? "Category" : "Tag"} Deleted`,
        `“${item.name}” has been removed.`
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setFormError(msg);
      await showError(`Failed to Delete ${isCategory ? "Category" : "Tag"}`, msg);
    }
  }

  return (
    <>
      <Seo title={`${isCategory ? "Category Management" : "Tag Management"} — Admin Portal`} robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Editorial Taxonomy"
        title={isCategory ? "Category Management" : "Tag Management"}
        description={
          isCategory
            ? "Create and organize journal sections with custom cover imagery, unique slugs, and safe association tracking."
            : "Manage cross-cutting topical keywords connecting relevant stories across the publication."
        }
      />

      <div className="grid gap-8 xl:grid-cols-[.7fr_1.3fr]">
        {/* Left Form Card */}
        <form
          onSubmit={save}
          className="h-fit space-y-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft"
        >
          <div className="border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">
              {editing ? "Modify Record" : "New Definition"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">
              {editing ? "Edit" : "Add"} {isCategory ? "Category" : "Tag"}
            </h2>
          </div>

          {formError && <Notice>{formError}</Notice>}

          <Field
            label="Name"
            name="name"
            required
            minLength={2}
            maxLength={isCategory ? 100 : 80}
            defaultValue={editing?.name ?? ""}
            key={editing?.id ?? "new"}
            placeholder={isCategory ? "e.g. Architecture & Design" : "e.g. typography"}
          />

          <TextArea
            label="Description"
            name="description"
            maxLength={5000}
            defaultValue={editing?.description ?? ""}
            key={`description-${editing?.id ?? "new"}`}
            placeholder="A brief editorial overview of this classification..."
          />

          {isCategory && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">Category Imagery</label>
              {imagePath && (
                <div className="relative overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08]">
                  <img
                    src={imageUrl(imagePath)}
                    alt=""
                    className="aspect-video w-full object-cover"
                  />
                </div>
              )}
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-paper/50 dark:bg-surface/50 px-4 py-4 text-sm font-semibold text-muted transition hover:bg-paper dark:hover:bg-surface hover:text-moss dark:hover:text-primary">
                <Upload size={16} />
                {uploading ? "Uploading file..." : imagePath ? "Replace category artwork" : "Upload category artwork"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading}
                  onChange={(event) => void uploadCategoryImage(event.target.files?.[0])}
                />
              </label>
              {imageId && (
                <button
                  type="button"
                  className="text-xs font-semibold text-muted hover:text-red-700 dark:hover:text-red-400 transition"
                  onClick={() => {
                    setImageId(null);
                    setImagePath(null);
                  }}
                >
                  Remove current artwork
                </button>
              )}
              <p className="text-xs text-muted">Displayed across header banners on the public archive hub.</p>
            </div>
          )}

          <label className="flex items-center gap-3 text-sm font-semibold text-ink cursor-pointer pt-1">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={editing?.isActive ?? true}
              key={`active-${editing?.id ?? "new"}`}
              className="size-4 accent-moss rounded"
            />
            <span>Active <span className="font-normal text-muted">(Visible to contributors and readers)</span></span>
          </label>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-black/[.06] dark:border-white/[.06]">
            <Button type="submit">
              {editing ? "Save Changes" : "Create"} <Check size={15} />
            </Button>
            {editing && (
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            )}
          </div>
        </form>

        {/* Right List & Search */}
        <section className="space-y-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(input.trim());
              setPage(1);
            }}
            className="relative"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17} />
            <input
              className="field !pl-11 h-12 text-sm shadow-sm"
              placeholder={`Search ${kind} by name or slug...`}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
          </form>

          {loading ? (
            <TableSkeleton rows={6} cols={4} />
          ) : error ? (
            <Notice>{error}</Notice>
          ) : taxonomyList.length ? (
            <div className="overflow-x-auto rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-background/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-6 py-4">Name & Slug</th>
                    <th className="px-6 py-4 hidden sm:table-cell">Description</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.06] dark:divide-white/[.06]">
                  {taxonomyList.map((item) => (
                    <tr key={item.id} className="hover:bg-paper/40 dark:hover:bg-surface/50 transition">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-ink">{item.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                          <span className="font-mono text-[11px] text-muted/80">/{item.slug}</span>
                          {item.postCount !== undefined && (
                            <span className="rounded-full bg-paper dark:bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted border border-black/[.06] dark:border-white/[.06]">
                              {item.postCount} {Number(item.postCount) === 1 ? "story" : "stories"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <p className="line-clamp-2 text-xs text-muted leading-relaxed">
                          {item.description || "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill value={item.isActive ? "ACTIVE" : "DISABLED"} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(item)}
                            className="rounded-full p-2 text-muted hover:bg-paper dark:hover:bg-surface hover:text-moss dark:hover:text-primary transition"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void remove(item)}
                            className="rounded-full p-2 text-muted hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400 transition"
                            aria-label="Delete"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title={`No ${kind} found`}>
              Define your first {isCategory ? "category" : "tag"} using the form on the left.
            </EmptyState>
          )}

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 10}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </section>
      </div>
    </>
  );
}

export function AdminCommentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const url = useMemo(
    () => `/admin/comments?page=${page}&limit=10${status ? `&status=${status}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`,
    [page, status, startDate, endDate],
  );
  const { data, loading, error, refresh } = useAdminData<PageResult<AdminComment>>(url);
  const commentsList: AdminComment[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [actionError, setActionError] = useState<string | null>(null);

  async function moderate(comment: AdminComment, decision: "APPROVED" | "REJECTED") {
    try {
      await api.patch(`/admin/comments/${comment.id}/moderation`, { status: decision });
      refresh();
      showToast({
        title: decision === "APPROVED" ? "Comment Approved" : "Comment Rejected",
        icon: decision === "APPROVED" ? "success" : "warning",
      });
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Moderation Failed", msg);
    }
  }

  async function remove(comment: AdminComment) {
    const confirmed = await confirmDestructive({
      title: "Remove Comment Permanently?",
      text: "This reader discussion comment will be permanently deleted from the database.",
      confirmText: "Delete Comment",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/comments/${comment.id}`);
      refresh();
      await showSuccess("Comment Deleted", "The comment was permanently removed.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Delete Comment", msg);
    }
  }

  return (
    <>
      <Seo title="Comment Moderation — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Community Voice"
        title="Comment Management"
        description="Inspect submitted reader feedback, approve thoughtful perspectives, or discard inappropriate messages."
      />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-64">
          <SelectField
            label="Filter by Review Status"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved (Public)</option>
            <option value="REJECTED">Rejected</option>
          </SelectField>
        </div>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={(val) => {
            setStartDate(val);
            setPage(1);
          }}
          onEndDateChange={(val) => {
            setEndDate(val);
            setPage(1);
          }}
          onClear={() => {
            setStartDate("");
            setEndDate("");
            setPage(1);
          }}
        />
      </div>

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : commentsList.length > 0 ? (
        <>
          <div className="space-y-5">
            {commentsList.map((comment) => (
              <article
                key={comment.id}
                className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-7 shadow-soft transition hover:border-black/20 dark:hover:border-white/20"
              >
                {/* Author Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[.06] dark:border-white/[.06] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-lime/40 text-xs font-bold text-moss">
                      {comment.authorUsername.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-ink">
                        {comment.authorUsername}
                        <span className="font-normal text-muted"> commented on </span>
                        <Link
                          className="font-medium text-moss dark:text-primary hover:underline"
                          to={`/blogs/${comment.postSlug}`}
                        >
                          {comment.postTitle}
                        </Link>
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(comment.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <StatusPill value={comment.status} />
                </div>

                {/* Content Body */}
                <div className="my-4 rounded-2xl bg-paper/60 dark:bg-background/40 p-4 sm:p-5 text-sm leading-relaxed text-ink/85 border border-black/[.04] dark:border-white/[.04]">
                  <p className="whitespace-pre-wrap">{comment.content}</p>
                </div>

                {/* Action Row at Bottom */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  {comment.status === "PENDING" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void moderate(comment, "APPROVED")}
                        className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-4 py-2 text-xs font-semibold text-white dark:text-[#171B19] shadow-sm hover:bg-ink transition"
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void moderate(comment, "REJECTED")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-300 dark:border-red-800 bg-surface dark:bg-surface-elevated px-4 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      >
                        <X size={14} /> Reject
                      </button>
                    </>
                  )}
                  {comment.status === "REJECTED" && (
                    <button
                      type="button"
                      onClick={() => void moderate(comment, "APPROVED")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-4 py-2 text-xs font-semibold text-white dark:text-[#171B19] shadow-sm hover:bg-ink transition"
                    >
                      <Check size={14} /> Re-approve
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(comment)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated px-3.5 py-2 text-xs font-semibold text-muted hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-900 transition"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 10}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="No reader comments found">
          Submitted reader interactions and moderation requests will appear here.
        </EmptyState>
      )}
    </>
  );
}

interface AdminUserDetail {
  id: string;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
  isActive: boolean;
  createdAt: string;
  profileImagePath?: string | null;
  totalPosts?: number;
  publishedPosts?: number;
  pendingPosts?: number;
  rejectedPosts?: number;
  totalComments?: number;
  totalLikesReceived?: number;
}

export function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [input, setInput] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [startDate] = useState("");
  const [endDate] = useState("");

  const url = useMemo(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", "10");
    if (search) q.set("search", search);
    if (roleFilter) q.set("role", roleFilter);
    if (statusFilter) q.set("status", statusFilter);
    if (startDate) q.set("startDate", startDate);
    if (endDate) q.set("endDate", endDate);
    return `/admin/users?${q.toString()}`;
  }, [page, search, roleFilter, statusFilter, startDate, endDate]);

  const { data, loading, error, refresh } = useAdminData<PageResult<AdminUserDetail>>(url);
  const usersList: AdminUserDetail[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [actionError, setActionError] = useState<string | null>(null);
  const [inspectUser, setInspectUser] = useState<AdminUserDetail | null>(null);

  async function update(user: AdminUserDetail, body: { role?: "USER" | "ADMIN"; isActive?: boolean }) {
    if (body.isActive === false) {
      const confirmed = await confirmDestructive({
        title: "Disable Member Account?",
        text: `Are you sure you want to disable ${user.username}'s account? They will be locked out and unable to log in.`,
        confirmText: "Disable Account",
      });
      if (!confirmed) return;
    } else if (body.role && body.role !== user.role) {
      const confirmed = await confirmAction({
        title: `Change Role to ${body.role}?`,
        text: `Are you sure you want to change ${user.username}'s permission level from ${user.role} to ${body.role}?`,
        confirmText: `Set Role to ${body.role}`,
        icon: "warning",
      });
      if (!confirmed) return;
    }
    try {
      await api.patch(`/admin/users/${user.id}`, body);
      refresh();
      if (inspectUser && inspectUser.id === user.id) {
        setInspectUser({ ...inspectUser, ...body });
      }
      await showSuccess("Member Updated", `${user.username}'s account status has been updated.`);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Update User", msg);
    }
  }

  return (
    <>
      <Seo title="User Management — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Community Governance"
        title="User Management"
        description="Inspect member activity, modify permissions, manage account status, and monitor contributor performance."
      />

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <form
          className="relative max-w-md flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(input.trim());
            setPage(1);
          }}
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={17} />
          <input
            className="field !pl-11 h-12 text-sm shadow-sm"
            placeholder="Search username or email address..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
        </form>

        <div className="flex gap-3">
          <SelectField
            label=""
            className="min-w-36 h-12 text-sm shadow-sm mt-0"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </SelectField>

          <SelectField
            label=""
            className="min-w-36 h-12 text-sm shadow-sm mt-0"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled / Blocked</option>
          </SelectField>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : usersList.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-background/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4">Member</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Account Status</th>
                  <th className="px-6 py-4">Publications</th>
                  <th className="px-6 py-4">Appreciation</th>
                  <th className="px-6 py-4">Joined Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.06] dark:divide-white/[.06]">
                {usersList.map((user) => (
                  <tr key={user.id} className="hover:bg-paper/40 dark:hover:bg-surface/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full bg-lime/40 text-xs font-bold text-moss">
                          {user.profileImagePath ? (
                            <img src={imageUrl(user.profileImagePath)} alt="" className="size-full object-cover" />
                          ) : (
                            user.username.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-ink">{user.username}</p>
                          <p className="text-xs text-muted">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill value={user.role} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill value={user.isActive ? "ACTIVE" : "DISABLED"} />
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold">
                      <span className="font-bold text-moss dark:text-primary">{user.publishedPosts ?? 0}</span>
                      <span className="text-muted"> / {user.totalPosts ?? 0} total</span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <span className="inline-flex items-center gap-1 font-semibold text-ink">
                        <Heart size={13} className="text-red-500 fill-red-500/20" /> {user.totalLikesReceived ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted whitespace-nowrap">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setInspectUser(user)}
                        >
                          Details
                        </Button>
                        <Button
                          variant={user.isActive ? "danger" : "primary"}
                          onClick={() => void update(user, { isActive: !user.isActive })}
                        >
                          {user.isActive ? "Block" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 10}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="No members match your criteria">
          Try a different search query or reset your status filters.
        </EmptyState>
      )}

      {/* User Details Modal */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-[30px] border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-7 shadow-soft sm:p-9">
            <div className="flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4">
              <div className="flex items-center gap-3">
                <div className="grid size-12 place-items-center overflow-hidden rounded-full bg-lime/40 text-lg font-bold text-moss">
                  {inspectUser.profileImagePath ? (
                    <img src={imageUrl(inspectUser.profileImagePath)} alt="" className="size-full object-cover" />
                  ) : (
                    inspectUser.username.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <h3 className="font-display text-2xl font-bold text-ink">{inspectUser.username}</h3>
                  <p className="text-xs text-muted">{inspectUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="rounded-full p-2 text-muted hover:bg-paper dark:hover:bg-surface hover:text-ink transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Statistics Grid */}
            <div className="my-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper dark:bg-surface p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Total Posts</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">{inspectUser.totalPosts ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center text-emerald-800 dark:text-emerald-300">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Published</p>
                <p className="mt-1 font-display text-2xl font-bold">{inspectUser.publishedPosts ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-center text-amber-800 dark:text-amber-300">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending</p>
                <p className="mt-1 font-display text-2xl font-bold">{inspectUser.pendingPosts ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-rose-800 dark:text-rose-300">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 dark:text-rose-400">Rejected</p>
                <p className="mt-1 font-display text-2xl font-bold">{inspectUser.rejectedPosts ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper dark:bg-surface p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Likes</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">{inspectUser.totalLikesReceived ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper dark:bg-surface p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Comments</p>
                <p className="mt-1 font-display text-2xl font-bold text-ink">{inspectUser.totalComments ?? 0}</p>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface/50 p-4 text-xs text-muted">
              <p>
                <strong className="text-ink">Member Since:</strong> {new Date(inspectUser.createdAt).toLocaleString()}
              </p>
              <p>
                <strong className="text-ink">Assigned Role:</strong> <span className="uppercase font-semibold text-moss dark:text-primary">{inspectUser.role}</span>
              </p>
              <p>
                <strong className="text-ink">Access Status:</strong> {inspectUser.isActive ? "Active (Normal access)" : "Disabled / Blocked"}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-black/[.06] dark:border-white/[.06] pt-4">
              <Button
                variant="secondary"
                onClick={() =>
                  void update(inspectUser, {
                    role: inspectUser.role === "ADMIN" ? "USER" : "ADMIN",
                  })
                }
              >
                {inspectUser.role === "ADMIN" ? "Demote to User" : "Promote to Admin"}
              </Button>
              <Button
                variant={inspectUser.isActive ? "danger" : "primary"}
                onClick={() =>
                  void update(inspectUser, {
                    isActive: !inspectUser.isActive,
                  })
                }
              >
                {inspectUser.isActive ? "Deactivate User" : "Activate User Account"}
              </Button>
              <Button variant="secondary" onClick={() => setInspectUser(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface SeoOwner {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
}

interface SeoMetadata {
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImageUrl: string | null;
  robotsIndex: boolean | number | null;
  robotsFollow: boolean | number | null;
}

type SeoOwnerType = "page" | "post" | "category" | "tag";

const pageSeoOwners = [
  { id: "home", label: "Home Page" },
  { id: "about", label: "About Us Page" },
  { id: "blogs", label: "Blogs Directory Page" },
  { id: "contact", label: "Contact Us Page" },
];

interface SeoRecord {
  id: string;
  postId: string | null;
  categoryId: string | null;
  tagId: string | null;
  pageKey: string | null;
  title: string | null;
  description: string | null;
  keywords: string | null;
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  twitterTitle: string | null;
  twitterDescription: string | null;
  twitterImageUrl: string | null;
  robotsIndex: boolean | number | null;
  robotsFollow: boolean | number | null;
  updatedAt: string;
  postTitle?: string | null;
  postSlug?: string | null;
  categoryName?: string | null;
  categorySlug?: string | null;
  tagName?: string | null;
  tagSlug?: string | null;
}

function getSeoRecordType(record: SeoRecord): SeoOwnerType {
  if (record.pageKey) return "page";
  if (record.postId) return "post";
  if (record.categoryId) return "category";
  return "tag";
}

function getSeoRecordName(record: SeoRecord): string {
  if (record.pageKey) {
    const matched = pageSeoOwners.find((p) => p.id === record.pageKey);
    return matched ? matched.label : `Page: ${record.pageKey}`;
  }
  if (record.postTitle) return record.postTitle;
  if (record.categoryName) return record.categoryName;
  if (record.tagName) return record.tagName;
  return "Untitled Resource";
}

function getSeoRecordOwnerId(record: SeoRecord): string {
  return record.pageKey ?? record.postId ?? record.categoryId ?? record.tagId ?? "";
}

function getSeoRecordViewUrl(record: SeoRecord): string | null {
  if (record.pageKey === "home") return "/";
  if (record.pageKey === "about") return "/about";
  if (record.pageKey === "blogs") return "/blogs";
  if (record.pageKey === "contact") return "/contact";
  if (record.postSlug) return `/blogs/${record.postSlug}`;
  if (record.categorySlug) return `/category/${record.categorySlug}`;
  if (record.tagSlug) return `/tag/${record.tagSlug}`;
  return null;
}

export function AdminSeoPage() {
  const editorRef = useRef<HTMLDivElement | null>(null);

  // SEO Directory Overview state
  const [records, setRecords] = useState<SeoRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | SeoOwnerType>("all");
  const [overviewPage, setOverviewPage] = useState(1);

  // SEO Editor Form state
  const [ownerType, setOwnerType] = useState<SeoOwnerType>("page");
  const [ownerId, setOwnerId] = useState("home");
  const [ownersByType, setOwnersByType] = useState<Record<Exclude<SeoOwnerType, "page">, SeoOwner[]>>({
    post: [],
    category: [],
    tag: [],
  });

  // Full SEO fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogTitle, setOgTitle] = useState("");
  const [ogDescription, setOgDescription] = useState("");
  const [ogImageUrl, setOgImageUrl] = useState("");
  const [twitterTitle, setTwitterTitle] = useState("");
  const [twitterDescription, setTwitterDescription] = useState("");
  const [twitterImageUrl, setTwitterImageUrl] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Fetch all SEO directory records
  async function loadRecords() {
    setRecordsLoading(true);
    try {
      const res = await api.get<{ data: SeoRecord[] }>("/admin/seo");
      setRecords(res.data.data);
      setRecordsError(null);
    } catch (requestError: unknown) {
      setRecordsError(getErrorMessage(requestError));
    } finally {
      setRecordsLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  // Fetch selectable owner entities (posts, categories, tags)
  useEffect(() => {
    let active = true;
    Promise.all([
      api.get<{ data: PageResult<SeoOwner> }>("/admin/posts?page=1&limit=100"),
      api.get<{ data: PageResult<SeoOwner> }>("/admin/categories?page=1&limit=100"),
      api.get<{ data: PageResult<SeoOwner> }>("/admin/tags?page=1&limit=100"),
    ])
      .then(([posts, categories, tags]) => {
        if (!active) return;
        const extractList = (res: any): SeoOwner[] => {
          const body = res?.data;
          if (Array.isArray(body)) return body;
          if (Array.isArray(body?.data)) return body.data;
          if (Array.isArray(body?.data?.data)) return body.data.data;
          return [];
        };
        setOwnersByType({
          post: extractList(posts),
          category: extractList(categories),
          tag: extractList(tags),
        });
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedOwners = ownerType === "page" ? pageSeoOwners : ownersByType[ownerType];

  useEffect(() => {
    if (!selectedOwners.some((owner) => owner.id === ownerId)) {
      setOwnerId(selectedOwners[0]?.id ?? "");
    }
  }, [selectedOwners, ownerId]);

  // Load individual entity metadata when owner selection changes
  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      setTitle("");
      setDescription("");
      setKeywords("");
      setCanonicalUrl("");
      setOgTitle("");
      setOgDescription("");
      setOgImageUrl("");
      setTwitterTitle("");
      setTwitterDescription("");
      setTwitterImageUrl("");
      setRobotsIndex(true);
      setRobotsFollow(true);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{ data: SeoMetadata | null }>(`/admin/seo/${ownerType}/${encodeURIComponent(ownerId)}`)
      .then((response) => {
        if (!active) return;
        const metadata = response.data.data;
        setTitle(metadata?.title ?? "");
        setDescription(metadata?.description ?? "");
        setKeywords(metadata?.keywords ?? "");
        setCanonicalUrl(metadata?.canonicalUrl ?? "");
        setOgTitle(metadata?.ogTitle ?? "");
        setOgDescription(metadata?.ogDescription ?? "");
        setOgImageUrl(metadata?.ogImageUrl ?? "");
        setTwitterTitle(metadata?.twitterTitle ?? "");
        setTwitterDescription(metadata?.twitterDescription ?? "");
        setTwitterImageUrl(metadata?.twitterImageUrl ?? "");
        setRobotsIndex(metadata?.robotsIndex !== false && metadata?.robotsIndex !== 0);
        setRobotsFollow(metadata?.robotsFollow !== false && metadata?.robotsFollow !== 0);
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
  }, [ownerType, ownerId]);

  // Handle Edit action from overview table
  function handleEditRecord(record: SeoRecord) {
    const nextOwnerType = getSeoRecordType(record);
    const nextOwnerId = getSeoRecordOwnerId(record);
    setOwnerType(nextOwnerType);
    setOwnerId(nextOwnerId);
    setTitle(record.title ?? "");
    setDescription(record.description ?? "");
    setKeywords(record.keywords ?? "");
    setCanonicalUrl(record.canonicalUrl ?? "");
    setOgTitle(record.ogTitle ?? "");
    setOgDescription(record.ogDescription ?? "");
    setOgImageUrl(record.ogImageUrl ?? "");
    setTwitterTitle(record.twitterTitle ?? "");
    setTwitterDescription(record.twitterDescription ?? "");
    setTwitterImageUrl(record.twitterImageUrl ?? "");
    setRobotsIndex(record.robotsIndex !== false && record.robotsIndex !== 0);
    setRobotsFollow(record.robotsFollow !== false && record.robotsFollow !== 0);
    setMessage(null);
    setError(null);
    editorRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // Filtered SEO directory records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const recType = getSeoRecordType(r);
      if (typeFilter !== "all" && recType !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const name = getSeoRecordName(r).toLowerCase();
      const titleText = (r.title ?? "").toLowerCase();
      const descText = (r.description ?? "").toLowerCase();
      const slugText = (r.postSlug ?? r.categorySlug ?? r.tagSlug ?? r.pageKey ?? "").toLowerCase();
      return name.includes(q) || titleText.includes(q) || descText.includes(q) || slugText.includes(q);
    });
  }, [records, typeFilter, search]);

  const pageSize = 8;
  const paginatedRecords = useMemo(() => {
    const start = (overviewPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, overviewPage]);

  // Counts for filter pills
  const counts = useMemo(() => {
    return {
      all: records.length,
      page: records.filter((r) => Boolean(r.pageKey)).length,
      post: records.filter((r) => Boolean(r.postId)).length,
      category: records.filter((r) => Boolean(r.categoryId)).length,
      tag: records.filter((r) => Boolean(r.tagId)).length,
    };
  }, [records]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/admin/seo/${ownerType}/${encodeURIComponent(ownerId)}`, {
        title: title.trim() || null,
        description: description.trim() || null,
        keywords: keywords.trim() || null,
        canonicalUrl: canonicalUrl.trim() || null,
        ogTitle: ogTitle.trim() || null,
        ogDescription: ogDescription.trim() || null,
        ogImageUrl: ogImageUrl.trim() || null,
        twitterTitle: twitterTitle.trim() || null,
        twitterDescription: twitterDescription.trim() || null,
        twitterImageUrl: twitterImageUrl.trim() || null,
        robotsIndex,
        robotsFollow,
      });
      setMessage("SEO metadata saved successfully to MySQL database.");
      void loadRecords();
      await showSuccess("SEO Metadata Saved", "Search engine optimization settings were saved successfully.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Failed to Save SEO", msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Seo title="SEO Management — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Search Optimization"
        title="SEO Management"
        description="Inspect all indexable site entities, manage canonical URLs, social metadata cards, and crawler indexing directives."
      />

      {error && (
        <div className="mb-6">
          <Notice>{error}</Notice>
        </div>
      )}
      {message && (
        <div className="mb-6">
          <Notice variant="success">{message}</Notice>
        </div>
      )}

      {/* =========================================================================
          SECTION 1: SEO OVERVIEW DIRECTORY TABLE
          ========================================================================= */}
      <section className="mb-12 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">Configured SEO Records</h2>
            <p className="mt-1 text-xs text-muted">
              Directory of all active metadata profiles stored in MySQL (`seo_metadata`).
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="text"
              placeholder="Search by name, title, slug..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOverviewPage(1);
              }}
              className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated py-2 pl-9 pr-4 text-xs font-medium text-ink placeholder:text-muted/70 shadow-soft focus:border-moss focus:outline-none"
            />
          </div>
        </div>

        {/* Filter Tabs / Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "all", label: "All Records", count: counts.all },
              { key: "page", label: "Standard Pages", count: counts.page },
              { key: "post", label: "Blog Posts", count: counts.post },
              { key: "category", label: "Categories", count: counts.category },
              { key: "tag", label: "Tags", count: counts.tag },
            ] as const
          ).map((filter) => {
            const isActive = typeFilter === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => {
                  setTypeFilter(filter.key);
                  setOverviewPage(1);
                }}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-moss dark:bg-primary text-white dark:text-[#171B19] shadow-sm"
                    : "border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated text-ink hover:border-black/20 dark:hover:border-white/20 hover:bg-paper dark:hover:bg-surface"
                }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isActive ? "bg-white/20 dark:bg-black/20 text-white dark:text-[#171B19]" : "bg-paper dark:bg-surface text-muted"
                  }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        {recordsLoading ? (
          <Loading label="Loading SEO records..." />
        ) : recordsError ? (
          <Notice>{recordsError}</Notice>
        ) : filteredRecords.length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft">
              <table className="w-full min-w-[950px] text-left text-sm">
                <thead className="border-b border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-background/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-6 py-4">Entity</th>
                    <th className="px-6 py-4">Meta Title & Description</th>
                    <th className="px-6 py-4">Status & Quality</th>
                    <th className="px-6 py-4">Canonical URL</th>
                    <th className="px-6 py-4">Robots</th>
                    <th className="px-6 py-4">Last Updated</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.06] dark:divide-white/[.06]">
                  {paginatedRecords.map((record) => {
                    const recordType = getSeoRecordType(record);
                    const recordName = getSeoRecordName(record);
                    const viewUrl = getSeoRecordViewUrl(record);
                    const isIndex = record.robotsIndex !== false && record.robotsIndex !== 0;
                    const isFollow = record.robotsFollow !== false && record.robotsFollow !== 0;

                    const typeBadgeStyles =
                      recordType === "page"
                        ? "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/20"
                        : recordType === "post"
                        ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                        : recordType === "category"
                        ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20"
                        : "bg-purple-500/10 text-purple-800 dark:text-purple-300 border-purple-500/20";

                    return (
                      <tr key={record.id} className="hover:bg-paper/40 dark:hover:bg-surface/50 transition">
                        {/* Entity */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1.5">
                            <span
                              className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${typeBadgeStyles}`}
                            >
                              {recordType}
                            </span>
                            <span className="font-semibold text-ink line-clamp-1 max-w-[220px]">
                              {recordName}
                            </span>
                            {(record.postSlug || record.categorySlug || record.tagSlug || record.pageKey) && (
                              <span className="font-mono text-[10px] text-muted">
                                /{record.postSlug || record.categorySlug || record.tagSlug || record.pageKey}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Meta Title & Description */}
                        <td className="px-6 py-4 max-w-xs">
                          {record.title ? (
                            <p className="font-medium text-ink line-clamp-1 text-xs sm:text-sm">
                              {record.title}
                            </p>
                          ) : (
                            <p className="italic text-xs text-muted/80">No custom title configured</p>
                          )}
                          {record.description ? (
                            <p className="mt-1 text-xs text-muted line-clamp-2 leading-relaxed">
                              {record.description}
                            </p>
                          ) : (
                            <p className="mt-1 text-[11px] text-muted/60">No meta description</p>
                          )}
                        </td>

                        {/* Status & Quality */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {record.title && record.description ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                <CheckCircle2 size={12} /> Complete
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={12} /> Incomplete
                              </span>
                            )}
                            {!record.description && (
                              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-300 w-fit">
                                Missing Description
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Canonical URL */}
                        <td className="px-6 py-4 max-w-[200px]">
                          {record.canonicalUrl ? (
                            <a
                              href={record.canonicalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-xs text-moss dark:text-primary hover:underline truncate block"
                              title={record.canonicalUrl}
                            >
                              {record.canonicalUrl.replace(/^https?:\/\//, "")}
                            </a>
                          ) : (
                            <span className="text-xs text-muted/60">—</span>
                          )}
                        </td>

                        {/* Robots Directives */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1 text-[10px] font-bold uppercase">
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 border ${
                                isIndex
                                  ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20"
                                  : "bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20"
                              }`}
                            >
                              {isIndex ? "Index" : "NoIndex"}
                            </span>
                            <span
                              className={`inline-flex w-fit rounded-full px-2 py-0.5 border ${
                                isFollow
                                  ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20"
                                  : "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20"
                              }`}
                            >
                              {isFollow ? "Follow" : "NoFollow"}
                            </span>
                          </div>
                        </td>

                        {/* Last Updated */}
                        <td className="px-6 py-4 text-xs text-muted whitespace-nowrap">
                          {record.updatedAt ? new Date(record.updatedAt).toLocaleDateString() : "—"}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditRecord(record)}
                              className="inline-flex items-center gap-1 rounded-lg border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-ink shadow-sm transition hover:border-moss hover:bg-moss hover:text-white dark:hover:bg-primary dark:hover:text-[#171B19]"
                              title="Edit SEO Metadata"
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>
                            {viewUrl && (
                              <a
                                href={viewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="grid size-7 place-items-center rounded-lg border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated text-muted shadow-sm transition hover:border-black/30 dark:hover:border-white/30 hover:text-ink"
                                title="View Live Page"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredRecords.length > pageSize && (
              <Pagination
                page={overviewPage}
                limit={pageSize}
                total={filteredRecords.length}
                onChange={setOverviewPage}
              />
            )}
          </div>
        ) : (
          <EmptyState title="No SEO metadata records match your criteria">
            {search || typeFilter !== "all"
              ? "Try adjusting your search terms or clearing active entity filters."
              : "No SEO records are currently stored in MySQL."}
          </EmptyState>
        )}
      </section>

      {/* =========================================================================
          SECTION 2: SEO CONFIGURATION EDITOR FORM
          ========================================================================= */}
      <div ref={editorRef} className="border-t-2 border-black/[.08] dark:border-white/[.08] pt-10">
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Configuration Studio</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-ink">Edit SEO Metadata</h2>
          <p className="mt-1 text-xs text-muted">
            Select an existing entity or use the directory table above to load and refine search parameters.
          </p>
        </div>

        <form onSubmit={save} className="max-w-4xl space-y-7">
          {/* Entity Type Selection Card */}
          <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-7 shadow-soft">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary mb-3">Entity Selection</p>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Entity Type"
                value={ownerType}
                onChange={(event) => setOwnerType(event.target.value as SeoOwnerType)}
              >
                <option value="page">Standard Page (Home, About, etc.)</option>
                <option value="post">Individual Blog Story</option>
                <option value="category">Category Hub</option>
                <option value="tag">Tag Archive</option>
              </SelectField>

              <SelectField
                label={ownerType === "page" ? "Select Page" : "Select Item"}
                value={ownerId}
                onChange={(event) => setOwnerId(event.target.value)}
                required
              >
                {selectedOwners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {"label" in owner ? owner.label : owner.title ?? owner.name ?? owner.slug ?? owner.id}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>

          {loading ? (
            <Loading label="Loading metadata..." />
          ) : (
            <>
              {/* Section 1: Basic SEO */}
              <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft space-y-5">
                <div className="border-b border-black/[.06] dark:border-white/[.06] pb-3">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Primary Directives</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-ink">Basic SEO</h3>
                  <p className="mt-1 text-xs text-muted">Core titles, descriptions, and canonical tags for search index engines.</p>
                </div>
                <Field
                  label="Meta Title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  placeholder="e.g. Fieldnotes — Thoughtful Writing & Modern Ideas"
                />
                <TextArea
                  label="Meta Description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={320}
                  placeholder="A concise description shown in search engine result snippets (max 320 characters)..."
                />
                <Field
                  label="Meta Keywords"
                  value={keywords}
                  onChange={(event) => setKeywords(event.target.value)}
                  maxLength={500}
                  placeholder="Comma-separated keywords (e.g. blog, tech, writing, design)"
                />
                <Field
                  label="Canonical URL"
                  type="url"
                  value={canonicalUrl}
                  onChange={(event) => setCanonicalUrl(event.target.value)}
                  maxLength={2048}
                  placeholder="https://example.com/blogs/your-canonical-slug"
                />
              </section>

              {/* Section 2: Open Graph */}
              <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft space-y-5">
                <div className="border-b border-black/[.06] dark:border-white/[.06] pb-3">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Social Graph Snippets</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-ink">Open Graph (Facebook / LinkedIn)</h3>
                  <p className="mt-1 text-xs text-muted">Metadata consumed when links are shared across modern communication channels.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Open Graph Title"
                    value={ogTitle}
                    onChange={(event) => setOgTitle(event.target.value)}
                    maxLength={200}
                    placeholder="Defaults to Meta Title if blank"
                  />
                  <Field
                    label="Open Graph Image URL"
                    type="url"
                    value={ogImageUrl}
                    onChange={(event) => setOgImageUrl(event.target.value)}
                    maxLength={2048}
                    placeholder="https://example.com/uploads/og-image.jpg"
                  />
                </div>
                <TextArea
                  label="Open Graph Description"
                  value={ogDescription}
                  onChange={(event) => setOgDescription(event.target.value)}
                  maxLength={320}
                  placeholder="Defaults to Meta Description if blank"
                />
              </section>

              {/* Section 3: Twitter Card */}
              <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft space-y-5">
                <div className="border-b border-black/[.06] dark:border-white/[.06] pb-3">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Microblogging Cards</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-ink">Twitter Card</h3>
                  <p className="mt-1 text-xs text-muted">Summary card specifications for X / Twitter posts.</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Twitter Card Title"
                    value={twitterTitle}
                    onChange={(event) => setTwitterTitle(event.target.value)}
                    maxLength={200}
                    placeholder="Defaults to Meta Title if blank"
                  />
                  <Field
                    label="Twitter Card Image URL"
                    type="url"
                    value={twitterImageUrl}
                    onChange={(event) => setTwitterImageUrl(event.target.value)}
                    maxLength={2048}
                    placeholder="https://example.com/uploads/twitter-card.jpg"
                  />
                </div>
                <TextArea
                  label="Twitter Card Description"
                  value={twitterDescription}
                  onChange={(event) => setTwitterDescription(event.target.value)}
                  maxLength={320}
                  placeholder="Defaults to Meta Description if blank"
                />
              </section>

              {/* Section 4: Robots Indexing Directives */}
              <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft">
                <div className="border-b border-black/[.06] dark:border-white/[.06] pb-3 mb-4">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Search Crawlers</p>
                  <h3 className="mt-1 font-display text-2xl font-bold text-ink">Robots Indexing</h3>
                </div>
                <div className="flex flex-wrap gap-6 pt-1">
                  <label className="flex items-center gap-3 text-sm font-semibold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={robotsIndex}
                      onChange={(e) => setRobotsIndex(e.target.checked)}
                      className="size-4 accent-moss rounded"
                    />
                    <span>Robots Index <span className="font-normal text-muted">(Allow search engines to index this content)</span></span>
                  </label>
                  <label className="flex items-center gap-3 text-sm font-semibold text-ink cursor-pointer">
                    <input
                      type="checkbox"
                      checked={robotsFollow}
                      onChange={(e) => setRobotsFollow(e.target.checked)}
                      className="size-4 accent-moss rounded"
                    />
                    <span>Robots Follow <span className="font-normal text-muted">(Allow search engines to follow page links)</span></span>
                  </label>
                </div>
              </section>

              <div className="pt-2">
                <Button type="submit" disabled={busy || !ownerId}>
                  {busy ? "Saving SEO Metadata..." : "Save SEO Metadata"}
                </Button>
              </div>
            </>
          )}
        </form>
      </div>
    </>
  );
}

interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "NEW" | "READ" | "RESOLVED";
  createdAt: string;
}

export function AdminContactsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const url = useMemo(
    () => `/admin/contacts?page=${page}&limit=20${status ? `&status=${status}` : ""}`,
    [page, status],
  );
  const { data, loading, error, refresh } = useAdminData<PageResult<ContactMessage>>(url);
  const contactsList: ContactMessage[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [actionError, setActionError] = useState<string | null>(null);

  async function updateStatus(message: ContactMessage, nextStatus: ContactMessage["status"]) {
    try {
      await api.patch(`/admin/contacts/${message.id}/status`, { status: nextStatus });
      refresh();
      if (selectedMessage && selectedMessage.id === message.id) {
        setSelectedMessage({ ...selectedMessage, status: nextStatus });
      }
      showToast({
        title: `Message marked as ${nextStatus.toLowerCase()}`,
        icon: "success",
      });
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Update Status", msg);
    }
  }

  return (
    <>
      <Seo title="Contact Inbox — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Reader Inquiries"
        title="Contact Inbox"
        description="Inspect, review, and process correspondence submitted via the public contact desk."
      />

      <div className="mb-6 max-w-xs">
        <SelectField
          label="Message status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All messages</option>
          <option value="NEW">New</option>
          <option value="READ">Read</option>
          <option value="RESOLVED">Resolved</option>
        </SelectField>
      </div>

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : contactsList.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-background/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-4">Sender</th>
                  <th className="px-6 py-4">Subject & Message</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.06] dark:divide-white/[.06]">
                {contactsList.map((message) => (
                  <tr key={message.id} className="hover:bg-paper/40 dark:hover:bg-surface/50 transition">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink">{message.name}</p>
                      <a
                        href={`mailto:${message.email}`}
                        className="text-xs text-muted hover:text-moss dark:hover:text-primary hover:underline"
                      >
                        {message.email}
                      </a>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-ink">{message.subject}</p>
                      <p className="mt-1 max-w-md line-clamp-1 text-xs text-muted">
                        {message.message}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted whitespace-nowrap font-sans">
                      {new Date(message.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill value={message.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedMessage(message)}
                        >
                          View
                        </Button>
                        {message.status === "NEW" && (
                          <Button
                            variant="secondary"
                            onClick={() => void updateStatus(message, "READ")}
                          >
                            Mark read
                          </Button>
                        )}
                        {message.status !== "RESOLVED" && (
                          <Button
                            onClick={() => void updateStatus(message, "RESOLVED")}
                          >
                            Resolve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 10}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="Your inbox is clear">
          New inquiries from the public website contact form will appear here.
        </EmptyState>
      )}

      {/* Selected Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-[30px] border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-7 shadow-soft sm:p-9">
            <div className="flex items-start justify-between border-b border-black/[.06] dark:border-white/[.06] pb-4 gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="font-display text-2xl font-bold text-ink">{selectedMessage.subject}</h3>
                  <StatusPill value={selectedMessage.status} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  From <strong className="text-ink">{selectedMessage.name}</strong> (
                  <a href={`mailto:${selectedMessage.email}`} className="text-moss dark:text-primary hover:underline">
                    {selectedMessage.email}
                  </a>
                  ) · {new Date(selectedMessage.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedMessage(null)}
                className="rounded-full p-2 text-muted hover:bg-paper dark:hover:bg-surface hover:text-ink transition"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="my-6 max-h-[50vh] overflow-y-auto rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface/50 p-5 text-sm leading-relaxed text-ink/90 whitespace-pre-wrap font-sans">
              {selectedMessage.message}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/[.06] dark:border-white/[.06] pt-4">
              <a
                href={`mailto:${selectedMessage.email}?subject=Re: ${encodeURIComponent(selectedMessage.subject)}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
              >
                Reply via Email
              </a>
              <div className="flex flex-wrap gap-2">
                {selectedMessage.status === "NEW" && (
                  <Button variant="secondary" onClick={() => void updateStatus(selectedMessage, "READ")}>
                    Mark as read
                  </Button>
                )}
                {selectedMessage.status !== "RESOLVED" && (
                  <Button onClick={() => void updateStatus(selectedMessage, "RESOLVED")}>
                    Resolve inquiry
                  </Button>
                )}
                {selectedMessage.status !== "NEW" && (
                  <Button variant="secondary" onClick={() => void updateStatus(selectedMessage, "NEW")}>
                    Mark as new
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setSelectedMessage(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface ImageRecord {
  id: string;
  fileName: string;
  originalFileName: string;
  path: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}

export function AdminImagesPage() {
  const [page, setPage] = useState(1);
  const { data, loading, error, refresh } = useAdminData<PageResult<ImageRecord>>(`/admin/images?page=${page}&limit=24`);
  const imagesList: ImageRecord[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<ImageRecord | null>(null);

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      await showError("File Too Large", "Image size exceeds the 10 MB limit.");
      return;
    }
    setUploading(true);
    setActionError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      await api.post("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      refresh();
      await showSuccess("Image Uploaded", `"${file.name}" was added to the media library.`);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Upload Failed", msg);
    } finally {
      setUploading(false);
    }
  }

  async function copyImageUrl(image: ImageRecord) {
    const fullUrl = imageUrl(image.path) || "";
    const absoluteUrl = fullUrl.startsWith("http") ? fullUrl : `${window.location.origin}${fullUrl}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      showToast({ title: "Asset URL copied to clipboard", icon: "success" });
    } catch {
      showToast({ title: "Copied URL: " + absoluteUrl, icon: "info" });
    }
  }

  async function remove(image: ImageRecord) {
    const confirmed = await confirmDestructive({
      title: "Delete Media Asset?",
      text: `Are you sure you want to delete "${image.originalFileName}"? If any posts link to this asset, their imagery will break.`,
      confirmText: "Delete Asset",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/admin/images/${image.id}`);
      refresh();
      if (previewImage?.id === image.id) setPreviewImage(null);
      await showSuccess("Asset Deleted", `"${image.originalFileName}" has been removed.`);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Delete Asset", msg);
    }
  }

  return (
    <>
      <Seo title="Media Library — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Asset Archive"
        title="Media Library"
        description="Inspect all uploaded image assets across story banners, editorial features, and member profiles."
        action={
          <div className="flex flex-col items-end gap-1">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-moss px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-ink">
              <Upload size={16} />
              <span>{uploading ? "Uploading..." : "Upload media"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
            <span className="text-[11px] font-medium text-muted">Supports JPEG, PNG, WebP (Max 10MB)</span>
          </div>
        }
      />

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={4} />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : imagesList.length > 0 ? (
        <>
          {/* 4-Column Desktop Grid with Quick Action Overlays */}
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {imagesList.map((image) => (
              <article
                key={image.id}
                className="group relative overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                onClick={() => setPreviewImage(image)}
              >
                <div className="relative aspect-square w-full overflow-hidden bg-paper dark:bg-background">
                  <img
                    src={imageUrl(image.path)}
                    alt={image.originalFileName}
                    className="size-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  {/* Action button overlay on hover */}
                  <div className="absolute inset-0 flex items-start justify-between p-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-gradient-to-b from-ink/70 via-transparent to-transparent">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void copyImageUrl(image);
                      }}
                      className="grid size-9 place-items-center rounded-full bg-surface/95 dark:bg-surface-elevated/95 text-ink shadow-md backdrop-blur-sm transition hover:bg-moss hover:text-white dark:hover:bg-primary dark:hover:text-[#171B19]"
                      title="Copy public URL"
                      aria-label="Copy public URL"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void remove(image);
                      }}
                      className="grid size-9 place-items-center rounded-full bg-surface/95 dark:bg-surface-elevated/95 text-red-700 dark:text-red-400 shadow-md backdrop-blur-sm transition hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white"
                      title="Delete image asset"
                      aria-label="Delete image asset"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="p-3.5">
                  <p className="truncate text-xs font-semibold text-ink" title={image.originalFileName}>
                    {image.originalFileName}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {(image.fileSize / 1024).toFixed(0)} KB · <span className="font-medium text-ink/75">{image.uploadedBy}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>

          {/* Lightbox / Asset Details Modal */}
          {previewImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
              onClick={() => setPreviewImage(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Image Asset Preview"
            >
              <div
                className="relative max-w-2xl w-full rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 shadow-2xl space-y-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-black/[.06] dark:border-white/[.06] pb-3">
                  <div className="min-w-0 pr-4">
                    <h3 className="font-display text-lg font-bold text-ink truncate">{previewImage.originalFileName}</h3>
                    <p className="text-xs text-muted">Uploaded by {previewImage.uploadedBy} · {(previewImage.fileSize / 1024).toFixed(1)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewImage(null)}
                    className="grid size-8 place-items-center rounded-full hover:bg-paper text-muted hover:text-ink transition"
                    aria-label="Close Preview"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-hidden rounded-2xl bg-paper dark:bg-background flex items-center justify-center">
                  <img
                    src={imageUrl(previewImage.path)}
                    alt={previewImage.originalFileName}
                    className="max-h-[55vh] max-w-full object-contain"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => void copyImageUrl(previewImage)}>
                      <Copy size={14} /> Copy URL
                    </Button>
                    <a
                      href={imageUrl(previewImage.path)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-black/10 dark:border-white/10 px-4 py-2 text-xs font-bold text-ink hover:bg-paper transition"
                    >
                      <ExternalLink size={14} /> Open Original
                    </a>
                  </div>
                  <Button variant="danger" onClick={() => void remove(previewImage)}>
                    <Trash2 size={14} /> Delete Asset
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(paginationData || data?.pagination) && (
            <Pagination
              page={paginationData?.page ?? data?.pagination?.page ?? 1}
              limit={paginationData?.limit ?? data?.pagination?.limit ?? 24}
              total={paginationData?.total ?? data?.pagination?.total ?? 0}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="Media library is empty">
          Uploaded story banners and article media will appear in this directory.
        </EmptyState>
      )}
    </>
  );
}

interface SettingRecord {
  key: string;
  value: string;
  updatedAt: string;
}

export function AdminSettingsPage() {
  const { data, loading, error, refresh } = useAdminData<SettingRecord[]>("/admin/settings");
  const [formError, setFormError] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const key = String(form.get("key"));
    try {
      await api.put(`/admin/settings/${encodeURIComponent(key)}`, {
        value: String(form.get("value")),
      });
      formElement.reset();
      refresh();
      setFormError(null);
      await showSuccess("Setting Stored", `Configuration parameter "${key}" was saved successfully.`);
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setFormError(msg);
      await showError("Failed to Save Setting", msg);
    }
  }

  return (
    <>
      <Seo title="Site Settings — Admin Portal" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        eyebrow="Application Configuration"
        title="Site Settings"
        description="Manage database-backed global variables, publication constants, and runtime flags."
      />

      <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
        {/* Form Card: Add or Update Setting */}
        <form
          onSubmit={save}
          className="h-fit space-y-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft"
        >
          <div className="border-b border-black/[.06] dark:border-white/[.06] pb-4">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Site Registry</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">Add or Update Setting</h2>
            <p className="mt-1 text-xs text-muted">Store configuration parameters accessible across the service.</p>
          </div>

          {formError && <Notice>{formError}</Notice>}

          <Field
            label="Setting Key"
            name="key"
            required
            pattern="[a-z][a-z0-9_]{1,99}"
            placeholder="e.g. site_title"
            className="font-mono text-sm"
          />
          <TextArea
            label="Value"
            name="value"
            required
            maxLength={10000}
            placeholder="Configuration value..."
            className="font-mono text-sm min-h-36"
          />

          <Button type="submit">
            <Check size={16} /> Save Setting
          </Button>

          <p className="text-xs leading-relaxed text-muted">
            Keys must begin with a lowercase letter and contain only alphanumeric characters and underscores.
          </p>
        </form>

        {/* Active Settings Registry Card */}
        <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-6 sm:p-8 shadow-soft">
          <div className="border-b border-black/[.06] dark:border-white/[.06] pb-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.18em] text-moss dark:text-primary">Configuration Pool</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Active Settings</h2>
            </div>
            {data && (
              <span className="rounded-full bg-paper dark:bg-surface px-3 py-1 text-xs font-bold text-muted border border-black/[.06] dark:border-white/[.06]">
                {data.length} entries
              </span>
            )}
          </div>

          {loading ? (
            <Loading />
          ) : error ? (
            <Notice>{error}</Notice>
          ) : data?.length ? (
            <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
              {data.map((setting) => (
                <article key={setting.key} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center rounded-lg bg-paper dark:bg-surface px-2.5 py-1 font-mono text-xs font-bold text-moss dark:text-primary border border-moss/10 dark:border-primary/20">
                      {setting.key}
                    </span>
                    <span className="text-[11px] text-muted font-sans">
                      Updated {new Date(setting.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-2.5 rounded-xl bg-paper/50 dark:bg-surface/50 p-3 border border-black/[.04] dark:border-white/[.04]">
                    <p className="font-mono text-xs whitespace-pre-wrap break-all text-ink/80 leading-relaxed">
                      {setting.value}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No settings defined">
              Configure your first application setting using the form on the left.
            </EmptyState>
          )}
        </section>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   NEWSLETTER MANAGEMENT (Phase 2C)
   ══════════════════════════════════════════════════════════════════════ */

export function AdminNewsletterPage() {
  const [stats, setStats] = useState<NewsletterStats>({ total: 0, active: 0, pending: 0, unsubscribed: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SUBSCRIBED" | "PENDING" | "UNSUBSCRIBED">("ALL");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await api.get<{ data: NewsletterStats }>("/admin/newsletter/stats");
      if (res.data?.data) {
        setStats(res.data.data);
      }
    } catch (err: any) {
      console.error("Failed to load newsletter stats", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchSubscribers = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: String(page),
        limit: "15",
        status: statusFilter,
      });
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const res = await api.get<{ data: NewsletterSubscriber[]; pagination: typeof pagination }>(
        `/admin/newsletter/subscribers?${params.toString()}`
      );
      setSubscribers(res.data.data || []);
      if (res.data.pagination) {
        setPagination(res.data.pagination);
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchSubscribers(1);
  }, [statusFilter, search]);

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearch("");
  };

  const handleDeleteSubscriber = async (sub: NewsletterSubscriber) => {
    const confirmed = await confirmDestructive({
      title: "Delete Subscriber",
      text: `Remove ${sub.email} from subscriber records? This action cannot be undone.`,
      confirmText: "Yes, Delete",
    });
    if (!confirmed) return;

    try {
      await api.delete(`/admin/newsletter/subscribers/${sub.id}`);
      showToast({ title: "Subscriber removed", icon: "success" });
      fetchStats();
      fetchSubscribers(pagination.page);
    } catch (err: any) {
      showError("Delete Failed", err);
    }
  };

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await api.get(`/admin/newsletter/export?status=${statusFilter}`, {
        responseType: "blob",
      });
      const blob = new Blob([res.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `newsletter_subscribers_${statusFilter.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast({ title: "CSV export downloaded", icon: "success" });
    } catch (err: any) {
      showError("Export Failed", "Failed to export subscribers CSV");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Seo title="Newsletter Subscribers — Admin" robotsIndex={false} robotsFollow={false} />
      <PageHeading
        title="Newsletter Management"
        description="Monitor newsletter audience metrics, verify subscription states, and manage subscriber records."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={exporting || subscribers.length === 0}
          >
            <Download size={15} />
            <span>{exporting ? "Exporting..." : "Export CSV"}</span>
          </Button>
        }
      />

      {/* 1. Overview Metric Cards */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 shadow-card">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Audience</p>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-ink">
            {statsLoading ? "..." : stats.total.toLocaleString()}
          </p>
          <span className="mt-1 block text-[11px] text-muted">Lifetime subscribers</span>
        </div>

        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Active (Subscribed)</p>
            <span className="size-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {statsLoading ? "..." : stats.active.toLocaleString()}
          </p>
          <span className="mt-1 block text-[11px] text-muted">Confirmed double opt-in</span>
        </div>

        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Pending Verification</p>
            <span className="size-2 rounded-full bg-amber-500" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {statsLoading ? "..." : stats.pending.toLocaleString()}
          </p>
          <span className="mt-1 block text-[11px] text-muted">Awaiting confirmation</span>
        </div>

        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Unsubscribed</p>
            <span className="size-2 rounded-full bg-slate-400" />
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-black text-muted">
            {statsLoading ? "..." : stats.unsubscribed.toLocaleString()}
          </p>
          <span className="mt-1 block text-[11px] text-muted">Opted out</span>
        </div>
      </div>

      {/* 2. Filter & Search Controls */}
      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-1.5 shadow-xs">
          {(["ALL", "SUBSCRIBED", "PENDING", "UNSUBSCRIBED"] as const).map((status) => {
            const isActive = statusFilter === status;
            const labels = {
              ALL: "All",
              SUBSCRIBED: "Active",
              PENDING: "Pending",
              UNSUBSCRIBED: "Unsubscribed",
            };
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                  isActive
                    ? "bg-moss dark:bg-primary text-white dark:text-[#171B19] shadow-sm"
                    : "text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5"
                }`}
              >
                {labels[status]}
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex items-center max-w-xs w-full">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email..."
            className="w-full rounded-2xl border border-black/10 dark:border-white/10 bg-surface px-4 py-2 pr-9 text-xs text-ink placeholder:text-muted focus:border-moss focus:outline-none focus:ring-1 focus:ring-moss dark:focus:border-primary dark:focus:ring-primary shadow-xs"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 text-muted hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : (
            <Search size={14} className="absolute right-2.5 text-muted pointer-events-none" />
          )}
        </form>
      </div>

      {/* 3. Subscribers Table */}
      <section className="mt-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card overflow-hidden">
        {loading ? (
          <div className="py-16">
            <Loading label="Loading subscribers..." />
          </div>
        ) : error ? (
          <div className="p-8">
            <Notice>{error}</Notice>
          </div>
        ) : subscribers.length === 0 ? (
          <div className="p-12 text-center">
            <EmptyState title="No subscribers found">
              {search
                ? `No subscribers matched the search term "${search}".`
                : statusFilter !== "ALL"
                ? `No subscribers currently in ${statusFilter.toLowerCase()} status.`
                : "Your newsletter audience will appear here once visitors subscribe."}
            </EmptyState>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/[.06] dark:border-white/[.06] bg-paper/40 dark:bg-surface-elevated/40 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-3.5 px-6">Email</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Subscribed At</th>
                  <th className="py-3.5 px-6">Joined</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
                {subscribers.map((sub) => {
                  return (
                    <tr key={sub.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6 font-medium text-ink">
                        <span className="font-mono">{sub.email}</span>
                      </td>
                      <td className="py-4 px-6">
                        {sub.status === "SUBSCRIBED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-bold text-[10px] text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        )}
                        {sub.status === "PENDING" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-bold text-[10px] text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <Clock size={10} />
                            Pending
                          </span>
                        )}
                        {sub.status === "UNSUBSCRIBED" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 font-bold text-[10px] text-slate-500 dark:text-slate-400 border border-slate-500/20">
                            <UserX size={10} />
                            Unsubscribed
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-muted">
                        {sub.subscribedAt
                          ? new Date(sub.subscribedAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="py-4 px-6 text-muted">
                        {new Date(sub.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSubscriber(sub)}
                          className="grid size-8 place-items-center rounded-xl text-muted hover:text-red-500 hover:bg-red-500/10 transition-all ml-auto"
                          aria-label={`Delete subscriber ${sub.email}`}
                          title="Delete subscriber record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-black/[.06] dark:border-white/[.06] flex items-center justify-between">
            <span className="text-xs text-muted">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} subscribers
            </span>
            <Pagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              onChange={(newPage) => fetchSubscribers(newPage)}
            />
          </div>
        )}
      </section>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   13. SEARCH ANALYTICS & ZERO-RESULT INTELLIGENCE (PHASE 3B)
   ══════════════════════════════════════════════════════════════════════ */

export function AdminSearchAnalyticsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [activeTab, setActiveTab] = useState<"top" | "zero" | "recent">("top");

  // Overview Data (KPIs, Trend, Top Lists)
  const [overview, setOverview] = useState<SearchAnalyticsOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Zero-Result Tab Data
  const [zeroResults, setZeroResults] = useState<TopZeroResultKeyword[]>([]);
  const [zeroPagination, setZeroPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [zeroSearch, setZeroSearch] = useState("");
  const [zeroSearchInput, setZeroSearchInput] = useState("");
  const [zeroLoading, setZeroLoading] = useState(false);

  // Recent Event Logs Tab Data
  const [recentLogs, setRecentLogs] = useState<SearchAnalyticsLogItem[]>([]);
  const [recentPagination, setRecentPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [recentHasResults, setRecentHasResults] = useState<"ALL" | "true" | "false">("ALL");
  const [recentSearch, setRecentSearch] = useState("");
  const [recentSearchInput, setRecentSearchInput] = useState("");
  const [recentLoading, setRecentLoading] = useState(false);

  const fetchOverview = async () => {
    try {
      setOverviewLoading(true);
      setOverviewError(null);
      const params = new URLSearchParams({ period });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);

      const res = await api.get<{ data: SearchAnalyticsOverview }>(
        `/admin/search-analytics/overview?${params.toString()}`
      );
      if (res.data?.data) {
        setOverview(res.data.data);
      }
    } catch (err: any) {
      setOverviewError(getErrorMessage(err));
    } finally {
      setOverviewLoading(false);
    }
  };

  const fetchZeroResults = async (page = 1) => {
    try {
      setZeroLoading(true);
      const params = new URLSearchParams({
        period,
        page: String(page),
        limit: "10",
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (zeroSearch.trim()) params.set("search", zeroSearch.trim());

      const res = await api.get<{ data: TopZeroResultKeyword[]; pagination: typeof zeroPagination }>(
        `/admin/search-analytics/zero-results?${params.toString()}`
      );
      setZeroResults(res.data.data || []);
      if (res.data.pagination) setZeroPagination(res.data.pagination);
    } catch (err: any) {
      console.error("Failed to load zero results report", err);
    } finally {
      setZeroLoading(false);
    }
  };

  const fetchRecentLogs = async (page = 1) => {
    try {
      setRecentLoading(true);
      const params = new URLSearchParams({
        period,
        page: String(page),
        limit: "15",
        hasResults: recentHasResults,
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (recentSearch.trim()) params.set("search", recentSearch.trim());

      const res = await api.get<{ data: SearchAnalyticsLogItem[]; pagination: typeof recentPagination }>(
        `/admin/search-analytics/recent?${params.toString()}`
      );
      setRecentLogs(res.data.data || []);
      if (res.data.pagination) setRecentPagination(res.data.pagination);
    } catch (err: any) {
      console.error("Failed to load recent search logs", err);
    } finally {
      setRecentLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [period, startDate, endDate]);

  useEffect(() => {
    if (activeTab === "zero") {
      fetchZeroResults(1);
    } else if (activeTab === "recent") {
      fetchRecentLogs(1);
    }
  }, [activeTab, period, startDate, endDate, zeroSearch, recentHasResults, recentSearch]);

  const handlePruneLogs = async () => {
    const confirmed = await confirmDestructive({
      title: "Prune Historical Search Logs",
      text: "Remove search analytics records older than 90 days? Aggregate insights will be recalculated.",
      confirmText: "Yes, Prune Old Logs",
    });
    if (!confirmed) return;

    try {
      const res = await api.delete<{ data: { deletedCount: number } }>("/admin/search-analytics/prune?olderThanDays=90");
      showToast({
        title: `Pruned ${res.data?.data?.deletedCount ?? 0} historical search logs.`,
        icon: "success",
      });
      fetchOverview();
      if (activeTab === "zero") fetchZeroResults(1);
      if (activeTab === "recent") fetchRecentLogs(1);
    } catch (err: any) {
      showError("Prune Failed", getErrorMessage(err));
    }
  };

  // Find max activity value for bar chart normalization
  const maxTrendValue = useMemo(() => {
    if (!overview?.activityTrend || overview.activityTrend.length === 0) return 10;
    const peak = Math.max(...overview.activityTrend.map((t) => t.total));
    return peak > 0 ? peak : 10;
  }, [overview?.activityTrend]);

  return (
    <>
      <Seo title="Search Analytics & Insights — Admin" robotsIndex={false} robotsFollow={false} />

      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary mb-1">
            <BarChart3 size={14} />
            <span>Search Intelligence</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-ink">
            Search Analytics &amp; Trends
          </h1>
          <p className="mt-1 text-xs text-muted max-w-2xl leading-relaxed">
            Privacy-conscious intelligence on reader search queries, high-demand topics, and zero-result content opportunities.
          </p>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              fetchOverview();
              if (activeTab === "zero") fetchZeroResults(zeroPagination.page);
              if (activeTab === "recent") fetchRecentLogs(recentPagination.page);
            }}
            className="!h-9 !px-3 text-xs flex items-center gap-1.5"
            title="Refresh search analytics"
          >
            <RefreshCw size={13} className={overviewLoading ? "animate-spin text-moss dark:text-primary" : ""} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="ghost"
            onClick={handlePruneLogs}
            className="!h-9 !px-3 text-xs text-muted hover:text-red-500 hover:bg-red-500/10 transition"
            title="Prune logs older than 90 days"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Prune Logs</span>
          </Button>
        </div>
      </div>

      {overviewError && (
        <div className="mt-4">
          <Notice>{overviewError}</Notice>
        </div>
      )}

      {/* Date Range & Period Filter Bar */}
      <section className="mt-6 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Quick Period Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted mr-1.5">
              Period:
            </span>
            {(
              [
                { id: "7d", label: "Last 7 Days" },
                { id: "30d", label: "Last 30 Days" },
                { id: "90d", label: "Last 90 Days" },
                { id: "all", label: "All Time" },
              ] as const
            ).map((p) => {
              const isActive = period === p.id && !startDate && !endDate;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPeriod(p.id);
                    setStartDate("");
                    setEndDate("");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                    isActive
                      ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                      : "bg-paper dark:bg-surface-elevated text-muted hover:text-ink hover:border-moss/30 border border-black/[.06] dark:border-white/[.06]"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Custom Range:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-moss"
              placeholder="From"
              aria-label="Start date filter"
            />
            <span className="text-muted">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated px-2.5 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-moss"
              placeholder="To"
              aria-label="End date filter"
            />
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="text-xs text-muted hover:text-red-500 underline ml-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Core Summary KPI Metrics */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* Total Searches */}
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Searches</span>
            <span className="grid size-7 place-items-center rounded-lg bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary">
              <Search size={14} />
            </span>
          </div>
          <div className="font-display text-2xl sm:text-3xl font-black text-ink">
            {overviewLoading ? "..." : (overview?.summary.totalSearches ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted">Recorded user queries</p>
        </div>

        {/* Unique Terms */}
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unique Keywords</span>
            <span className="grid size-7 place-items-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Sparkles size={14} />
            </span>
          </div>
          <div className="font-display text-2xl sm:text-3xl font-black text-ink">
            {overviewLoading ? "..." : (overview?.summary.uniqueTerms ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted">Distinct search terms</p>
        </div>

        {/* Zero-Result Searches */}
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Zero Results</span>
            <span className="grid size-7 place-items-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle size={14} />
            </span>
          </div>
          <div className="font-display text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {overviewLoading ? "..." : (overview?.summary.zeroResultSearches ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted">No content found</p>
        </div>

        {/* Zero-Result Rate */}
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 sm:p-5 shadow-card">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Zero-Result Rate</span>
            <span className="grid size-7 place-items-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <TrendingDown size={14} />
            </span>
          </div>
          <div className="font-display text-2xl sm:text-3xl font-black text-ink">
            {overviewLoading ? "..." : `${overview?.summary.zeroResultRate ?? 0}%`}
          </div>
          <p className="mt-1 text-[11px] text-muted">Opportunity ratio</p>
        </div>

        {/* Successful Searches */}
        <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-4 sm:p-5 shadow-card col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-muted mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">With Results</span>
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} />
            </span>
          </div>
          <div className="font-display text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {overviewLoading ? "..." : (overview?.summary.successfulSearches ?? 0).toLocaleString()}
          </div>
          <p className="mt-1 text-[11px] text-muted">Stories matched</p>
        </div>
      </div>

      {/* Search Activity Trend Interactive Visualizer */}
      <section className="mt-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-black/[.06] dark:border-white/[.06] pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-ink">Search Volume Activity Timeline</h2>
            <p className="text-xs text-muted">Daily reader search frequency across selected timeframe</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-muted">
              <span className="size-2.5 rounded-full bg-moss dark:bg-primary" /> Total Searches
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-muted">
              <span className="size-2.5 rounded-full bg-amber-500" /> Zero Results
            </span>
          </div>
        </div>

        {overviewLoading ? (
          <div className="py-12 flex justify-center"><Loading label="Rendering activity trend..." /></div>
        ) : !overview?.activityTrend || overview.activityTrend.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted">
            No search activity recorded in this period.
          </div>
        ) : (
          <div className="pt-2">
            {/* Visual Bar Chart */}
            <div className="flex items-end gap-2 h-44 overflow-x-auto pb-6 pt-2 no-scrollbar">
              {overview.activityTrend.map((point) => {
                const totalHeightPercent = Math.max(8, Math.round((point.total / maxTrendValue) * 100));
                const zeroHeightPercent = point.total > 0
                  ? Math.round((point.zeroResults / point.total) * 100)
                  : 0;

                return (
                  <div
                    key={point.date}
                    className="group relative flex flex-col items-center flex-1 min-w-[28px] max-w-[48px] h-full justify-end"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-12 z-20 hidden group-hover:flex flex-col items-center rounded-lg bg-ink text-paper px-2 py-1 text-[10px] whitespace-nowrap shadow-lg">
                      <span className="font-bold">{point.date}</span>
                      <span>{point.total} total ({point.zeroResults} zero)</span>
                    </div>

                    {/* Bar Track */}
                    <div
                      className="w-full rounded-t-lg bg-moss/80 dark:bg-primary/80 transition-all hover:opacity-90 relative overflow-hidden flex flex-col justify-end"
                      style={{ height: `${totalHeightPercent}%` }}
                    >
                      {/* Zero-result top overlay if any */}
                      {point.zeroResults > 0 && (
                        <div
                          className="w-full bg-amber-500/90 transition-all"
                          style={{ height: `${zeroHeightPercent}%` }}
                          title={`${point.zeroResults} zero-result searches`}
                        />
                      )}
                    </div>

                    {/* Date Label */}
                    <span className="absolute -bottom-5 text-[9px] font-mono text-muted truncate max-w-[36px]">
                      {point.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Main Tabs Navigation */}
      <div className="mt-8 border-b border-black/[.08] dark:border-white/[.08] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("top")}
          className={`pb-3 text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "top"
              ? "border-moss text-moss dark:border-primary dark:text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Sparkles size={15} />
          <span>Top Searched Keywords</span>
          {overview?.topKeywords && (
            <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px]">
              {overview.topKeywords.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("zero")}
          className={`pb-3 text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "zero"
              ? "border-amber-500 text-amber-600 dark:text-amber-400"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <AlertCircle size={15} />
          <span>Missing Content Gaps (Zero-Result Report)</span>
          {overview?.summary.zeroResultSearches !== undefined && overview.summary.zeroResultSearches > 0 && (
            <span className="rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold">
              {overview.summary.zeroResultSearches}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("recent")}
          className={`pb-3 text-xs sm:text-sm font-bold transition flex items-center gap-2 border-b-2 ${
            activeTab === "recent"
              ? "border-moss text-moss dark:border-primary dark:text-primary"
              : "border-transparent text-muted hover:text-ink"
          }`}
        >
          <Clock size={15} />
          <span>Live Search Stream</span>
        </button>
      </div>

      {/* TAB 1: TOP SEARCH KEYWORDS */}
      {activeTab === "top" && (
        <section className="mt-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card overflow-hidden">
          <div className="p-5 border-b border-black/[.06] dark:border-white/[.06] flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-ink">Most Searched Keywords</h3>
              <p className="text-xs text-muted">High-intent topics readers are searching for</p>
            </div>
            <span className="text-xs font-semibold text-muted">Ranked by volume</span>
          </div>

          {overviewLoading ? (
            <div className="py-12 flex justify-center"><Loading label="Loading top keywords..." /></div>
          ) : !overview?.topKeywords || overview.topKeywords.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No search keywords recorded yet in this period.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[.08] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.02] text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-5 w-12 text-center">#</th>
                    <th className="py-3 px-5">Search Query</th>
                    <th className="py-3 px-5">Search Volume</th>
                    <th className="py-3 px-5">Zero Results</th>
                    <th className="py-3 px-5">Last Searched</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
                  {overview.topKeywords.map((kw, idx) => (
                    <tr key={kw.normalizedQuery} className="hover:bg-black/[.015] dark:hover:bg-white/[.015] transition">
                      <td className="py-3.5 px-5 text-center font-mono font-bold text-muted">
                        {idx + 1}
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-ink font-display text-sm">{kw.term}</span>
                        <span className="block font-mono text-[10px] text-muted">normalized: {kw.normalizedQuery}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-moss/10 dark:bg-primary/20 px-2.5 py-0.5 font-bold text-moss dark:text-primary">
                          {kw.searchCount.toLocaleString()} {kw.searchCount === 1 ? "search" : "searches"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5">
                        {kw.zeroResultsCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                            {kw.zeroResultsCount} ({Math.round((kw.zeroResultsCount / kw.searchCount) * 100)}%)
                          </span>
                        ) : (
                          <span className="text-muted text-[11px]">0 (100% found)</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-muted text-[11px]">
                        {new Date(kw.lastSearchedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/blogs?search=${encodeURIComponent(kw.term)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-moss dark:text-primary hover:underline"
                        >
                          <span>View Results</span>
                          <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: ZERO-RESULT OPPORTUNITIES (CONTENT GAPS REPORT) */}
      {activeTab === "zero" && (
        <section className="mt-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card overflow-hidden">
          <div className="p-5 border-b border-black/[.06] dark:border-white/[.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-base font-bold text-amber-600 dark:text-amber-400">
                  Zero-Result Content Gaps
                </h3>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  Missing Stories
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Topics readers searched for that returned zero articles — write new stories to capture this audience.
              </p>
            </div>

            {/* Search inside zero results */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setZeroSearch(zeroSearchInput);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={zeroSearchInput}
                  onChange={(e) => setZeroSearchInput(e.target.value)}
                  placeholder="Filter zero-result terms..."
                  className="rounded-full border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated pl-8 pr-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-amber-500 w-52"
                />
              </div>
              <Button type="submit" variant="secondary" className="!h-8 !px-3 text-xs">
                Filter
              </Button>
            </form>
          </div>

          {zeroLoading ? (
            <div className="py-12 flex justify-center"><Loading label="Compiling zero-result opportunities..." /></div>
          ) : zeroResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              {zeroSearch ? `No zero-result searches match "${zeroSearch}".` : "No zero-result searches recorded for this period."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[.08] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.02] text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-5">Missing Topic Query</th>
                    <th className="py-3 px-5">Search Occurrences</th>
                    <th className="py-3 px-5">Category Scoped</th>
                    <th className="py-3 px-5">Last Attempted</th>
                    <th className="py-3 px-5 text-right">Opportunity Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
                  {zeroResults.map((item) => (
                    <tr key={item.normalizedQuery} className="hover:bg-black/[.015] dark:hover:bg-white/[.015] transition">
                      <td className="py-3.5 px-5">
                        <span className="font-bold text-ink font-display text-sm">
                          {item.term || (item as any).originalQuery || item.normalizedQuery}
                        </span>
                        <span className="block font-mono text-[10px] text-muted">query: {item.normalizedQuery}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 font-bold text-amber-700 dark:text-amber-300">
                          {(item.occurrences ?? (item as any).count ?? 0).toLocaleString()}{" "}
                          {(item.occurrences ?? (item as any).count ?? 0) === 1 ? "time" : "times"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-muted">
                        {item.lastCategory ? (
                          <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                            {item.lastCategory}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">All Categories</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-muted text-[11px]">
                        {new Date(item.lastSearchedAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/admin/posts/new`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-moss/10 dark:bg-primary/20 hover:bg-moss/20 px-3 py-1 text-xs font-bold text-moss dark:text-primary transition"
                          title="Open editor to create a story on this topic"
                        >
                          <Plus size={13} />
                          <span>Write Story</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Zero Results Pagination */}
          {zeroPagination.totalPages > 1 && (
            <div className="p-4 border-t border-black/[.06] dark:border-white/[.06] flex items-center justify-between">
              <span className="text-xs text-muted">
                Showing {((zeroPagination.page - 1) * zeroPagination.limit) + 1} to {Math.min(zeroPagination.page * zeroPagination.limit, zeroPagination.total)} of {zeroPagination.total} content gaps
              </span>
              <Pagination
                page={zeroPagination.page}
                limit={zeroPagination.limit}
                total={zeroPagination.total}
                onChange={(newPage) => fetchZeroResults(newPage)}
              />
            </div>
          )}
        </section>
      )}

      {/* TAB 3: REAL-TIME SEARCH STREAM AUDIT */}
      {activeTab === "recent" && (
        <section className="mt-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card overflow-hidden">
          <div className="p-5 border-b border-black/[.06] dark:border-white/[.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-display text-base font-bold text-ink">Recent Search Events</h3>
              <p className="text-xs text-muted">Chronological search query event stream</p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={recentHasResults}
                onChange={(e) => setRecentHasResults(e.target.value as any)}
                className="rounded-xl border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-moss"
              >
                <option value="ALL">All Outcomes</option>
                <option value="true">With Results</option>
                <option value="false">Zero Results</option>
              </select>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setRecentSearch(recentSearchInput);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={recentSearchInput}
                  onChange={(e) => setRecentSearchInput(e.target.value)}
                  placeholder="Filter query..."
                  className="rounded-full border border-black/10 dark:border-white/10 bg-paper dark:bg-surface-elevated px-3 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-moss w-40"
                />
                <Button type="submit" variant="secondary" className="!h-8 !px-3 text-xs">
                  Filter
                </Button>
              </form>
            </div>
          </div>

          {recentLoading ? (
            <div className="py-12 flex justify-center"><Loading label="Loading search event stream..." /></div>
          ) : recentLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted">
              No recent search logs match the criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-black/[.08] dark:border-white/[.08] bg-black/[.02] dark:bg-white/[.02] text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="py-3 px-5">Query String</th>
                    <th className="py-3 px-5">Category Scoped</th>
                    <th className="py-3 px-5">Results Count</th>
                    <th className="py-3 px-5">Outcome Status</th>
                    <th className="py-3 px-5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[.04] dark:divide-white/[.04]">
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-black/[.015] dark:hover:bg-white/[.015] transition">
                      <td className="py-3 px-5">
                        <span className="font-bold text-ink">{log.searchQuery}</span>
                      </td>
                      <td className="py-3 px-5 text-muted">
                        {log.categoryScope ? (
                          <span className="rounded-full bg-black/5 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                            {log.categoryScope}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted">Global</span>
                        )}
                      </td>
                      <td className="py-3 px-5 font-mono text-xs font-semibold">
                        {log.resultsCount}
                      </td>
                      <td className="py-3 px-5">
                        {log.hasResults ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={11} />
                            <span>Matched</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            <AlertCircle size={11} />
                            <span>Zero Results</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-right text-muted text-[11px]">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Stream Pagination */}
          {recentPagination.totalPages > 1 && (
            <div className="p-4 border-t border-black/[.06] dark:border-white/[.06] flex items-center justify-between">
              <span className="text-xs text-muted">
                Showing {((recentPagination.page - 1) * recentPagination.limit) + 1} to {Math.min(recentPagination.page * recentPagination.limit, recentPagination.total)} of {recentPagination.total} logs
              </span>
              <Pagination
                page={recentPagination.page}
                limit={recentPagination.limit}
                total={recentPagination.total}
                onChange={(newPage) => fetchRecentLogs(newPage)}
              />
            </div>
          )}
        </section>
      )}
    </>
  );
}
