import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  FilePlus2,
  Files,
  Heart,
  KeyRound,
  MessageSquareText,
  Pencil,
  PenLine,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  Button,
  EmptyState,
  Field,
  Notice,
  PageHeading,
  Pagination,
  SelectField,
  SkeletonBox,
  TextArea,
} from "../components/UI";
import { Seo } from "../components/Seo";
import { api, getErrorMessage, imageUrl } from "../lib/api";
import { confirmAction, confirmDestructive, showError, showSuccess, showToast, showWarning } from "../lib/alerts";
import type { PageResult, Taxonomy } from "../types";

/* ══════════════════════════════════════════════════════════════════════
   TYPES & SHARED DATA HOOK
   ══════════════════════════════════════════════════════════════════════ */

interface UserPost {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
  excerpt: string | null;
  rejectionReason: string | null;
  category: string;
  categoryName?: string;
  featuredImagePath: string | null;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  tags?: Taxonomy[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

interface PostOptions {
  categories: Taxonomy[];
  tags: Taxonomy[];
}

interface ExistingPost extends UserPost {
  content: string;
  categoryId: string;
  featuredImageId: string | null;
  tags: Taxonomy[];
  isFeatured?: boolean;
  featuredOrder?: number;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
}

function useRemote<T>(url: string, autoRefreshMs = 60000) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const result = await api.get<any>(url);
      const resBody = result.data;
      if (resBody && typeof resBody === "object" && Array.isArray(resBody.data) && "pagination" in resBody) {
        setData(resBody as unknown as T);
      } else if (resBody && typeof resBody === "object" && "data" in resBody) {
        setData(resBody.data as T);
      } else {
        setData(resBody as unknown as T);
      }
      setError(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [url]);

  useEffect(() => {
    if (!autoRefreshMs) return;
    const intervalId = setInterval(() => {
      void reload();
    }, autoRefreshMs);
    return () => clearInterval(intervalId);
  }, [autoRefreshMs, url]);

  return { data, loading, error, reload };
}

/* ══════════════════════════════════════════════════════════════════════
   STATUS BADGE COMPONENT (THEME AWARE)
   ══════════════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
        <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
        Published
      </span>
    );
  }
  if (status === "PENDING") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
        <span className="size-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
        Pending Review
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 dark:bg-red-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-red-800 dark:text-red-300">
        <span className="size-1.5 rounded-full bg-red-600 dark:bg-red-400" />
        Needs Revision
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted">
      <span className="size-1.5 rounded-full bg-muted" />
      Draft
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   1. USER DASHBOARD PAGE & SKELETON
   ══════════════════════════════════════════════════════════════════════ */

function UserDashboardSkeleton() {
  return (
    <div className="space-y-10 sm:space-y-12">
      {/* Header Banner Skeleton */}
      <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-10 shadow-card">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl space-y-3">
            <SkeletonBox className="h-5 w-36" />
            <SkeletonBox className="h-10 w-72 sm:w-96" />
            <SkeletonBox className="h-4 w-full sm:w-80" />
          </div>
          <div className="flex gap-3">
            <SkeletonBox className="h-10 w-36" />
            <SkeletonBox className="h-10 w-32" />
          </div>
        </div>
      </div>

      {/* Metrics Grid Skeleton */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <SkeletonBox className="h-4 w-40" />
          <SkeletonBox className="h-4 w-28" />
        </div>
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card space-y-4"
            >
              <div className="flex items-center justify-between">
                <SkeletonBox className="h-4 w-24" />
                <SkeletonBox className="size-10 rounded-2xl" />
              </div>
              <SkeletonBox className="h-10 w-20" />
              <SkeletonBox className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions Skeleton */}
      <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-9 space-y-6">
        <div className="flex items-center justify-between border-b border-black/[.08] dark:border-white/[.08] pb-5">
          <div className="space-y-2">
            <SkeletonBox className="h-3 w-28" />
            <SkeletonBox className="h-7 w-48" />
          </div>
          <SkeletonBox className="h-4 w-24" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-black/[.04] dark:border-white/[.04]">
              <div className="space-y-2 flex-1 max-w-md">
                <SkeletonBox className="h-3 w-32" />
                <SkeletonBox className="h-5 w-64" />
              </div>
              <div className="flex gap-2">
                <SkeletonBox className="h-7 w-20 rounded-full" />
                <SkeletonBox className="h-7 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error } = useRemote<{ stats: Record<string, number>; recentPosts: UserPost[] }>("/user/dashboard");

  if (loading) return <UserDashboardSkeleton />;
  if (error || !data) return <Notice>{error ?? "Could not load your workspace."}</Notice>;

  const stats = [
    {
      label: "Total Stories",
      value: data.stats.totalPosts,
      note: "Drafts, pending & published manuscripts",
      icon: Files,
      accent: "text-moss dark:text-primary",
      bg: "bg-moss/10 dark:bg-primary/20",
      border: "border-l-4 border-l-moss dark:border-l-primary",
    },
    {
      label: "Published Live",
      value: data.stats.publishedPosts,
      note: "Live and readable in the journal",
      icon: CheckCircle2,
      accent: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      border: "border-l-4 border-l-emerald-500",
    },
    {
      label: "Under Review",
      value: data.stats.pendingPosts,
      note: "Awaiting editorial board evaluation",
      icon: Clock,
      accent: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      border: "border-l-4 border-l-amber-500",
    },
    {
      label: "Needs Revision",
      value: data.stats.rejectedPosts,
      note: "Feedback provided by editorial staff",
      icon: AlertCircle,
      accent: "text-red-700 dark:text-red-400",
      bg: "bg-red-500/10 dark:bg-red-500/20",
      border: "border-l-4 border-l-rose-500",
    },
    {
      label: "Appreciations",
      value: data.stats.receivedLikes,
      note: "Reader hearts across all stories",
      icon: Heart,
      accent: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10 dark:bg-rose-500/20",
      border: "border-l-4 border-l-rose-400",
    },
    {
      label: "Discussions",
      value: data.stats.receivedComments ?? 0,
      note: "Reader responses and letters",
      icon: MessageSquareText,
      accent: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      border: "border-l-4 border-l-indigo-500",
    },
  ];

  return (
    <div className="space-y-10 sm:space-y-12">
      <Seo title="Creator Desk — Author Workspace" robotsIndex={false} robotsFollow={false} />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-10 shadow-card">
        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 dark:bg-accent/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
                <BookOpen size={13} /> Author Workspace
              </span>
              <span className="text-xs text-muted">· Edition 2026</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl leading-tight">
              Welcome back{user?.username ? `, ${user.username}` : ""}.
            </h1>
            <p className="mt-2.5 text-sm sm:text-base text-muted font-normal leading-relaxed">
              Track reader engagement, review editorial responses, and craft thoughtful articles for the Fieldnotes readership.
            </p>
          </div>
          <div className="flex shrink-0 flex-col sm:flex-row gap-3">
            <Link
              to="/dashboard/posts/new"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-moss px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90 w-full sm:w-auto"
            >
              <PenLine size={15} />
              <span>Write a new story</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-surface px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated w-full sm:w-auto"
            >
              <ExternalLink size={14} />
              <span>View Journal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Publishing Metrics Grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted">Publishing Metrics</p>
          <span className="text-xs text-muted">All-time performance</span>
        </div>
        <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map(({ label, value, note, icon: Icon, accent, bg, border }) => (
            <div
              key={label}
              className={`group relative overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-moss/40 dark:hover:border-primary/40 ${border}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
                <span className={`grid size-10 place-items-center rounded-2xl ${bg} ${accent} transition-transform group-hover:scale-110`}>
                  <Icon size={18} />
                </span>
              </div>
              <p className="mt-4 font-display text-4xl sm:text-5xl font-bold text-ink tracking-tight">
                {Number(value ?? 0).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-muted leading-relaxed">{note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Submissions Section */}
      <section className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-9">
        <div className="mb-6 flex flex-col gap-2 border-b border-black/[.08] dark:border-white/[.08] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Recent Submissions</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Your latest stories</h2>
          </div>
          <Link
            to="/dashboard/posts"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:underline"
          >
            All stories <ArrowRight size={14} />
          </Link>
        </div>

        {data.recentPosts.length ? (
          <div className="divide-y divide-black/[.06] dark:divide-white/[.06]">
            {data.recentPosts.map((post) => (
              <div
                key={post.id}
                className="group flex flex-col gap-4 py-4 transition hover:bg-paper/40 dark:hover:bg-surface-elevated/40 px-3 rounded-2xl sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4 min-w-0 pr-4">
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-surface-elevated">
                    {post.featuredImagePath ? (
                      <img
                        src={imageUrl(post.featuredImagePath)}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="grid size-full place-items-center bg-moss/5 text-muted">
                        <BookOpen size={16} className="text-moss/40 dark:text-primary/40" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-semibold text-moss dark:text-primary uppercase tracking-wider text-[10px]">
                        {post.categoryName || post.category || "Story"}
                      </span>
                      <span>·</span>
                      <span>Updated {new Date(post.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <Link
                      to={`/dashboard/posts/${post.id}/edit`}
                      className="mt-0.5 block font-display text-base sm:text-lg font-bold text-ink transition hover:text-moss dark:hover:text-primary line-clamp-1"
                    >
                      {post.title}
                    </Link>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  <StatusBadge status={post.status} />
                  {post.status === "APPROVED" && (
                    <Link
                      to={`/blogs/${post.slug}`}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
                      title="View story in public journal"
                    >
                      <Eye size={12} />
                      <span className="hidden sm:inline">View</span>
                    </Link>
                  )}
                  <Link
                    to={`/dashboard/posts/${post.id}/edit`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
                  >
                    <Pencil size={12} />
                    <span>Edit</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Your first story starts here">
            Draft a captivating article, attach imagery, and submit it for editorial review whenever you are ready.
          </EmptyState>
        )}
      </section>

      {/* Editorial Workflow & Quality Standards Callout */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface-elevated/40 p-5">
          <span className="grid size-8 place-items-center rounded-xl bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary font-bold text-xs">
            01
          </span>
          <h3 className="mt-3 font-display text-base font-bold text-ink">Draft & Structure</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Write your manuscript with thoughtful sections, excerpts, and rich featured photography.
          </p>
        </div>
        <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface-elevated/40 p-5">
          <span className="grid size-8 place-items-center rounded-xl bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary font-bold text-xs">
            02
          </span>
          <h3 className="mt-3 font-display text-base font-bold text-ink">Editorial Review</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Submit your manuscript to the editorial board for review and quality evaluation.
          </p>
        </div>
        <div className="rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface-elevated/40 p-5">
          <span className="grid size-8 place-items-center rounded-xl bg-moss/10 dark:bg-primary/20 text-moss dark:text-primary font-bold text-xs">
            03
          </span>
          <h3 className="mt-3 font-display text-base font-bold text-ink">Publication & Reach</h3>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            Once approved, your article goes live across the journal and reader archives.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   2. MY POSTS LISTING PAGE & SKELETON
   ══════════════════════════════════════════════════════════════════════ */

function UserPostsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 sm:p-6 shadow-card sm:flex-row sm:items-start"
        >
          <SkeletonBox className="aspect-[16/10] sm:aspect-square w-full sm:w-36 shrink-0 rounded-2xl" />
          <div className="flex flex-1 flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <SkeletonBox className="h-4 w-24 rounded-full" />
                <SkeletonBox className="h-5 w-20 rounded-full" />
              </div>
              <SkeletonBox className="h-6 w-3/4" />
              <SkeletonBox className="h-4 w-full" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-black/[.06] dark:border-white/[.06]">
              <SkeletonBox className="h-4 w-40" />
              <div className="flex gap-2">
                <SkeletonBox className="h-8 w-16 rounded-full" />
                <SkeletonBox className="h-8 w-24 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostListPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const url = useMemo(
    () => `/user/posts?page=${page}&limit=10${status ? `&status=${status}` : ""}`,
    [page, status],
  );
  const { data, loading, error, reload } = useRemote<PageResult<UserPost>>(url);
  const [actionError, setActionError] = useState<string | null>(null);

  async function submitPost(id: string) {
    const confirmed = await confirmAction({
      title: "Submit for Editorial Review?",
      text: "Your manuscript will be submitted to our editors for publication review. You will not be able to delete it while under review.",
      confirmText: "Submit Story",
      icon: "question",
    });
    if (!confirmed) return;
    try {
      await api.post(`/user/posts/${id}/submit`);
      await reload();
      await showSuccess("Submitted for Review", "Your story has been forwarded to the editorial board.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Submission Failed", msg);
    }
  }

  async function deletePost(id: string) {
    const confirmed = await confirmDestructive({
      title: "Delete Story Draft?",
      text: "Are you sure you want to delete this story? This action cannot be undone.",
      confirmText: "Delete Draft",
    });
    if (!confirmed) return;
    try {
      await api.delete(`/user/posts/${id}`);
      await reload();
      await showSuccess("Draft Deleted", "Your draft was deleted successfully.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setActionError(msg);
      await showError("Failed to Delete Story", msg);
    }
  }

  const rawPosts: UserPost[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;

  // Filter posts on current page by search term if provided
  const displayedPosts = useMemo(() => {
    if (!rawPosts.length) return [];
    if (!searchTerm.trim()) return rawPosts;
    const term = searchTerm.toLowerCase();
    return rawPosts.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        (p.excerpt && p.excerpt.toLowerCase().includes(term)) ||
        (p.categoryName && p.categoryName.toLowerCase().includes(term)),
    );
  }, [rawPosts, searchTerm]);

  const filterTabs = [
    { label: "All Stories", value: "" },
    { label: "Published", value: "APPROVED" },
    { label: "Pending Review", value: "PENDING" },
    { label: "Drafts", value: "DRAFT" },
    { label: "Needs Revision", value: "REJECTED" },
  ];

  return (
    <div className="space-y-8">
      <Seo title="My Stories — Creator Workspace" robotsIndex={false} robotsFollow={false} />

      {/* Page Heading */}
      <PageHeading
        eyebrow="Your Writing"
        title="My Stories"
        description="Draft, submit, and keep track of all your published articles, engagement metrics, and editorial review statuses."
        action={
          <Link
            to="/dashboard/posts/new"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-moss px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90"
          >
            <FilePlus2 size={16} />
            <span>New story</span>
          </Link>
        }
      />

      {actionError && (
        <div className="mb-6">
          <Notice>{actionError}</Notice>
        </div>
      )}

      {/* Quick Status Filter Tabs & Search Bar */}
      <div className="space-y-4">
        {/* Horizontal Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`whitespace-nowrap rounded-full px-4 py-2 transition-all ${
                status === tab.value
                  ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm font-bold"
                  : "border border-black/10 dark:border-white/10 bg-surface text-muted hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Secondary Filter */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={15} />
            <input
              type="text"
              placeholder="Search stories by title, category, or excerpt..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="field !py-2.5 !pl-11 text-xs w-full"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search input"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="text-xs text-muted sm:text-right">
            Showing <strong className="text-ink">{displayedPosts.length}</strong> {displayedPosts.length === 1 ? "story" : "stories"}
          </div>
        </div>
      </div>

      {loading ? (
        <UserPostsSkeleton />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : displayedPosts.length ? (
        <>
          <div className="space-y-4">
            {displayedPosts.map((post) => (
              <div
                key={post.id}
                className="group relative flex flex-col gap-5 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-5 sm:p-6 shadow-card transition duration-200 hover:border-moss/40 dark:hover:border-primary/40 sm:flex-row sm:items-start"
              >
                {/* Thumbnail */}
                <div className="aspect-[16/10] sm:aspect-square w-full sm:w-36 shrink-0 overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-surface-elevated">
                  {post.featuredImagePath ? (
                    <img
                      src={imageUrl(post.featuredImagePath)}
                      alt=""
                      className="size-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-xs font-semibold text-muted bg-paper/60 dark:bg-surface-elevated/60">
                      <span className="flex flex-col items-center gap-1">
                        <BookOpen size={16} className="text-muted/60" />
                        <span>No image</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Content details */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full bg-accent/30 dark:bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-primary">
                        {post.categoryName ?? post.category}
                      </span>
                      <StatusBadge status={post.status} />
                    </div>

                    <Link
                      to={`/dashboard/posts/${post.id}/edit`}
                      className="mt-2.5 block font-display text-xl sm:text-2xl font-bold leading-snug text-ink transition hover:text-moss dark:hover:text-primary"
                    >
                      {post.title}
                    </Link>

                    {post.excerpt && (
                      <p className="mt-1.5 text-xs sm:text-sm text-muted line-clamp-2 leading-relaxed">
                        {post.excerpt}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Eye size={13} /> {post.viewCount ?? 0} views
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Heart size={13} className="text-rose-500" /> {post.likeCount ?? 0} likes
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <MessageSquareText size={13} /> {post.commentCount ?? 0} {post.commentCount === 1 ? "comment" : "comments"}
                      </span>
                      <span>· Created {new Date(post.createdAt).toLocaleDateString()}</span>
                    </div>

                    {/* Rejection notice if rejected */}
                    {post.status === "REJECTED" && post.rejectionReason && (
                      <div className="mt-3.5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-xs font-medium text-red-800 dark:text-red-300">
                        <strong className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-red-900 dark:text-red-200">
                          <AlertCircle size={14} /> Editorial Feedback
                        </strong>
                        {post.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Bottom row: tags and action buttons */}
                  <div className="mt-5 flex flex-col gap-3 border-t border-black/[.06] dark:border-white/[.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {post.tags && post.tags.length > 0 ? (
                        post.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-paper dark:bg-surface-elevated px-2.5 py-0.5 text-[11px] font-medium text-muted"
                          >
                            #{tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] italic text-muted">No tags</span>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex shrink-0 items-center gap-2">
                      {post.status === "APPROVED" && (
                        <Link
                          to={`/blogs/${post.slug}`}
                          className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-3.5 py-1.5 text-xs font-bold text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
                        >
                          <Eye size={13} /> View Live
                        </Link>
                      )}
                      <Link
                        to={`/dashboard/posts/${post.id}/edit`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-3.5 py-1.5 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
                      >
                        <Pencil size={12} /> Edit
                      </Link>
                      {(post.status === "DRAFT" || post.status === "REJECTED") && (
                        <Button
                          onClick={() => void submitPost(post.id)}
                          className="px-3.5 py-1.5 text-xs font-bold"
                        >
                          <Send size={13} /> Submit for Review
                        </Button>
                      )}
                      <button
                        onClick={() => void deletePost(post.id)}
                        className="inline-flex size-8 items-center justify-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-400"
                        title="Delete story"
                        aria-label="Delete story"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {paginationData && (
            <Pagination
              page={paginationData.page}
              limit={paginationData.limit}
              total={paginationData.total}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="No stories found">
          {status
            ? "No stories match the selected status filter."
            : "You don't have any stories written yet. Start drafting your first article!"}
        </EmptyState>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   3. MY COMMENTS PAGE
   ══════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════
   SAVED STORIES / BOOKMARKS PAGE
   ══════════════════════════════════════════════════════════════════════ */

interface SavedStoryItem {
  bookmarkId: string;
  bookmarkedAt: string;
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  author: string;
  authorProfileImagePath: string | null;
  categoryId: string;
  category: string;
  categorySlug: string;
  featuredImagePath: string | null;
  likeCount: number;
  commentCount: number;
}

function BookmarksSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface overflow-hidden shadow-card p-5 space-y-4"
        >
          <SkeletonBox className="aspect-[16/10] w-full rounded-xl" />
          <div className="space-y-2">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-6 w-full" />
            <SkeletonBox className="h-3 w-4/5" />
          </div>
          <div className="flex justify-between items-center pt-3 border-t border-black/[.06] dark:border-white/[.06]">
            <SkeletonBox className="h-4 w-28" />
            <SkeletonBox className="h-7 w-20 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SavedStoriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);

  const url = useMemo(
    () => `/user/bookmarks?page=${page}&limit=9${search ? `&search=${encodeURIComponent(search)}` : ""}`,
    [page, search],
  );

  const { data, loading, error, reload } = useRemote<PageResult<SavedStoryItem>>(url);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  async function handleRemoveBookmark(story: SavedStoryItem) {
    const confirmed = await confirmAction({
      title: "Remove from Saved Stories?",
      text: `Remove "${story.title}" from your personal reading list?`,
      confirmText: "Remove",
      cancelText: "Keep Saved",
      icon: "warning",
    });
    if (!confirmed) return;

    setRemovingId(story.id);
    try {
      await api.delete(`/user/bookmarks/${story.id}`);
      showToast({ title: "Removed from saved stories", icon: "success" });
      void reload();
    } catch (err) {
      await showError("Action Failed", getErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }

  const rawList: SavedStoryItem[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];

  const paginationData = (data as any)?.pagination;

  return (
    <div className="space-y-8">
      <Seo title="Saved Stories — Personal Reading List" robotsIndex={false} robotsFollow={false} />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-10 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/30 dark:bg-accent/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary">
                <Bookmark size={13} /> Reading Library
              </span>
              <span className="text-xs text-muted">· {paginationData?.total ?? rawList.length} saved</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Saved Stories
            </h1>
            <p className="mt-1.5 text-sm text-muted">
              Articles, dispatches, and technical essays you've bookmarked to read or reference.
            </p>
          </div>

          <Link
            to="/blogs"
            className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink self-start sm:self-auto"
          >
            Explore Journal <ArrowRight size={14} />
          </Link>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mt-6 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={15} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Filter your saved stories..."
              className="w-full rounded-full border border-black/10 dark:border-white/10 bg-surface pl-10 pr-4 py-2 text-xs text-ink shadow-sm placeholder:text-muted focus:border-moss focus:outline-none dark:focus:border-primary"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <Button type="submit" variant="secondary" className="!rounded-full !py-2 !px-4 text-xs font-bold uppercase">
            Filter
          </Button>
        </form>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <BookmarksSkeleton />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : rawList.length === 0 ? (
        <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-12 text-center shadow-card">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-accent/20 text-moss dark:text-primary">
            <Bookmark size={28} />
          </div>
          <h2 className="mt-4 font-display text-2xl font-bold text-ink">
            {search ? "No matching saved stories" : "Your reading list is empty"}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            {search
              ? `No saved stories found matching "${search}". Try clearing your filter.`
              : "When you discover insightful articles in Fieldnotes, click the Bookmark icon to save them for easy reference."}
          </p>
          <div className="mt-6">
            <Link
              to="/blogs"
              className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink"
            >
              Browse all stories <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rawList.map((story) => {
              const wordCount = (story.excerpt || story.title || "").split(/\s+/).length * 10;
              const readMinutes = Math.max(2, Math.round(wordCount / 60));

              return (
                <article
                  key={story.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-moss/40 hover:shadow-soft"
                >
                  <div>
                    {/* Story Cover Image Link */}
                    <Link
                      to={`/blogs/${story.slug}`}
                      className="relative block aspect-[16/10] w-full overflow-hidden bg-black/5 dark:bg-white/5"
                    >
                      {story.featuredImagePath ? (
                        <img
                          src={imageUrl(story.featuredImagePath)}
                          alt={story.title}
                          className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid size-full place-items-center bg-gradient-to-br from-moss/10 via-accent/15 to-moss/20">
                          <BookOpen size={28} className="text-moss/40 dark:text-primary/40" />
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full border border-black/10 dark:border-white/10 bg-surface/90 dark:bg-surface/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-primary shadow-sm backdrop-blur">
                        {story.category}
                      </span>
                    </Link>

                    {/* Body */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-xs text-muted mb-2">
                        <span className="grid size-5 place-items-center overflow-hidden rounded-full bg-accent/30 text-[10px] font-bold text-moss dark:text-primary">
                          {story.authorProfileImagePath ? (
                            <img src={imageUrl(story.authorProfileImagePath)} alt="" className="size-full object-cover" />
                          ) : (
                            (story.author || "A").slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="font-semibold text-ink truncate max-w-[120px]">{story.author}</span>
                        <span>·</span>
                        <span>
                          {story.publishedAt
                            ? new Date(story.publishedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Recent"}
                        </span>
                      </div>

                      <Link to={`/blogs/${story.slug}`} className="block group-hover:text-moss dark:group-hover:text-primary transition-colors">
                        <h3 className="font-display text-lg font-bold leading-snug tracking-tight text-ink line-clamp-2">
                          {story.title}
                        </h3>
                      </Link>

                      {story.excerpt && (
                        <p className="mt-2 text-xs leading-relaxed text-muted line-clamp-2">
                          {story.excerpt}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between border-t border-black/[.06] dark:border-white/[.08] px-5 py-3.5 text-xs">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                      <Clock size={12} /> {readMinutes} min read
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveBookmark(story)}
                        disabled={removingId === story.id}
                        aria-label="Remove bookmark"
                        title="Remove from saved stories"
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                      <Link
                        to={`/blogs/${story.slug}`}
                        className="inline-flex items-center gap-1 font-bold text-moss dark:text-primary hover:underline"
                      >
                        Read <ArrowUpRight size={13} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {paginationData && paginationData.totalPages > 1 && (
            <Pagination
              page={paginationData.page}
              limit={paginationData.limit}
              total={paginationData.total}
              onChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface UserComment {
  id: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  postTitle: string;
  postSlug: string;
}

function UserCommentsSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card space-y-3"
        >
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-4 w-48" />
            <SkeletonBox className="h-5 w-24 rounded-full" />
          </div>
          <SkeletonBox className="h-12 w-full" />
          <div className="flex justify-between items-center pt-2">
            <SkeletonBox className="h-3 w-32" />
            <SkeletonBox className="h-4 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function UserCommentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const url = useMemo(
    () => `/user/comments?page=${page}&limit=10${status ? `&status=${status}` : ""}`,
    [page, status],
  );
  const { data, loading, error } = useRemote<PageResult<UserComment>>(url);

  const rawList: UserComment[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.data)
      ? (data as any).data
      : [];
  const paginationData = (data as any)?.pagination;

  const filterTabs = [
    { label: "All Comments", value: "" },
    { label: "Approved (Public)", value: "APPROVED" },
    { label: "Pending Approval", value: "PENDING" },
    { label: "Needs Attention", value: "REJECTED" },
  ];

  return (
    <div className="space-y-8">
      <Seo title="My Comments — Creator Workspace" robotsIndex={false} robotsFollow={false} />

      <PageHeading
        eyebrow="Community Discussions"
        title="My Comments"
        description="Review all responses and discussions you have contributed across published journal articles."
      />

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold scrollbar-none">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`whitespace-nowrap rounded-full px-4 py-2 transition-all ${
              status === tab.value
                ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm font-bold"
                : "border border-black/10 dark:border-white/10 bg-surface text-muted hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <UserCommentsSkeleton />
      ) : error ? (
        <Notice>{error}</Notice>
      ) : rawList.length ? (
        <>
          <div className="space-y-4">
            {rawList.map((comment) => (
              <article
                key={comment.id}
                className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card transition hover:border-moss/30 dark:hover:border-primary/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">
                      Story Discussion
                    </p>
                    <Link
                      className="mt-1 block font-display text-lg sm:text-xl font-bold text-ink transition hover:text-moss dark:hover:text-primary"
                      to={`/blogs/${comment.postSlug}`}
                    >
                      {comment.postTitle}
                    </Link>
                  </div>
                  <StatusBadge status={comment.status} />
                </div>

                <blockquote className="my-4 rounded-2xl border-l-2 border-moss dark:border-primary bg-paper/60 dark:bg-surface-elevated/60 py-3.5 pl-4 pr-4 text-sm sm:text-base italic leading-relaxed text-ink/90 font-serif">
                  "{comment.content}"
                </blockquote>

                <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-black/[.04] dark:border-white/[.06]">
                  <p className="flex items-center gap-1.5">
                    <Clock size={12} />
                    Submitted {new Date(comment.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <Link
                    to={`/blogs/${comment.postSlug}`}
                    className="inline-flex items-center gap-1 font-semibold text-moss dark:text-primary hover:underline"
                  >
                    <span>View in discussion</span>
                    <ArrowUpRight size={12} />
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {paginationData && (
            <Pagination
              page={paginationData.page}
              limit={paginationData.limit}
              total={paginationData.total}
              onChange={setPage}
            />
          )}
        </>
      ) : (
        <EmptyState title="No comments found">
          Comments you post on public articles will appear here along with their editorial moderation status.
        </EmptyState>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   4. POST EDITOR PAGE & SKELETON (CREATE & EDIT - SHARED USER/ADMIN)
   ══════════════════════════════════════════════════════════════════════ */

function PostEditorSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <SkeletonBox className="h-3 w-28" />
        <SkeletonBox className="h-8 w-60" />
        <SkeletonBox className="h-4 w-96" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 sm:p-9 shadow-card space-y-6">
            <SkeletonBox className="h-6 w-48" />
            <SkeletonBox className="h-11 w-full" />
            <SkeletonBox className="h-24 w-full" />
            <SkeletonBox className="h-96 w-full" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card space-y-6">
            <SkeletonBox className="h-6 w-36" />
            <SkeletonBox className="h-10 w-full" />
            <SkeletonBox className="h-32 w-full" />
            <SkeletonBox className="h-36 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PostEditorPage({ admin = false }: { admin?: boolean }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [options, setOptions] = useState<PostOptions>({ categories: [], tags: [] });
  const [existing, setExisting] = useState<ExistingPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("DRAFT");
  const [featuredImageId, setFeaturedImageId] = useState<string | null>(null);
  const [featuredImagePath, setFeaturedImagePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [galleryImages, setGalleryImages] = useState<Array<{ id: string; path: string }>>([]);

  // Form fields
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [seoKeywords, setSeoKeywords] = useState("");
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [featuredOrder, setFeaturedOrder] = useState<number>(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const categoryUrl = admin ? "/admin/categories?page=1&limit=100" : "/user/post-options";
        const tagUrl = admin ? "/admin/tags?page=1&limit=100" : null;
        const [optionsResult, tagsResult] = await Promise.all([
          api.get<{ data: PostOptions | PageResult<Taxonomy> }>(categoryUrl),
          tagUrl ? api.get<{ data: PageResult<Taxonomy> }>(tagUrl) : Promise.resolve(null),
        ]);
        let categories: Taxonomy[] = [];
        let tags: Taxonomy[] = [];
        const optBody = optionsResult.data;
        if (optBody && "data" in optBody && typeof optBody.data === "object" && optBody.data !== null && "categories" in optBody.data) {
          categories = (optBody.data as PostOptions).categories;
          tags = (optBody.data as PostOptions).tags;
        } else {
          categories = Array.isArray(optBody?.data)
            ? (optBody.data as Taxonomy[])
            : Array.isArray((optBody as any)?.data?.data)
              ? (optBody as any).data.data
              : [];
        }
        if (tagsResult) {
          const tagBody = tagsResult.data;
          tags = Array.isArray(tagBody?.data)
            ? (tagBody.data as Taxonomy[])
            : Array.isArray((tagBody as any)?.data?.data)
              ? (tagBody as any).data.data
              : [];
        }
        if (active) setOptions({ categories, tags });

        if (id) {
          const postResponse = await api.get<{ data: ExistingPost }>(
            admin ? `/admin/posts/${id}` : `/user/posts/${id}`,
          );
          if (active) {
            const p = postResponse.data.data;
            setExisting(p);
            setTitle(p.title ?? "");
            setExcerpt(p.excerpt ?? "");
            setContent(p.content ?? "");
            setCategoryId(p.categoryId ?? "");
            setSelectedTagIds(p.tags?.map((t) => t.id) ?? []);
            setStatus(p.status);
            setFeaturedImageId(p.featuredImageId);
            setFeaturedImagePath(
              (p as ExistingPost & { featuredImagePath?: string }).featuredImagePath ?? null,
            );
            setGalleryImages(
              (p as ExistingPost & { images?: Array<{ id: string; path: string }> }).images ?? [],
            );
            setSeoTitle(p.seoTitle ?? "");
            setSeoDescription(p.seoDescription ?? "");
            setSeoKeywords(p.seoKeywords ?? "");
            setIsFeatured(Boolean(p.isFeatured));
            setFeaturedOrder(p.featuredOrder ?? 0);
          }
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [admin, id]);

  async function uploadImage(file?: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("image", file);
      const result = await api.post<{ data: { id: string; path: string } }>("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFeaturedImageId(result.data.data.id);
      setFeaturedImagePath(result.data.data.path);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setUploading(false);
    }
  }

  const ALLOWED_MIME_TYPES = useMemo(
    () =>
      new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
      ]),
    [],
  );
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per image
  const MAX_GALLERY_IMAGES = 20;

  async function addMultipleToGallery(files?: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    const remainingSlots = MAX_GALLERY_IMAGES - galleryImages.length;
    if (remainingSlots <= 0) {
      await showWarning(
        "Upload Limit Reached",
        `You have already reached the maximum limit of ${MAX_GALLERY_IMAGES} additional story images.`,
      );
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }

    const filesToProcess = fileList.slice(0, remainingSlots);
    if (fileList.length > remainingSlots) {
      await showWarning(
        "Partial Selection",
        `Only ${remainingSlots} more image${remainingSlots > 1 ? "s" : ""} can be added. The remaining ${fileList.length - remainingSlots} file${fileList.length - remainingSlots > 1 ? "s were" : " was"} ignored.`,
      );
    }

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    for (const file of filesToProcess) {
      const isAllowedType = ALLOWED_MIME_TYPES.has(file.type);
      const isAllowedSize = file.size <= MAX_FILE_SIZE;

      if (!isAllowedType) {
        invalidFiles.push(`${file.name} (unsupported format)`);
      } else if (!isAllowedSize) {
        invalidFiles.push(`${file.name} (exceeds 5 MB limit)`);
      } else {
        validFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      await showWarning(
        "Invalid Files Skipped",
        `The following file${invalidFiles.length > 1 ? "s were" : " was"} skipped:\n• ${invalidFiles.join("\n• ")}`,
      );
    }

    if (validFiles.length === 0) {
      if (galleryInputRef.current) galleryInputRef.current.value = "";
      return;
    }

    setUploadingGallery(true);
    setError(null);

    const uploadedNewImages: Array<{ id: string; path: string }> = [];
    const failedUploads: string[] = [];

    try {
      for (const file of validFiles) {
        try {
          const form = new FormData();
          form.append("image", file);
          const result = await api.post<{ data: { id: string; path: string } }>("/uploads", form, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          uploadedNewImages.push({
            id: result.data.data.id,
            path: result.data.data.path,
          });
        } catch (uploadErr) {
          failedUploads.push(`${file.name}: ${getErrorMessage(uploadErr)}`);
        }
      }

      if (uploadedNewImages.length > 0) {
        setGalleryImages((prev) => [...prev, ...uploadedNewImages]);
      }

      if (failedUploads.length > 0) {
        await showError(
          "Upload Incomplete",
          `Some images could not be uploaded:\n• ${failedUploads.join("\n• ")}`,
        );
      }
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Upload Failed", msg);
    } finally {
      setUploadingGallery(false);
      if (galleryInputRef.current) {
        galleryInputRef.current.value = "";
      }
    }
  }

  async function handleSubmit(action: "draft" | "submit") {
    if (!title.trim()) {
      setError("Please provide a story title.");
      await showWarning("Title Required", "Please enter a compelling title for your story.");
      return;
    }
    if (!categoryId) {
      setError("Please select a category.");
      await showWarning("Category Required", "Please select an editorial category for your article.");
      return;
    }
    if (!content.trim()) {
      setError("Story content cannot be empty.");
      await showWarning("Content Required", "Please provide content for your manuscript.");
      return;
    }

    setBusy(true);
    setError(null);

    const body = {
      title: title.trim(),
      excerpt: excerpt.trim() || null,
      content: content.trim(),
      categoryId,
      featuredImageId,
      tagIds: selectedTagIds,
      imageIds: galleryImages.map((img) => img.id),
      seoTitle: seoTitle.trim() || null,
      seoDescription: seoDescription.trim() || null,
      seoKeywords: seoKeywords.trim() || null,
      ...(admin ? { status, isFeatured, featuredOrder } : { action }),
    };

    try {
      if (id) {
        await api.patch(admin ? `/admin/posts/${id}` : `/user/posts/${id}`, body);
      } else {
        await api.post<{ data: { id: string } }>(admin ? "/admin/posts" : "/user/posts", body);
      }
      await showSuccess(
        action === "submit"
          ? (admin ? "Article Saved" : "Story Submitted")
          : "Draft Saved",
        id
          ? "Your changes have been saved successfully."
          : (action === "submit"
              ? "Your story was created and submitted for review."
              : "Your story draft has been saved.")
      );
      navigate(admin ? "/admin/posts" : "/dashboard/posts");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Failed to Save Story", msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <PostEditorSkeleton />;
  if (error && !options.categories.length) return <Notice>{error}</Notice>;

  const isPublishedEdit = !admin && existing && existing.status === "APPROVED";

  return (
    <div className="space-y-8">
      <Seo title={id ? "Edit Story — Creator Workspace" : "Write a New Story — Creator Workspace"} robotsIndex={false} robotsFollow={false} />

      {/* Editorial Page Heading */}
      <PageHeading
        eyebrow={admin ? "Editorial Administration" : "Creator Portal"}
        title={id ? "Edit your manuscript." : "Craft a new story."}
        description="Refine your narrative, format your prose, organize metadata, and configure search previews."
        action={
          <Link
            to={admin ? "/admin/posts" : "/dashboard/posts"}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
          >
            <span>Back to stories</span>
          </Link>
        }
      />

      {error && (
        <div className="mb-6">
          <Notice>{error}</Notice>
        </div>
      )}

      {/* Moderation Notice if editing an already-approved post */}
      {isPublishedEdit && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200 shadow-sm">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <strong className="font-bold">Editorial Moderation Notice:</strong> This story is currently live and published. Saving
            modifications will automatically update its status to <strong>Pending Review</strong> until an editor evaluates the revised manuscript.
          </div>
        </div>
      )}

      {/* Two-column layout: Main manuscript left, Sidebar settings right */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Left Column: Manuscript & SEO */}
        <div className="space-y-8">
          {/* Main Story Content Card */}
          <div className="space-y-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-9">
            <div className="border-b border-black/[.08] dark:border-white/[.08] pb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Story Manuscript</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-ink">Content & Overview</h2>
            </div>

            <Field
              label="Story Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={3}
              maxLength={200}
              placeholder="e.g., The Architecture of Modern Clean Code"
            />

            <TextArea
              label="Short Excerpt / Deck"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              maxLength={500}
              placeholder="A brief overview shown on search listings and preview cards..."
            />

            <TextArea
              label="Story Body (Full Content)"
              className="min-h-[460px] font-serif leading-relaxed text-base"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Write your story here. Paragraph breaks, reflections, and ideas welcome..."
            />
          </div>

          {/* SEO Metadata Card */}
          <div className="space-y-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card sm:p-9">
            <div className="border-b border-black/[.08] dark:border-white/[.08] pb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Search & Discovery</p>
              <h3 className="mt-1 font-display text-2xl font-bold text-ink">SEO Settings for this Story</h3>
              <p className="mt-1 text-xs text-muted">
                Control how your article appears in search engines and social cards.
              </p>
            </div>

            <Field
              label="SEO Meta Title"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              maxLength={200}
              placeholder="Leave empty to use story title"
            />

            <TextArea
              label="SEO Meta Description"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              maxLength={320}
              placeholder="Leave empty to use story excerpt"
            />

            <Field
              label="SEO Keywords"
              value={seoKeywords}
              onChange={(e) => setSeoKeywords(e.target.value)}
              maxLength={500}
              placeholder="Comma-separated keywords (e.g. typography, design, storytelling)"
            />

            {/* Live Search Engine Snippet Preview */}
            <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-paper/60 dark:bg-surface-elevated/60 p-5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Search Result Preview</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 truncate font-mono">
                  https://fieldnotes.journal/blogs/{id ? existing?.slug ?? "story-slug" : "your-story-slug"}
                </p>
                <p className="font-display text-base font-bold text-ink truncate hover:underline">
                  {seoTitle.trim() || title.trim() || "Untitled Story"} | Fieldnotes
                </p>
                <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                  {seoDescription.trim() || excerpt.trim() || "A thoughtful story published on Fieldnotes Journal."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Publishing Settings */}
        <aside className="space-y-6">
          <div className="space-y-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-6 shadow-card">
            <div className="border-b border-black/[.08] dark:border-white/[.08] pb-3">
              <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">
                Publishing Settings
              </p>
            </div>

            <SelectField
              label="Category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              <option value="">Select a Category</option>
              {options.categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </SelectField>

            <div>
              <label className="block text-sm font-semibold text-ink">
                Tags
                <select
                  multiple
                  value={selectedTagIds}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (option) => option.value);
                    setSelectedTagIds(values);
                  }}
                  className="field mt-2 min-h-32"
                >
                  {options.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
                <span className="mt-1.5 block text-xs font-normal text-muted">
                  Hold Ctrl (Windows) or Cmd (Mac) to select multiple tags.
                </span>
              </label>

              {/* Selected Tag Pills */}
              {selectedTagIds.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedTagIds.map((tid) => {
                    const t = options.tags.find((item) => item.id === tid);
                    if (!t) return null;
                    return (
                      <span
                        key={tid}
                        className="inline-flex items-center gap-1 rounded-full bg-paper dark:bg-surface-elevated px-2.5 py-0.5 text-xs text-ink border border-black/10 dark:border-white/10"
                      >
                        #{t.name}
                        <button
                          type="button"
                          onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tid))}
                          className="hover:text-red-500"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {admin && (
              <SelectField
                label="Publishing Status"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="DRAFT">Draft</option>
                <option value="PENDING">Pending Review</option>
                <option value="APPROVED">Published (Live)</option>
                <option value="REJECTED">Needs Revision</option>
              </SelectField>
            )}

            {admin && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="is-featured-toggle" className="text-sm font-bold text-ink flex items-center gap-1.5 cursor-pointer">
                      <Sparkles size={14} className="text-amber-500" />
                      Featured Story
                    </label>
                    <p className="text-[11px] text-muted">
                      Highlight this article in the curated Featured Stories hero section.
                    </p>
                  </div>
                  <input
                    id="is-featured-toggle"
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="size-5 rounded border-black/20 text-moss focus:ring-moss dark:focus:ring-primary cursor-pointer"
                  />
                </div>
                {isFeatured && (
                  <div className="pt-2 border-t border-amber-500/20">
                    <label className="block text-xs font-semibold text-ink mb-1">
                      Display Priority Order
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={featuredOrder}
                      onChange={(e) => setFeaturedOrder(Math.max(0, parseInt(e.target.value) || 0))}
                      className="field text-xs !py-1.5"
                      placeholder="0 (Lower number = higher priority)"
                    />
                    <span className="text-[10px] text-muted block mt-1">
                      Lower number appears first (0 = Primary Cover Story).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Featured Image */}
            <div className="border-t border-black/[.08] dark:border-white/[.08] pt-4">
              <p className="text-sm font-semibold text-ink">Featured Image</p>
              {featuredImagePath && (
                <div className="relative my-3 overflow-hidden rounded-2xl border border-black/[.08] dark:border-white/[.08]">
                  <img
                    src={imageUrl(featuredImagePath)}
                    alt="Featured preview"
                    className="aspect-video w-full object-cover shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFeaturedImageId(null);
                      setFeaturedImagePath(null);
                    }}
                    className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-black/70 text-white hover:bg-red-600 transition"
                    title="Remove featured image"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-paper/50 dark:bg-surface-elevated/50 px-4 py-3.5 text-xs font-semibold text-muted transition hover:border-moss/40 hover:bg-paper hover:text-ink">
                <Upload size={15} />
                {uploading ? "Uploading..." : featuredImagePath ? "Replace featured image" : "Upload featured image"}
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading}
                  onChange={(event) => void uploadImage(event.target.files?.[0])}
                />
              </label>
            </div>

            {/* Additional Story Images */}
            <div className="border-t border-black/[.08] dark:border-white/[.08] pt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink">Additional Story Images</p>
                {galleryImages.length > 0 && (
                  <span className="text-xs font-semibold text-moss dark:text-primary">
                    {galleryImages.length} / 20 images
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-muted">
                Select one or multiple images at once for the story gallery. Newly selected images are appended to your existing collection.
              </p>
              {galleryImages.length > 0 && (
                <div className="my-3 grid grid-cols-3 gap-2">
                  {galleryImages.map((image, index) => (
                    <div
                      key={`${image.id}-${index}`}
                      className="group relative overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.08] bg-paper dark:bg-surface-elevated shadow-sm"
                    >
                      <img
                        src={imageUrl(image.path)}
                        alt={`Story gallery ${index + 1}`}
                        className="aspect-square w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                      <button
                        type="button"
                        onClick={() => setGalleryImages((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-white transition hover:bg-red-600 shadow-sm"
                        title="Remove image"
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X size={12} />
                      </button>
                      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white/90">
                        #{index + 1}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 dark:border-white/20 bg-paper/50 dark:bg-surface-elevated/50 px-4 py-3 text-xs font-semibold text-muted transition hover:border-moss/40 hover:bg-paper hover:text-ink">
                <Upload size={15} />
                {uploadingGallery ? "Uploading images..." : "Select additional images (supports multiple)"}
                <input
                  ref={galleryInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  disabled={uploading || uploadingGallery}
                  onChange={(event) => {
                    const files = event.target.files;
                    if (files && files.length > 0) {
                      void addMultipleToGallery(files);
                    }
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            {admin ? (
              <Button
                className="w-full shadow-sm"
                onClick={() => void handleSubmit("submit")}
                disabled={busy || uploading || uploadingGallery}
              >
                {busy ? "Saving..." : "Save Story Changes"} <ArrowRight size={16} />
              </Button>
            ) : (
              <>
                <Button
                  className="w-full shadow-sm"
                  onClick={() => void handleSubmit("submit")}
                  disabled={busy || uploading || uploadingGallery}
                >
                  <Send size={15} /> {busy ? "Submitting..." : "Submit for Editorial Approval"}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => void handleSubmit("draft")}
                  disabled={busy || uploading || uploadingGallery}
                >
                  {busy ? "Saving..." : "Save as Draft"}
                </Button>
              </>
            )}

            <Link
              to={admin ? "/admin/posts" : "/dashboard/posts"}
              className="block pt-2 text-center text-xs font-bold uppercase tracking-wider text-muted transition hover:text-ink hover:underline"
            >
              Cancel and return to stories
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   5. PROFILE & SETTINGS PAGE & SKELETON
   ══════════════════════════════════════════════════════════════════════ */

function ProfileSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <SkeletonBox className="h-3 w-32" />
        <SkeletonBox className="h-8 w-64" />
        <SkeletonBox className="h-4 w-96" />
      </div>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-9 shadow-card space-y-6">
          <SkeletonBox className="h-7 w-48" />
          <div className="flex items-center gap-5">
            <SkeletonBox className="size-24 rounded-full" />
            <SkeletonBox className="h-9 w-32 rounded-full" />
          </div>
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-24 w-full" />
          <SkeletonBox className="h-10 w-36 rounded-full" />
        </div>
        <div className="rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 sm:p-9 shadow-card space-y-6">
          <SkeletonBox className="h-7 w-48" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-full" />
          <SkeletonBox className="h-10 w-36 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<{
    id: string;
    username: string;
    email: string;
    role: string;
    bio: string | null;
    createdAt: string;
    profileImageId: string | null;
    profileImagePath: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Password visibility state toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    api
      .get<{ data: { user: NonNullable<typeof profile> } }>("/user/profile")
      .then((response) => setProfile(response.data.data.user))
      .catch((requestError: unknown) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api.put<{ data: { user: NonNullable<typeof profile> } }>("/user/profile", {
        username: String(form.get("username")),
        email: String(form.get("email")),
        bio: String(form.get("bio") || ""),
      });
      setProfile(result.data.data.user);
      setMessage("Profile details updated successfully.");
      await refresh();
      await showSuccess("Profile Saved", "Your author details have been updated successfully.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Failed to Update Profile", msg);
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api.post("/user/change-password", Object.fromEntries(form.entries()));
      formElement.reset();
      setMessage("Password updated successfully! All active sessions on other devices have been signed out.");
      await refresh();
      await showSuccess(
        "Password Updated",
        "Your password has been changed. Other active sessions have been safely terminated."
      );
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Password Update Failed", msg);
    } finally {
      setBusy(false);
    }
  }

  async function uploadAvatar(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      await showWarning("File Too Large", "Profile portrait must be under 5 MB.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = new FormData();
    form.append("image", file);
    try {
      const upload = await api.post<{ data: { id: string } }>("/uploads", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await api.patch("/user/profile", { profileImageId: upload.data.data.id });
      const result = await api.get<{ data: { user: NonNullable<typeof profile> } }>("/user/profile");
      setProfile(result.data.data.user);
      setMessage("Profile avatar updated successfully.");
      await refresh();
      await showSuccess("Avatar Updated", "Your profile portrait has been uploaded successfully.");
    } catch (requestError) {
      const msg = getErrorMessage(requestError);
      setError(msg);
      await showError("Upload Failed", msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <ProfileSkeleton />;
  if (!profile) return <Notice>{error ?? "Profile unavailable."}</Notice>;

  return (
    <div className="space-y-8">
      <Seo title="Profile Settings — Creator Workspace" robotsIndex={false} robotsFollow={false} />

      <PageHeading
        eyebrow="Account & Preferences"
        title="Profile & Settings"
        description="Manage your author presence, update bio and avatar, and control account security."
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

      {/* Two-column layout: Profile Details Left, Security Right */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Profile Info Card */}
        <form
          onSubmit={saveProfile}
          className="space-y-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card sm:p-9"
        >
          <div className="border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Author Presence</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Personal Information</h2>
          </div>

          {/* Avatar uploader */}
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="relative grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-moss/20 dark:border-primary/20 bg-moss/10 dark:bg-primary/20 text-2xl font-bold text-moss dark:text-primary shadow-soft">
              {profile.profileImagePath ? (
                <img src={imageUrl(profile.profileImagePath)} alt="" className="size-full object-cover" />
              ) : (
                profile.username.slice(0, 1).toUpperCase()
              )}
            </div>
            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-surface px-4 py-2 text-xs font-bold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated">
                <Upload size={14} /> Change avatar
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="sr-only"
                  onChange={(event) => void uploadAvatar(event.target.files?.[0])}
                />
              </label>
              <p className="mt-1.5 text-xs text-muted">JPG, PNG, WebP or AVIF up to 5MB.</p>
            </div>
          </div>

          <Field
            label="Username"
            name="username"
            required
            minLength={3}
            maxLength={50}
            defaultValue={profile.username}
          />

          <Field
            label="Email Address"
            name="email"
            type="email"
            required
            defaultValue={profile.email}
          />

          <TextArea
            label="Bio / Author Description"
            name="bio"
            maxLength={500}
            defaultValue={profile.bio ?? ""}
            placeholder="Tell your readers a little bit about yourself, your background, and topics you explore..."
          />

          {/* Account Role & Member Since info */}
          <div className="rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-paper/60 dark:bg-surface-elevated/60 p-4 text-xs text-muted space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Account Role:</span>
              <span className="rounded-full bg-accent/30 dark:bg-accent/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-primary">
                {profile.role}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-black/[.06] dark:border-white/[.06] pt-2">
              <span className="font-semibold text-ink">Member Since:</span>
              <span className="font-medium text-ink">
                {new Date(profile.createdAt).toLocaleDateString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full sm:w-auto shadow-sm">
            Save Profile Changes
          </Button>
        </form>

        {/* Change Password Card */}
        <form
          id="password"
          onSubmit={changePassword}
          className="space-y-6 rounded-3xl border border-black/[.08] dark:border-white/[.08] bg-surface p-7 shadow-card sm:p-9"
        >
          <div className="border-b border-black/[.08] dark:border-white/[.08] pb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-moss dark:text-primary">Security & Access</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Change Password</h2>
          </div>

          <div className="relative">
            <Field
              label="Current Password"
              name="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your existing password"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword((prev) => !prev)}
              className="absolute right-3 top-9 text-muted hover:text-ink transition"
              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            >
              {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Field
              label="New Password"
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Minimum 12 characters"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword((prev) => !prev)}
              className="absolute right-3 top-9 text-muted hover:text-ink transition"
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="relative">
            <Field
              label="Confirm New Password"
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              placeholder="Re-enter new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-9 text-muted hover:text-ink transition"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-paper/60 dark:bg-surface-elevated/60 p-4 text-xs leading-relaxed text-muted">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-moss dark:text-primary" />
            <div>
              Passwords must contain at least 12 characters. Updating your password automatically revokes any active sessions on other devices for your security.
            </div>
          </div>

          <Button type="submit" disabled={busy} className="w-full sm:w-auto shadow-sm">
            <KeyRound size={15} /> Update Password
          </Button>
        </form>
      </div>
    </div>
  );
}
