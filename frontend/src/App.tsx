import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "./auth/AuthContext";
import { AdminLayout, PublicLayout, UserLayout } from "./components/Layouts";
import { Loading, Notice } from "./components/UI";
import { AboutPage, AuthPage, BlogDetailPage, BlogListPage, CategoryPage, ContactPage, ForgotPasswordPage, HomePage, NotFoundPage, ResetPasswordPage, TaxonomyListPage } from "./pages/PublicPages";
import { DashboardPage, PostEditorPage, PostListPage, ProfilePage, UserCommentsPage } from "./pages/UserPages";
import { AdminCommentsPage, AdminContactsPage, AdminDashboardPage, AdminImagesPage, AdminPostsPage, AdminSeoPage, AdminTaxonomyPage, AdminUsersPage, AdminSettingsPage } from "./pages/AdminPages";

function Protected({ children, admin = false }: { children: ReactElement; admin?: boolean }) {
  const { user, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (error) return <div className="page-wrap py-16"><Notice>{error}</Notice></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
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
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>
      <Route path="dashboard" element={<Protected><UserLayout /></Protected>}>
        <Route index element={<DashboardPage />} />
        <Route path="posts" element={<PostListPage />} />
        <Route path="posts/new" element={<PostEditorPage />} />
        <Route path="posts/:id/edit" element={<PostEditorPage />} />
        <Route path="comments" element={<UserCommentsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="admin" element={<Protected admin><AdminLayout /></Protected>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="posts" element={<AdminPostsPage />} />
        <Route path="posts/new" element={<PostEditorPage admin />} />
        <Route path="posts/:id/edit" element={<PostEditorPage admin />} />
        <Route path="categories" element={<AdminTaxonomyPage kind="categories" />} />
        <Route path="tags" element={<AdminTaxonomyPage kind="tags" />} />
        <Route path="comments" element={<AdminCommentsPage />} />
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
