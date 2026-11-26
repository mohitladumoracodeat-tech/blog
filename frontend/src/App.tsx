import { Suspense, lazy } from "react";
import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AdminLayout, PublicLayout, UserLayout } from "./components/Layouts";
import { Loading, Notice } from "./components/UI";
import {
  AboutPage,
  AuthPage,
  AuthorProfilePage,
  BlogDetailPage,
  BlogListPage,
  CategoryPage,
  ContactPage,
  ForgotPasswordPage,
  HomePage,
  NewsletterUnsubscribePage,
  NewsletterVerifyPage,
  NotFoundPage,
  ResetPasswordPage,
  TaxonomyListPage,
} from "./pages/PublicPages";

// User Route Components (Lazy Loaded)
const DashboardPage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.DashboardPage })));
const PostListPage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.PostListPage })));
const SavedStoriesPage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.SavedStoriesPage })));
const PostEditorPage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.PostEditorPage })));
const UserCommentsPage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.UserCommentsPage })));
const ProfilePage = lazy(() => import("./pages/UserPages").then((m) => ({ default: m.ProfilePage })));

// Admin Route Components (Lazy Loaded)
const AdminDashboardPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminDashboardPage })));
const AdminPostsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminPostsPage })));
const AdminTaxonomyPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminTaxonomyPage })));
const AdminCommentsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminCommentsPage })));
const AdminNewsletterPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminNewsletterPage })));
const AdminSearchAnalyticsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminSearchAnalyticsPage })));
const AdminContactsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminContactsPage })));
const AdminUsersPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminUsersPage })));
const AdminImagesPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminImagesPage })));
const AdminSettingsPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminSettingsPage })));
const AdminSeoPage = lazy(() => import("./pages/AdminPages").then((m) => ({ default: m.AdminSeoPage })));

function Protected({ children, admin = false }: { children: ReactElement; admin?: boolean }) {
  const { user, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (error) return <div className="page-wrap py-16"><Notice>{error}</Notice></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center p-8">
          <Loading />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="blogs" element={<BlogListPage />} />
        <Route path="blogs/:slug" element={<BlogDetailPage />} />
        <Route path="categories" element={<TaxonomyListPage kind="categories" />} />
        <Route path="category/:slug" element={<CategoryPage kind="categories" />} />
        <Route path="tags" element={<TaxonomyListPage kind="tags" />} />
        <Route path="tag/:slug" element={<CategoryPage kind="tags" />} />
        <Route path="author/:username" element={<AuthorProfilePage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route path="newsletter/verify" element={<NewsletterVerifyPage />} />
        <Route path="newsletter/unsubscribe" element={<NewsletterUnsubscribePage />} />
      </Route>
      <Route path="dashboard" element={<Protected><UserLayout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="posts" element={<PostListPage />} />
        <Route path="bookmarks" element={<SavedStoriesPage />} />
        <Route path="posts/new" element={<PostEditorPage />} />
        <Route path="posts/:id/edit" element={<PostEditorPage />} />
        <Route path="comments" element={<UserCommentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<ProfilePage />} />
      </Route>
      <Route path="admin" element={<Protected admin><AdminLayout /></Protected>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="posts" element={<AdminPostsPage />} />
        <Route path="posts/new" element={<PostEditorPage admin />} />
        <Route path="posts/:id/edit" element={<PostEditorPage admin />} />
        <Route path="categories" element={<AdminTaxonomyPage kind="categories" />} />
        <Route path="tags" element={<AdminTaxonomyPage kind="tags" />} />
        <Route path="comments" element={<AdminCommentsPage />} />
        <Route path="newsletter" element={<AdminNewsletterPage />} />
        <Route path="search-analytics" element={<AdminSearchAnalyticsPage />} />
        <Route path="contacts" element={<AdminContactsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="images" element={<AdminImagesPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="seo" element={<AdminSeoPage />} />
      </Route>
      <Route path="*" element={<PublicLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
