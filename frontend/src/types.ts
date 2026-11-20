export type Role = "user" | "admin";

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  bio?: string | null;
  createdAt?: string;
  profileImagePath?: string | null;
}

export interface PageResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface Taxonomy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  imageId?: string | null;
  imagePath?: string | null;
  postCount?: number;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content?: string;
  publishedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  author: string;
  authorBio?: string | null;
  authorProfileImagePath?: string | null;
  category: string;
  categorySlug?: string;
  categoryId?: string;
  featuredImagePath?: string | null;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  tags?: Taxonomy[];
  status?: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED";
}

export interface SeoData {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
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
