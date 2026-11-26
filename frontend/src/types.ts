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
  isFeatured?: boolean;
  featuredOrder?: number;
  trendingScore?: number;
  views7d?: number;
}

export interface BookmarkedPost extends BlogPost {
  bookmarkId: string;
  bookmarkedAt: string;
}

export interface AuthorProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  profileImagePath: string | null;
  createdAt: string;
  publishedStoryCount: number;
}

export interface AuthorProfileData {
  author: AuthorProfile;
  posts: BlogPost[];
  pagination: {
    page: number;
    currentPage?: number;
    limit: number;
    total: number;
    totalRecords?: number;
    totalPages: number;
  };
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

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: "PENDING" | "SUBSCRIBED" | "UNSUBSCRIBED";
  subscribedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsletterStats {
  total: number;
  active: number;
  pending: number;
  unsubscribed: number;
}

export interface SearchAnalyticsSummary {
  totalSearches: number;
  uniqueTerms: number;
  zeroResultSearches: number;
  successfulSearches: number;
  zeroResultRate: number;
}

export interface SearchActivityTrendItem {
  date: string;
  total: number;
  zeroResults: number;
}

export interface TopSearchKeyword {
  normalizedQuery: string;
  term: string;
  searchCount: number;
  zeroResultsCount: number;
  lastSearchedAt: string;
}

export interface TopZeroResultKeyword {
  normalizedQuery: string;
  term: string;
  occurrences: number;
  lastCategory: string | null;
  lastSearchedAt: string;
}

export interface SearchCategoryBreakdown {
  category: string;
  count: number;
}

export interface SearchAnalyticsOverview {
  summary: SearchAnalyticsSummary;
  activityTrend: SearchActivityTrendItem[];
  topKeywords: TopSearchKeyword[];
  topZeroResultKeywords: TopZeroResultKeyword[];
  categoryBreakdown: SearchCategoryBreakdown[];
}

export interface SearchAnalyticsLogItem {
  id: string;
  searchQuery: string;
  normalizedQuery: string;
  categoryScope: string | null;
  resultsCount: number;
  hasResults: boolean;
  userId: string | null;
  createdAt: string;
}


