import { useState, useRef, useEffect, Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileImage,
  Files,
  FolderKanban,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mail,
  MailCheck,
  Menu,
  MessageSquareText,
  PenLine,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Tags,
  User,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Loading, Notice, ThemeToggle } from "./UI";
import { SearchAutocomplete } from "./SearchAutocomplete";
import { confirmAction, showSuccess } from "../lib/alerts";

const publicLinks = [
  { to: "/blogs", label: "Stories" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export function PublicLayout() {
  const { user, logout, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");

  // Close mobile drawer when route changes
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  // Handle Escape key to close mobile drawer, search & dropdown
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleHeaderSearch(query?: string) {
    const q = typeof query === "string" ? query : headerSearch;
    if (q.trim()) {
      navigate(`/blogs?search=${encodeURIComponent(q.trim())}`);
      setSearchOpen(false);
      setHeaderSearch("");
    }
  }

  function handleMobileSearch(query?: string) {
    const q = typeof query === "string" ? query : mobileSearch;
    if (q.trim()) {
      navigate(`/blogs?search=${encodeURIComponent(q.trim())}`);
      setMenuOpen(false);
      setMobileSearch("");
    }
  }

  async function handleLogout() {
    const confirmed = await confirmAction({
      title: "Sign out of Fieldnotes?",
      text: "Are you sure you want to end your editorial session?",
      confirmText: "Sign Out",
      cancelText: "Stay Signed In",
      icon: "question",
    });
    if (!confirmed) return;
    try {
      await logout();
      await showSuccess("Signed Out", "You have been safely signed out.", 1500);
      navigate("/");
    } catch {
      navigate("/");
    }
  }

  const currentDateFormatted = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-paper text-ink transition-colors duration-200 flex flex-col justify-between overflow-x-hidden">
      <div>
        {/* Top Edition Masthead Ticker: Digital Magazine Header */}
        <div className="border-b border-black/[.06] dark:border-white/[.06] bg-surface/70 dark:bg-surface/50 text-[11px] font-medium tracking-wider text-muted hidden md:block">
          <div className="page-wrap flex h-9 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-bold uppercase tracking-widest text-moss dark:text-primary">
                VOL. XXVI · ED. {new Date().getFullYear()}
              </span>
              <span className="text-black/15 dark:text-white/15">|</span>
              <span className="text-ink/70">The Independent Journal of Craft, Ideas &amp; Culture</span>
            </div>
            <div className="flex items-center gap-4 text-ink/75">
              <span>{currentDateFormatted}</span>
              <span className="text-black/15 dark:text-white/15">|</span>
              <Link to="/about" className="hover:text-moss dark:hover:text-primary transition font-semibold">
                About the Journal
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Magazine Header */}
        <header className="sticky top-0 z-30 border-b border-black/[.08] dark:border-white/[.08] bg-surface/95 dark:bg-surface/95 backdrop-blur-xl transition-colors duration-200 shadow-sm">
          <div className="page-wrap flex h-20 items-center justify-between gap-4">
            {/* Brand Logo & Editorial Kicker */}
            <Link to="/" className="group flex items-center gap-3.5 shrink-0">
              <span className="grid size-11 place-items-center rounded-2xl bg-moss dark:bg-primary text-lime dark:text-[#171B19] shadow-sm transition-transform duration-200 group-hover:scale-105">
                <BookOpen size={22} />
              </span>
              <div className="flex flex-col">
                <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-ink leading-none">
                  Fieldnotes<span className="text-moss dark:text-primary">.</span>
                </span>
                <span className="mt-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.25em] text-muted">
                  Digital Magazine
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 xl:gap-2 lg:flex">
              {publicLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.18em] transition-all duration-200 rounded-full ${
                      isActive
                        ? "bg-moss/10 dark:bg-primary/15 text-moss dark:text-primary font-extrabold"
                        : "text-muted hover:text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            {/* Header Right Actions */}
            <div className="hidden items-center gap-3 lg:flex">
              {/* Expandable Search Input or Trigger */}
              {searchOpen ? (
                <div className="relative">
                  <SearchAutocomplete
                    value={headerSearch}
                    onChange={setHeaderSearch}
                    onClose={() => {
                      setSearchOpen(false);
                      setHeaderSearch("");
                    }}
                    onSubmit={handleHeaderSearch}
                    autoFocus
                    placeholder="Search stories, topics..."
                    inputClassName="!h-10 !w-72 lg:!w-80 text-xs font-normal"
                    dropdownClassName="right-0 w-[360px] sm:w-[420px]"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  title="Search stories"
                  aria-label="Search stories"
                  className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 bg-surface text-muted hover:text-ink hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated transition"
                >
                  <Search size={16} />
                </button>
              )}

              <ThemeToggle size="sm" />

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setProfileOpen((open) => !open)}
                    className="flex items-center gap-2.5 rounded-full border border-black/15 dark:border-white/15 bg-surface px-4 py-2 text-sm font-semibold shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
                    aria-expanded={profileOpen}
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-accent/30 text-xs font-bold text-moss dark:text-primary">
                      {user.username.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="text-ink text-xs font-bold">{user.username}</span>
                    <span className="rounded-full bg-black/[.05] dark:bg-white/[.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {user.role}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-muted transition duration-200 ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {profileOpen && (
                    <>
                      <button
                        aria-label="Close profile menu"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setProfileOpen(false)}
                      />
                      <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-surface py-2 shadow-soft">
                        <div className="border-b border-black/[.08] dark:border-white/[.08] px-4 py-3">
                          <p className="text-xs font-bold text-ink">{user.username}</p>
                          <p className="text-[11px] text-muted truncate">{user.email}</p>
                        </div>
                        {user.role === "admin" && (
                          <Link
                            to="/admin"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:bg-paper dark:hover:bg-surface-elevated"
                          >
                            <LayoutDashboard size={15} /> Admin panel
                          </Link>
                        )}
                        <Link
                          to="/dashboard"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-paper dark:hover:bg-surface-elevated"
                        >
                          <BookOpen size={15} className="text-muted" /> My dashboard
                        </Link>
                        <Link
                          to="/dashboard/posts"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-paper dark:hover:bg-surface-elevated"
                        >
                          <Files size={15} className="text-muted" /> My posts
                        </Link>
                        <Link
                          to="/dashboard/comments"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-paper dark:hover:bg-surface-elevated"
                        >
                          <MessageSquareText size={15} className="text-muted" /> My comments
                        </Link>
                        <Link
                          to="/dashboard/profile"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-paper dark:hover:bg-surface-elevated"
                        >
                          <User size={15} className="text-muted" /> My profile
                        </Link>
                        <Link
                          to="/dashboard/profile#password"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium hover:bg-paper dark:hover:bg-surface-elevated"
                        >
                          <Settings size={15} className="text-muted" /> Change password
                        </Link>
                        <hr className="my-1.5 border-black/[.08] dark:border-white/[.08]" />
                        <button
                          onClick={() => {
                            setProfileOpen(false);
                            void handleLogout();
                          }}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Link
                    to="/login"
                    title="Log In"
                    aria-label="Log In"
                    className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 bg-surface text-ink hover:text-moss dark:hover:text-primary hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated transition shadow-sm"
                  >
                    <LogIn size={18} />
                  </Link>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 rounded-full bg-moss dark:bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm transition hover:bg-ink dark:hover:bg-primary/90"
                  >
                    <span>Join the community</span>
                    <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Header Right */}
            <div className="flex items-center gap-2 lg:hidden">
              <ThemeToggle size="sm" />
              <button
                aria-label="Toggle navigation"
                aria-expanded={menuOpen}
                className="rounded-xl p-2.5 text-ink hover:bg-surface dark:hover:bg-surface-elevated transition"
                onClick={() => setMenuOpen((open) => !open)}
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer Backdrop */}
          {menuOpen && (
            <div
              className="fixed inset-0 z-40 bg-ink/40 dark:bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Mobile Navigation Slide-Out Drawer */}
          <div
            role={menuOpen ? "dialog" : undefined}
            aria-modal={menuOpen ? "true" : undefined}
            aria-label="Site Navigation"
            className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-xs flex-col justify-between bg-surface dark:bg-[#171B19] border-l border-black/[.08] dark:border-white/[.08] text-ink p-6 shadow-2xl backdrop-blur-md transition-all duration-300 ease-in-out lg:hidden ${
              menuOpen ? "translate-x-0 opacity-100 pointer-events-auto" : "translate-x-full opacity-0 pointer-events-none invisible"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-black/[.08] dark:border-white/[.08] pb-5">
                <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5">
                  <span className="grid size-9 place-items-center rounded-xl bg-moss dark:bg-primary text-lime dark:text-[#171B19]">
                    <BookOpen size={18} />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-display text-xl font-bold tracking-tight text-ink">
                      Fieldnotes<span className="text-moss dark:text-primary">.</span>
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted">
                      Digital Magazine
                    </span>
                  </div>
                </Link>
                <button
                  aria-label="Close navigation"
                  className="rounded-xl p-2 text-muted hover:bg-surface dark:hover:bg-surface-elevated hover:text-ink transition"
                  onClick={() => setMenuOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobile Search */}
              <div className="mt-4">
                <SearchAutocomplete
                  value={mobileSearch}
                  onChange={setMobileSearch}
                  onSubmit={handleMobileSearch}
                  onClose={() => {
                    setMenuOpen(false);
                    setMobileSearch("");
                  }}
                  placeholder="Search stories, topics..."
                  inputClassName="!py-2.5 text-xs w-full"
                  dropdownClassName="left-0 right-0 w-full"
                />
              </div>

              {/* Mobile Navigation Links */}
              <nav className="mt-5 flex flex-col gap-1">
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                  Sections
                </p>
                {publicLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      `rounded-xl px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                        isActive
                          ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                          : "text-ink hover:bg-surface dark:hover:bg-surface-elevated"
                      }`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}

                <hr className="my-3 border-black/[.08] dark:border-white/[.08]" />

                {user ? (
                  <div className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
                      Signed in as {user.username} ({user.role})
                    </p>
                    {user.role === "admin" && (
                      <Link
                        className="block rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-moss dark:text-primary hover:bg-surface dark:hover:bg-surface-elevated"
                        to="/admin"
                        onClick={() => setMenuOpen(false)}
                      >
                        Admin panel
                      </Link>
                    )}
                    <Link
                      className="block rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-surface dark:hover:bg-surface-elevated"
                      to="/dashboard"
                      onClick={() => setMenuOpen(false)}
                    >
                      My dashboard
                    </Link>
                    <Link
                      className="block rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-surface dark:hover:bg-surface-elevated"
                      to="/dashboard/posts"
                      onClick={() => setMenuOpen(false)}
                    >
                      My posts
                    </Link>
                    <Link
                      className="block rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-surface dark:hover:bg-surface-elevated"
                      to="/dashboard/comments"
                      onClick={() => setMenuOpen(false)}
                    >
                      My comments
                    </Link>
                    <Link
                      className="block rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-surface dark:hover:bg-surface-elevated"
                      to="/dashboard/profile"
                      onClick={() => setMenuOpen(false)}
                    >
                      My profile
                    </Link>
                    <Link
                      className="block rounded-xl px-3.5 py-2 text-xs font-semibold hover:bg-surface dark:hover:bg-surface-elevated"
                      to="/dashboard/profile#password"
                      onClick={() => setMenuOpen(false)}
                    >
                      Change password
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2">
                    <Link
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-black/15 dark:border-white/15 bg-surface px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-paper dark:hover:bg-surface-elevated transition shadow-sm"
                      to="/login"
                      onClick={() => setMenuOpen(false)}
                    >
                      <LogIn size={16} />
                      <span>Log In</span>
                    </Link>
                    <Link
                      className="block w-full rounded-xl bg-moss dark:bg-primary px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider text-white dark:text-[#171B19] shadow-sm hover:bg-ink dark:hover:bg-primary/90"
                      to="/register"
                      onClick={() => setMenuOpen(false)}
                    >
                      Join the community
                    </Link>
                  </div>
                )}
              </nav>
            </div>

            {user && (
              <div className="border-t border-black/[.08] dark:border-white/[.08] pt-4">
                <button
                  className="flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleLogout();
                  }}
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>

        {/* Main Content Area */}
        <main className="page-wrap min-h-[65vh] py-8 sm:py-12 lg:py-14">
          {error && (
            <div className="mb-8">
              <Notice variant="info">{error}</Notice>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Contemporary Magazine Footer (4-Column Layout) */}
      <footer className="border-t border-black/[.08] dark:border-white/[.08] bg-surface transition-colors duration-200 mt-20">
        <div className="page-wrap py-14 lg:py-20">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
            {/* Column 1: Colophon & Masthead */}
            <div className="space-y-4">
              <Link to="/" className="inline-flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-xl bg-moss dark:bg-primary text-lime dark:text-[#171B19]">
                  <BookOpen size={18} />
                </span>
                <span className="font-display text-2xl font-bold tracking-tight text-ink">
                  Fieldnotes<span className="text-moss dark:text-primary">.</span>
                </span>
              </Link>
              <p className="text-xs font-normal leading-relaxed text-muted">
                An independent publication dedicated to thoughtful long-form storytelling, critical essays, design craft, and culture.
              </p>
              <div className="pt-2 text-[11px] font-bold uppercase tracking-widest text-moss dark:text-primary">
                Published with care &amp; independence
              </div>
            </div>

            {/* Column 2: Sections Navigation */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Sections</p>
              <ul className="space-y-2 text-xs font-semibold text-muted">
                <li>
                  <Link to="/blogs" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> All Stories
                  </Link>
                </li>
                <li>
                  <Link to="/categories" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Topic Categories
                  </Link>
                </li>
                <li>
                  <Link to="/tags" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Tag Archive
                  </Link>
                </li>
                <li>
                  <Link to="/blogs?sort=popular" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Reader Favorites
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: The Journal / Colophon Links */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss dark:text-primary">Fieldnotes Desk</p>
              <ul className="space-y-2 text-xs font-semibold text-muted">
                <li>
                  <Link to="/about" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Editorial Vision
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Send an Inquiry
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Write for Fieldnotes
                  </Link>
                </li>
                <li>
                  <a href="/sitemap.xml" className="hover:text-ink transition flex items-center gap-1.5">
                    <ArrowRight size={12} className="text-moss dark:text-primary" /> Public Sitemap
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Edition Colophon & Copyright */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Colophon</p>
              <p className="text-xs text-muted leading-relaxed">
                Typography set in <strong className="text-ink font-semibold">Playfair Display</strong> and <strong className="text-ink font-semibold">Inter</strong>. Rendered in adaptive light and dark modes.
              </p>
              <p className="pt-2 text-xs text-muted">
                © {new Date().getFullYear()} Fieldnotes Journal. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface AdminNavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

interface AdminNavGroup {
  heading: string;
  items: AdminNavItem[];
}

const adminNavGroups: AdminNavGroup[] = [
  {
    heading: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/admin/search-analytics", label: "Search Analytics", icon: BarChart3 },
    ],
  },
  {
    heading: "Content Management",
    items: [
      { to: "/admin/posts", label: "Stories & Posts", icon: Files },
      { to: "/admin/categories", label: "Categories", icon: FolderKanban },
      { to: "/admin/tags", label: "Topic Tags", icon: Tags },
      { to: "/admin/images", label: "Media Library", icon: FileImage },
    ],
  },
  {
    heading: "Community & Engagement",
    items: [
      { to: "/admin/comments", label: "Comments Moderation", icon: MessageSquareText },
      { to: "/admin/users", label: "User Accounts", icon: Users },
    ],
  },
  {
    heading: "Communication",
    items: [
      { to: "/admin/newsletter", label: "Newsletter Subscribers", icon: MailCheck },
      { to: "/admin/contacts", label: "Contact Inbox", icon: Mail },
    ],
  },
  {
    heading: "System & Governance",
    items: [
      { to: "/admin/seo", label: "SEO Metadata", icon: Search },
      { to: "/admin/settings", label: "Site Settings", icon: Settings },
    ],
  },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("admin_sidebar_collapsed", String(next));
      } catch {
        // no-op
      }
      return next;
    });
  }

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Escape key for keyboard accessibility (Phase 4)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile drawer and dropdown when route changes
  useEffect(() => {
    setMobileOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    const confirmed = await confirmAction({
      title: "Sign out of Admin Portal?",
      text: "Are you sure you want to end your administrative session?",
      confirmText: "Sign Out",
      cancelText: "Stay Signed In",
      icon: "question",
    });
    if (!confirmed) return;
    try {
      await logout();
      await showSuccess("Signed Out", "You have been safely signed out.", 1500);
      navigate("/");
    } catch {
      navigate("/login");
    }
  }

  // Compute dynamic breadcrumbs from location
  const currentBreadcrumb = (() => {
    const path = location.pathname;
    if (path === "/admin") return "Overview";
    if (path === "/admin/posts") return "Stories & Posts";
    if (path === "/admin/posts/new") return "Create Article";
    if (path.includes("/admin/posts/") && path.includes("/edit")) return "Edit Article";
    if (path === "/admin/categories") return "Categories";
    if (path === "/admin/tags") return "Topic Tags";
    if (path === "/admin/comments") return "Comments Moderation";
    if (path === "/admin/newsletter") return "Newsletter Subscribers";
    if (path === "/admin/contacts") return "Contact Inbox";
    if (path === "/admin/users") return "User Accounts";
    if (path === "/admin/images") return "Media Library";
    if (path === "/admin/seo") return "SEO Metadata";
    if (path === "/admin/settings") return "Site Settings";
    return "Administration";
  })();

  return (
    <div className="min-h-screen bg-paper dark:bg-background text-ink lg:flex transition-colors duration-200 overflow-x-hidden">
      {/* Mobile overlay backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-ink/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* ════════════════════════════════════════════════════════════════
          ADMIN SIDEBAR (Fixed on Desktop, Independent Scroll, Mobile Drawer)
      ════════════════════════════════════════════════════════════════ */}
      <aside
        role={mobileOpen ? "dialog" : "navigation"}
        aria-modal={mobileOpen ? "true" : undefined}
        aria-label="Editorial Control Center Navigation"
        className={`fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col bg-[#12231b] dark:bg-[#0e1a14] text-white transition-all duration-300 ease-in-out h-screen overflow-y-auto ${
          mobileOpen ? "translate-x-0 w-72 shadow-2xl" : "-translate-x-full lg:translate-x-0"
        } ${collapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        {/* Brand Header */}
        <div className={`flex h-[68px] shrink-0 items-center border-b border-white/[.08] px-4 transition-all ${
          collapsed ? "justify-center" : "justify-between"
        }`}>
          <Link
            to="/admin"
            className="flex items-center gap-2.5 overflow-hidden"
            onClick={() => setMobileOpen(false)}
            title="Fieldnotes Admin Dashboard"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime text-[#12231b] shadow-sm font-bold">
              <BookOpen size={18} />
            </span>
            {!collapsed && (
              <div className="flex items-center gap-2 truncate">
                <span className="font-display text-xl font-bold tracking-tight text-white">
                  Fieldnotes<span className="text-lime">.</span>
                </span>
                <span className="rounded-md bg-lime/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-lime">
                  CMS
                </span>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:grid size-7 place-items-center rounded-lg border border-white/10 text-white/50 hover:bg-white/[.08] hover:text-white transition"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Grouped Navigation */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto px-3 py-4 space-y-5">
          {adminNavGroups.map((group) => (
            <div key={group.heading} className="space-y-1">
              {!collapsed ? (
                <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  {group.heading}
                </p>
              ) : (
                <div className="mx-auto my-1 w-6 border-t border-white/10" />
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl py-2.5 text-[13px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${
                        collapsed ? "justify-center px-2" : "px-3"
                      } ${
                        isActive
                          ? "bg-lime/15 text-lime border-l-[3px] border-lime font-bold shadow-sm"
                          : "border-l-[3px] border-transparent text-white/70 hover:bg-white/[.07] hover:text-white"
                      }`
                    }
                  >
                    <Icon size={18} className="shrink-0 transition-transform duration-200 group-hover:scale-110" />
                    {!collapsed && <span className="truncate whitespace-nowrap">{label}</span>}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Action in Sidebar when expanded */}
        {!collapsed && (
          <div className="shrink-0 px-4 py-2">
            <Link
              to="/admin/posts/new"
              onClick={() => setMobileOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-3 py-2.5 text-xs font-bold text-[#12231b] shadow-sm transition hover:bg-white"
            >
              <PenLine size={14} />
              <span>Create New Story</span>
            </Link>
          </div>
        )}

        {/* User Profile Card in Sidebar Footer */}
        <div className="shrink-0 border-t border-white/[.08] p-3">
          <div className={`flex items-center rounded-xl bg-white/[.05] p-2 transition-all ${
            collapsed ? "justify-center" : "gap-3"
          }`}>
            <Link
              to="/dashboard/profile"
              onClick={() => setMobileOpen(false)}
              title="Admin Profile & Settings"
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lime/20 text-xs font-bold text-lime border border-lime/30">
                {user?.username?.slice(0, 1).toUpperCase() ?? "A"}
              </span>
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-white">{user?.username}</p>
                  <p className="truncate text-[10px] text-white/45">{user?.email}</p>
                </div>
              )}
            </Link>
            {!collapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out of CMS"
                className="grid size-7 place-items-center rounded-lg text-white/40 transition hover:bg-red-500/20 hover:text-red-300"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          ADMIN MAIN VIEW AREA
      ════════════════════════════════════════════════════════════════ */}
      <section className={`flex min-w-0 flex-1 flex-col overflow-x-hidden transition-all duration-300 ${
        collapsed ? "lg:pl-20" : "lg:pl-64"
      }`}>
        {/* Editorial Control Center Top Bar */}
        <header className="sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-black/[.08] dark:border-white/[.08] bg-surface/95 dark:bg-surface/95 backdrop-blur-md px-4 sm:px-8 transition-colors duration-200">
          {/* Left: Mobile Drawer Trigger + Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              aria-label="Open CMS navigation menu"
              className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 text-ink hover:bg-paper dark:hover:bg-surface-elevated transition lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={18} />
            </button>

            <div className="flex items-center gap-2 text-xs font-semibold text-muted min-w-0">
              <span className="font-extrabold uppercase tracking-wider text-moss dark:text-primary whitespace-nowrap hidden sm:inline">Admin CMS</span>
              <ChevronRight size={13} className="text-black/25 dark:text-white/25 hidden sm:inline shrink-0" />
              <span className="font-bold text-ink truncate">{currentBreadcrumb}</span>
            </div>
          </div>

          {/* Right: Quick actions, ThemeToggle, and Profile Dropdown */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Quick Action: New Post */}
            <Link
              to="/admin/posts/new"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-moss px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90"
            >
              <PenLine size={13} />
              <span>Write Story</span>
            </Link>

            {/* Quick Action: View Public Site */}
            <Link
              to="/"
              className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-moss hover:text-moss dark:hover:text-primary"
              title="Open public journal"
            >
              <span className="hidden md:inline">View Journal</span>
              <ArrowUpRight size={13} />
            </Link>

            {/* Theme Toggle Button */}
            <ThemeToggle size="sm" />

            {/* Admin Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-surface dark:bg-surface-elevated p-1 pr-2.5 transition hover:border-moss/40 focus:outline-none"
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
              >
                <span className="grid size-7 place-items-center rounded-full bg-moss text-xs font-bold text-white dark:bg-primary dark:text-[#171B19]">
                  {user?.username?.slice(0, 1).toUpperCase() ?? "A"}
                </span>
                <span className="hidden text-xs font-bold text-ink md:inline">{user?.username}</span>
                <ChevronDown size={13} className="text-muted" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-surface-elevated p-2 shadow-xl ring-1 ring-black/5 dark:ring-white/5 z-50">
                  <div className="border-b border-black/[.06] dark:border-white/[.06] px-3 py-2.5">
                    <p className="text-xs font-bold text-ink">{user?.username}</p>
                    <p className="truncate text-[11px] text-muted">{user?.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-moss/10 dark:bg-moss/20 px-2 py-0.5 text-[10px] font-bold text-moss dark:text-primary">
                      <Shield size={10} />
                      <span>ADMINISTRATOR</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink transition hover:bg-paper dark:hover:bg-surface"
                    >
                      <User size={14} className="text-muted" />
                      <span>Profile & Account Settings</span>
                    </Link>
                    <Link
                      to={`/author/${user?.username}`}
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink transition hover:bg-paper dark:hover:bg-surface"
                    >
                      <Sparkles size={14} className="text-muted" />
                      <span>My Public Author Page</span>
                    </Link>
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink transition hover:bg-paper dark:hover:bg-surface"
                    >
                      <LayoutDashboard size={14} className="text-muted" />
                      <span>Switch to Author Desk</span>
                    </Link>
                  </div>

                  <div className="border-t border-black/[.06] dark:border-white/[.06] pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Outlet */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-x-hidden">
          <div className="mx-auto max-w-[1440px]">
            <Suspense
              fallback={
                <div className="flex min-h-[40vh] items-center justify-center p-8">
                  <Loading />
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </section>
    </div>
  );
}

const userNavLinks = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/dashboard/posts", label: "My Stories", icon: Files, end: true },
  { to: "/dashboard/bookmarks", label: "Saved Stories", icon: Bookmark },
  { to: "/dashboard/posts/new", label: "Write Story", icon: PenLine },
  { to: "/dashboard/comments", label: "My Comments", icon: MessageSquareText },
  { to: "/dashboard/profile", label: "Profile & Settings", icon: Settings },
];

export function UserLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem("user_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("user_sidebar_collapsed", String(next));
      } catch {
        // no-op
      }
      return next;
    });
  }

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileDrawerOpen(false);
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Handle Escape key to close mobile drawer & dropdown
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
        setProfileDropdownOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  async function handleLogout() {
    const confirmed = await confirmAction({
      title: "Sign out of Fieldnotes?",
      text: "Are you sure you want to end your editorial session?",
      confirmText: "Sign Out",
      cancelText: "Stay Signed In",
      icon: "question",
    });
    if (!confirmed) return;
    try {
      await logout();
      await showSuccess("Signed Out", "You have been safely signed out.", 1500);
      navigate("/");
    } catch {
      navigate("/");
    }
  }

  // Derive breadcrumb label from current pathname
  const currentBreadcrumb = (() => {
    const path = location.pathname;
    if (path === "/dashboard") return "Overview";
    if (path === "/dashboard/posts/new") return "New Manuscript";
    if (path.includes("/dashboard/posts/") && path.includes("/edit")) return "Edit Manuscript";
    if (path === "/dashboard/posts") return "My Stories";
    if (path === "/dashboard/bookmarks") return "Saved Stories";
    if (path === "/dashboard/comments") return "Community Comments";
    if (path === "/dashboard/profile") return "Profile & Settings";
    return "Workspace";
  })();

  return (
    <div className="min-h-screen bg-paper dark:bg-background text-ink transition-colors duration-200">
      {/* ════════════════════════════════════════════════════════════════
          FIXED DESKTOP SIDEBAR (Fixed, Independent Scroll, Collapsible)
          ════════════════════════════════════════════════════════════════ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden lg:flex flex-col border-r border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-[#121614] text-ink transition-all duration-300 ease-in-out h-screen overflow-y-auto ${
          sidebarCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-black/[.08] dark:border-white/[.08] px-4 transition-all ${
            sidebarCollapsed ? "justify-center" : "justify-between"
          }`}
        >
          <Link
            to="/dashboard"
            className="flex items-center gap-2.5 overflow-hidden"
            title="Fieldnotes Creator Desk"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm font-bold">
              <BookOpen size={18} />
            </span>
            {!sidebarCollapsed && (
              <span className="font-display text-xl font-bold tracking-tight text-ink">
                Fieldnotes<span className="text-moss dark:text-primary">.</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:grid size-7 place-items-center rounded-lg border border-black/10 dark:border-white/10 text-muted hover:bg-paper dark:hover:bg-surface-elevated hover:text-ink transition"
          >
            {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="no-scrollbar flex flex-1 flex-col overflow-y-auto p-3 space-y-4">
          {!sidebarCollapsed ? (
            <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted">
              Creator Desk
            </p>
          ) : (
            <div className="mx-auto my-1 w-6 border-t border-black/10 dark:border-white/10" />
          )}

          <nav className="space-y-1">
            {userNavLinks.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={sidebarCollapsed ? label : undefined}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-2xl py-2.5 text-sm font-semibold transition ${
                    sidebarCollapsed ? "justify-center px-0" : "px-3.5"
                  } ${
                    isActive
                      ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                      : "text-muted hover:bg-paper dark:hover:bg-surface-elevated hover:text-ink"
                  }`
                }
              >
                <Icon size={18} className="shrink-0 transition-transform group-hover:scale-110" />
                {!sidebarCollapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* Publication Desk CTA */}
          {!sidebarCollapsed ? (
            <div className="rounded-2xl border border-moss/20 dark:border-primary/20 bg-moss/5 dark:bg-primary/10 p-3.5 shadow-sm mt-auto">
              <div className="flex items-center gap-2 text-moss dark:text-primary">
                <Sparkles size={15} />
                <span className="text-[11px] font-bold uppercase tracking-wider">Publication Desk</span>
              </div>
              <p className="mt-1 text-xs text-muted leading-relaxed">
                Ready to publish your insights? Craft an article and submit for review.
              </p>
              <Link
                to="/dashboard/posts/new"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-moss px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90"
              >
                <Plus size={13} /> Write Story
              </Link>
            </div>
          ) : (
            <Link
              to="/dashboard/posts/new"
              className="grid size-10 place-items-center rounded-xl bg-moss text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] mx-auto mt-auto"
              title="Write a new story"
            >
              <PenLine size={16} />
            </Link>
          )}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="shrink-0 border-t border-black/[.08] dark:border-white/[.08] p-3">
          <div
            className={`flex items-center rounded-xl bg-paper dark:bg-surface-elevated p-2 transition-all ${
              sidebarCollapsed ? "justify-center" : "gap-2.5"
            }`}
          >
            <Link
              to="/dashboard/profile"
              title="Profile & Settings"
              className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-moss/10 dark:bg-primary/20 text-xs font-bold text-moss dark:text-primary">
                {user?.username?.slice(0, 1).toUpperCase() ?? "U"}
              </span>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{user?.username}</p>
                  <p className="truncate text-[10px] text-muted">{user?.email}</p>
                </div>
              )}
            </Link>
            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-red-500/20 hover:text-red-500"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════════
          USER MAIN VIEW AREA (Offset by fixed sidebar on desktop)
          ════════════════════════════════════════════════════════════════ */}
      <div
        className={`flex min-w-0 flex-1 flex-col transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        {/* ════════════════════════════════════════════════════════════════
            1. TOP MAGAZINE EDITION TICKER
            ════════════════════════════════════════════════════════════════ */}
      <div className="border-b border-black/[.06] dark:border-white/[.06] bg-surface/50 dark:bg-surface-elevated/40 text-[11px] font-medium tracking-wide text-muted py-1.5 px-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold uppercase tracking-widest text-moss dark:text-primary">
              VOL. XXVI · AUTHOR WORKSPACE
            </span>
            <span className="hidden sm:inline text-black/20 dark:text-white/20">|</span>
            <span className="hidden sm:inline">
              Editorial Studio & Manuscript Desk
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1 font-semibold text-moss dark:text-primary hover:underline"
            >
              <span>View Public Journal</span>
              <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          2. TOP HEADER BAR
          ════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 border-b border-black/[.08] dark:border-white/[.08] bg-surface/95 backdrop-blur-md transition-colors duration-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Left: Mobile hamburger + Brand + Breadcrumbs */}
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-expanded={mobileDrawerOpen}
              aria-label="Open creator desk navigation"
              className="grid size-10 place-items-center rounded-xl border border-black/10 dark:border-white/10 text-ink transition hover:bg-paper dark:hover:bg-surface-elevated lg:hidden"
            >
              <Menu size={18} />
            </button>

            <Link to="/" className="group flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-xl bg-moss text-lime shadow-sm transition group-hover:scale-105">
                <BookOpen size={18} />
              </span>
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-ink">
                Fieldnotes<span className="text-moss dark:text-primary">.</span>
              </span>
            </Link>

            {/* Breadcrumb separator & page title */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-muted pl-4 border-l border-black/10 dark:border-white/10 min-w-0">
              <span className="uppercase tracking-wider whitespace-nowrap">Creator Desk</span>
              <ChevronRight size={13} className="text-muted/60 shrink-0" />
              <span className="text-ink font-bold truncate">{currentBreadcrumb}</span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            {/* Direct Write Story Button */}
            <Link
              to="/dashboard/posts/new"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-moss px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19] dark:hover:bg-primary/90"
            >
              <PenLine size={13} />
              <span>Write Story</span>
            </Link>

            {/* Admin Switcher Badge (if admin) */}
            {user?.role === "admin" && (
              <Link
                to="/admin"
                className="hidden md:inline-flex items-center gap-1 rounded-full border border-moss/30 bg-moss/5 dark:bg-moss/20 px-3 py-1 text-xs font-semibold text-moss dark:text-primary hover:bg-moss hover:text-white dark:hover:text-[#171B19] transition"
              >
                <Shield size={12} />
                <span>Admin Panel</span>
              </Link>
            )}

            {/* Theme Toggle */}
            <ThemeToggle size="sm" />

            {/* User Profile Dropdown Menu */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-black/10 dark:border-white/10 bg-surface p-1 pr-2.5 text-xs font-semibold text-ink shadow-sm transition hover:border-moss/40 hover:bg-paper dark:hover:bg-surface-elevated"
                aria-expanded={profileDropdownOpen}
                aria-label="User account menu"
              >
                <span className="grid size-7 place-items-center rounded-full bg-moss/10 dark:bg-primary/20 text-xs font-bold text-moss dark:text-primary">
                  {user?.username?.slice(0, 1).toUpperCase() ?? "U"}
                </span>
                <span className="hidden sm:inline max-w-[100px] truncate font-medium">
                  {user?.username}
                </span>
                <ChevronDown size={13} className="text-muted" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-black/[.08] dark:border-white/[.08] bg-surface p-2 shadow-xl animate-in fade-in zoom-in-95 duration-150 z-50">
                  {/* User Profile Summary */}
                  <div className="px-3 py-2.5 border-b border-black/[.06] dark:border-white/[.06] mb-1">
                    <p className="font-display text-sm font-bold text-ink truncate">{user?.username}</p>
                    <p className="text-xs text-muted truncate">{user?.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/30 dark:bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-moss dark:text-primary">
                      {user?.role}
                    </div>
                  </div>

                  {/* Dropdown Navigation Links */}
                  <div className="space-y-0.5 text-xs font-medium">
                    <Link
                      to="/dashboard"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-ink hover:bg-paper dark:hover:bg-surface-elevated transition"
                    >
                      <LayoutDashboard size={14} className="text-muted" />
                      <span>Author Overview</span>
                    </Link>
                    <Link
                      to="/dashboard/posts"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-ink hover:bg-paper dark:hover:bg-surface-elevated transition"
                    >
                      <Files size={14} className="text-muted" />
                      <span>My Stories</span>
                    </Link>
                    <Link
                      to="/dashboard/comments"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-ink hover:bg-paper dark:hover:bg-surface-elevated transition"
                    >
                      <MessageSquareText size={14} className="text-muted" />
                      <span>My Comments</span>
                    </Link>
                    <Link
                      to="/dashboard/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-ink hover:bg-paper dark:hover:bg-surface-elevated transition"
                    >
                      <Settings size={14} className="text-muted" />
                      <span>Profile & Settings</span>
                    </Link>

                    {user?.role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-moss dark:text-primary hover:bg-paper dark:hover:bg-surface-elevated transition border-t border-black/[.06] dark:border-white/[.06] mt-1 pt-2"
                      >
                        <Shield size={14} />
                        <span>Admin Control Panel</span>
                      </Link>
                    )}
                  </div>

                  {/* Sign Out Button */}
                  <div className="border-t border-black/[.06] dark:border-white/[.06] pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        void handleLogout();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-500/10 transition"
                    >
                      <LogOut size={14} />
                      <span>Sign out of desk</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

        {/* ════════════════════════════════════════════════════════════════
            3. MAIN OUTLET FOR USER PAGES
            ════════════════════════════════════════════════════════════════ */}
        <main className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8 flex-1">
          <Suspense
            fallback={
              <div className="flex min-h-[40vh] items-center justify-center p-8">
                <Loading />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          4. MOBILE SLIDE-OUT DRAWER
          ════════════════════════════════════════════════════════════════ */}
      <div
        role={mobileDrawerOpen ? "dialog" : undefined}
        aria-modal={mobileDrawerOpen ? "true" : undefined}
        aria-label="Creator Desk Navigation"
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          mobileDrawerOpen
            ? "visible opacity-100 pointer-events-auto"
            : "invisible opacity-0 pointer-events-none"
        }`}
      >
        {/* Backdrop blur */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />

        {/* Slide-out Menu Panel */}
        <div
          className={`relative flex h-full w-80 max-w-[85vw] flex-col justify-between border-r border-black/[.08] dark:border-white/[.08] bg-surface dark:bg-[#171B19] backdrop-blur-md p-6 shadow-2xl transition-transform duration-300 ${
            mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div>
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-black/[.08] dark:border-white/[.08] pb-4">
              <Link to="/" className="flex items-center gap-2.5" onClick={() => setMobileDrawerOpen(false)}>
                <span className="grid size-8 place-items-center rounded-lg bg-moss text-lime">
                  <BookOpen size={16} />
                </span>
                <span className="font-display text-xl font-bold text-ink">Fieldnotes.</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper dark:hover:bg-surface-elevated"
                aria-label="Close navigation drawer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Author Profile Quick Header */}
            <div className="my-5 rounded-2xl border border-black/[.06] dark:border-white/[.06] bg-paper/60 dark:bg-surface-elevated/60 p-3.5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-full bg-moss/10 dark:bg-primary/20 text-sm font-bold text-moss dark:text-primary">
                  {user?.username?.slice(0, 1).toUpperCase() ?? "U"}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-ink truncate">{user?.username}</p>
                  <p className="text-xs text-muted truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="space-y-1">
              <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                Author Navigation
              </p>
              {userNavLinks.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={() => setMobileDrawerOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? "bg-moss text-white dark:bg-primary dark:text-[#171B19] shadow-sm"
                        : "text-muted hover:bg-paper dark:hover:bg-surface-elevated hover:text-ink"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </NavLink>
              ))}

              {user?.role === "admin" && (
                <Link
                  to="/admin"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-moss dark:text-primary hover:bg-paper dark:hover:bg-surface-elevated transition mt-2"
                >
                  <Shield size={16} />
                  <span>Admin Control Panel</span>
                </Link>
              )}
            </nav>
          </div>

          {/* Drawer Footer Actions */}
          <div className="border-t border-black/[.08] dark:border-white/[.08] pt-4 space-y-3">
            <Link
              to="/dashboard/posts/new"
              onClick={() => setMobileDrawerOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-moss py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-ink dark:bg-primary dark:text-[#171B19]"
            >
              <PenLine size={14} /> Write Story
            </Link>
            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                void handleLogout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 py-2.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-500/10 transition"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
