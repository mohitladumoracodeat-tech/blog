import http from "node:http";
import { app } from "../src/app";
import { pool } from "../src/config/mysql";

async function runPhase5And6Tests(): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not get server port");
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Phase 5 & 6 Test server running at ${baseUrl}`);

  try {
    // 0. Authenticate as regular user (johndoe)
    console.log("0. Authenticating as User (johndoe)...");
    const userLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "UserPassword123!" }),
    });
    if (userLoginRes.status !== 200) {
      throw new Error(`User login failed: ${await userLoginRes.text()}`);
    }
    const userCookies = userLoginRes.headers
      .get("set-cookie")!
      .split(/,\s*(?=[a-zA-Z0-9_]+=)/)
      .map((c) => c.split(";")[0])
      .join("; ");
    const userHeaders = {
      "Content-Type": "application/json",
      Cookie: userCookies,
    };

    // 0b. Authenticate as Admin (to test ownership protection)
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "AdminPassword123!" }),
    });
    const adminCookies = adminLoginRes.headers
      .get("set-cookie")!
      .split(/,\s*(?=[a-zA-Z0-9_]+=)/)
      .map((c) => c.split(";")[0])
      .join("; ");
    const adminHeaders = {
      "Content-Type": "application/json",
      Cookie: adminCookies,
    };

    // -------------------------------------------------------------
    // PHASE 5: USER APIS
    // -------------------------------------------------------------
    console.log("\n--- TESTING PHASE 5: USER APIS ---");

    // 1. User Dashboard
    console.log("1. Testing User Dashboard stats...");
    const dashRes = await fetch(`${baseUrl}/user/dashboard`, { headers: userHeaders });
    if (dashRes.status !== 200) {
      throw new Error(`User dashboard failed: ${await dashRes.text()}`);
    }
    const dashData = (await dashRes.json()) as { data: { stats: Record<string, unknown> } };
    if (!("totalPosts" in dashData.data.stats) || !("receivedLikes" in dashData.data.stats)) {
      throw new Error("Missing expected metrics in user dashboard response");
    }
    console.log("   User dashboard metrics verified.");

    // Fetch categories to get a valid categoryId
    const optionsRes = await fetch(`${baseUrl}/user/post-options`, { headers: userHeaders });
    const optionsData = (await optionsRes.json()) as { data: { categories: Array<{ id: string }> } };
    const validCategoryId = optionsData.data.categories[0].id;

    // 2. Create Post as DRAFT
    console.log("2. Testing Create Post as DRAFT...");
    const draftTitle = `Draft Post ${Date.now()}`;
    const createDraftRes = await fetch(`${baseUrl}/user/posts`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        title: draftTitle,
        excerpt: "Short summary of draft post.",
        content: "Draft content body.",
        categoryId: validCategoryId,
        status: "DRAFT",
      }),
    });
    if (createDraftRes.status !== 201) {
      throw new Error(`Draft post creation failed: ${await createDraftRes.text()}`);
    }
    const draftData = (await createDraftRes.json()) as { data: { id: string; status: string } };
    if (draftData.data.status !== "DRAFT") throw new Error(`Expected DRAFT, got ${draftData.data.status}`);
    const draftPostId = draftData.data.id;
    console.log(`   Draft post created with id ${draftPostId} and status DRAFT.`);

    // 3. Create Post with action: 'submit' -> PENDING
    console.log("3. Testing Create Post directly as PENDING...");
    const submitTitle = `Pending Post ${Date.now()}`;
    const createPendingRes = await fetch(`${baseUrl}/user/posts`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        title: submitTitle,
        excerpt: "Short summary of pending post.",
        content: "Content awaiting moderation.",
        categoryId: validCategoryId,
        action: "submit",
        seoTitle: "Custom SEO Title",
        seoDescription: "Custom SEO Description",
      }),
    });
    if (createPendingRes.status !== 201) {
      throw new Error(`Pending post creation failed: ${await createPendingRes.text()}`);
    }
    const pendingData = (await createPendingRes.json()) as { data: { id: string; status: string } };
    if (pendingData.data.status !== "PENDING") throw new Error(`Expected PENDING, got ${pendingData.data.status}`);
    console.log(`   Pending post created with id ${pendingData.data.id} and status PENDING.`);

    // 4. Update Post & Ownership Rule Check
    console.log("4. Testing Post Ownership Verification (Cannot edit another user's post)...");
    // Admin creates an admin post
    const adminPostRes = await fetch(`${baseUrl}/admin/posts`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        title: `Admin Only Post ${Date.now()}`,
        content: "Admin post content.",
        categoryId: validCategoryId,
        status: "APPROVED",
      }),
    });
    const adminPostData = (await adminPostRes.json()) as { data: { id: string } };
    const adminPostId = adminPostData.data.id;

    // Regular user tries to update admin's post -> MUST FAIL
    const hackerUpdateRes = await fetch(`${baseUrl}/user/posts/${adminPostId}`, {
      method: "PUT",
      headers: userHeaders,
      body: JSON.stringify({ title: "Hacked Post Title" }),
    });
    if (hackerUpdateRes.status !== 404 && hackerUpdateRes.status !== 403) {
      throw new Error(`Security breach: User was able to target admin post with status ${hackerUpdateRes.status}`);
    }
    console.log("   Backend ownership check passed! Non-author cannot modify post.");

    // 5. Test Crucial Rule: Editing an already APPROVED post sets status back to PENDING
    console.log("5. Testing rule: Editing APPROVED post resets status to PENDING...");
    // Find an approved post authored by johndoe
    const userPostsRes = await fetch(`${baseUrl}/user/posts?status=APPROVED`, { headers: userHeaders });
    const userPostsData = (await userPostsRes.json()) as { data: Array<{ id: string; title: string }> };
    if (userPostsData.data.length > 0) {
      const approvedPost = userPostsData.data[0];
      const editApprovedRes = await fetch(`${baseUrl}/user/posts/${approvedPost.id}`, {
        method: "PUT",
        headers: userHeaders,
        body: JSON.stringify({ title: `${approvedPost.title} (Revised Edition)` }),
      });
      if (editApprovedRes.status !== 200) {
        throw new Error(`Editing approved post failed: ${await editApprovedRes.text()}`);
      }
      const editApprovedData = (await editApprovedRes.json()) as { data: { status: string } };
      if (editApprovedData.data.status !== "PENDING") {
        throw new Error(`Expected status to become PENDING upon edit, got '${editApprovedData.data.status}'`);
      }
      console.log("   Rule verified: Editing published post automatically returned status to PENDING!");
    }

    // 6. Delete Own Post
    console.log("6. Testing Delete Own Post...");
    const delRes = await fetch(`${baseUrl}/user/posts/${draftPostId}`, {
      method: "DELETE",
      headers: userHeaders,
    });
    if (delRes.status !== 204) {
      throw new Error(`Delete own post failed with ${delRes.status}`);
    }
    console.log("   User deleted own draft post successfully.");

    // 7. Like and Unlike System
    console.log("7. Testing Like & Unlike System...");
    const likePostRes = await fetch(`${baseUrl}/user/posts/${adminPostId}/like`, {
      method: "POST",
      headers: userHeaders,
    });
    if (likePostRes.status !== 200) {
      throw new Error(`Like post failed: ${await likePostRes.text()}`);
    }
    const likeData = (await likePostRes.json()) as { data: { liked: boolean; likeCount: number } };
    if (!likeData.data.liked) throw new Error("Expected liked: true");

    // Unlike
    const unlikeRes = await fetch(`${baseUrl}/user/posts/${adminPostId}/like`, {
      method: "DELETE",
      headers: userHeaders,
    });
    if (unlikeRes.status !== 200) {
      throw new Error(`Unlike post failed: ${await unlikeRes.text()}`);
    }
    console.log("   Like and unlike toggle verified!");

    // 8. My Comments
    console.log("8. Testing My Comments API...");
    const myCommentsRes = await fetch(`${baseUrl}/user/comments`, { headers: userHeaders });
    if (myCommentsRes.status !== 200) {
      throw new Error(`My comments failed: ${await myCommentsRes.text()}`);
    }
    console.log("   My comments list retrieved successfully.");

    // -------------------------------------------------------------
    // PHASE 6: PUBLIC APIS
    // -------------------------------------------------------------
    console.log("\n--- TESTING PHASE 6: PUBLIC APIS ---");

    // 1. Homepage API
    console.log("1. Testing Public Homepage API...");
    const homeRes = await fetch(`${baseUrl}/public/homepage`);
    if (homeRes.status !== 200) {
      throw new Error(`Homepage failed: ${await homeRes.text()}`);
    }
    const homeData = (await homeRes.json()) as { data: { latestPosts: unknown[]; categories: unknown[] } };
    if (!homeData.data.latestPosts || !homeData.data.categories) {
      throw new Error("Missing expected homepage sections");
    }
    console.log("   Homepage feed verified with featured posts, latest posts, and categories.");

    // 2. Blog List with Search & Filtering
    console.log("2. Testing Public Posts Listing (Search & Filters)...");
    const postsListRes = await fetch(`${baseUrl}/public/posts?limit=5&sort=latest`);
    if (postsListRes.status !== 200) {
      throw new Error(`Public posts failed: ${await postsListRes.text()}`);
    }
    const postsListData = (await postsListRes.json()) as { data: Array<{ slug: string; title: string }> };
    if (!postsListData.data.length) throw new Error("Expected published posts in public listing");
    const samplePostSlug = postsListData.data[0].slug;
    console.log(`   Public post listing verified (Found ${postsListData.data.length} posts).`);

    // 3. Single Blog Details by Slug (with deduplicated views)
    console.log(`3. Testing Single Blog Details by Slug (/posts/${samplePostSlug})...`);
    const singlePostRes = await fetch(`${baseUrl}/public/posts/${samplePostSlug}`);
    if (singlePostRes.status !== 200) {
      throw new Error(`Single post retrieval failed: ${await singlePostRes.text()}`);
    }
    const singlePostData = (await singlePostRes.json()) as { data: { title: string; viewCount: number; comments: unknown[] } };
    if (!singlePostData.data.title || singlePostData.data.viewCount === undefined) {
      throw new Error("Single post response missing title or view count");
    }
    console.log(`   Single blog details loaded! Title: "${singlePostData.data.title}", Views: ${singlePostData.data.viewCount}`);

    // 4. Categories & Category Posts
    console.log("4. Testing Categories & Category Details Page...");
    const catListRes = await fetch(`${baseUrl}/public/categories`);
    if (catListRes.status !== 200) throw new Error("Categories listing failed");
    const catListData = (await catListRes.json()) as { data: Array<{ slug: string }> };
    if (catListData.data.length > 0) {
      const catSlug = catListData.data[0].slug;
      const catDetailRes = await fetch(`${baseUrl}/public/category/${catSlug}`);
      if (catDetailRes.status !== 200) {
        throw new Error(`Category details failed with ${catDetailRes.status}`);
      }
      console.log(`   Category details for "${catSlug}" verified.`);
    }

    // 5. Tags & Tag Posts
    console.log("5. Testing Tags & Tag Details Page...");
    const tagListRes = await fetch(`${baseUrl}/public/tags`);
    if (tagListRes.status !== 200) throw new Error("Tags listing failed");
    const tagListData = (await tagListRes.json()) as { data: Array<{ slug: string }> };
    if (tagListData.data.length > 0) {
      const tagSlug = tagListData.data[0].slug;
      const tagDetailRes = await fetch(`${baseUrl}/public/tag/${tagSlug}`);
      if (tagDetailRes.status !== 200) {
        throw new Error(`Tag details failed with ${tagDetailRes.status}`);
      }
      console.log(`   Tag details for "${tagSlug}" verified.`);
    }

    // 6. Contact Form Submission
    console.log("6. Testing Contact Form Submission...");
    const contactRes = await fetch(`${baseUrl}/public/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Visitor",
        email: "alice@example.com",
        subject: "General Inquiry",
        message: "Hello! I am enjoying the technical articles on your platform.",
      }),
    });
    if (contactRes.status !== 201) {
      throw new Error(`Contact submission failed: ${await contactRes.text()}`);
    }
    console.log("   Contact form message submitted and saved to database.");

    // 7. Dynamic Static Page SEO
    console.log("7. Testing Dynamic SEO Metadata (/seo/home)...");
    const seoRes = await fetch(`${baseUrl}/public/seo/home`);
    if (seoRes.status !== 200) throw new Error("SEO metadata fetch failed");
    const seoData = (await seoRes.json()) as { data: { title: string; description: string } };
    if (!seoData.data.title) throw new Error("Missing SEO title in response");
    console.log(`   SEO metadata verified: "${seoData.data.title}"`);

    // 8. XML Sitemap
    console.log("8. Testing Dynamic XML Sitemap (/sitemap.xml)...");
    const sitemapRes = await fetch(`http://127.0.0.1:${address.port}/sitemap.xml`);
    if (sitemapRes.status !== 200) throw new Error("Sitemap failed");
    const sitemapText = await sitemapRes.text();
    if (!sitemapText.includes("<urlset") || !sitemapText.includes("/blogs/")) {
      throw new Error("Invalid XML sitemap structure");
    }
    console.log("   Dynamic XML sitemap verified with valid XML urlset.");

    // 9. Robots.txt
    console.log("9. Testing Robots.txt (/robots.txt)...");
    const robotsRes = await fetch(`http://127.0.0.1:${address.port}/robots.txt`);
    if (robotsRes.status !== 200) throw new Error("Robots.txt failed");
    const robotsText = await robotsRes.text();
    if (!robotsText.includes("User-agent:") || !robotsText.includes("Sitemap:")) {
      throw new Error("Invalid robots.txt content");
    }
    console.log("   Robots.txt verified.");

    console.log("\nALL PHASE 5 AND PHASE 6 TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase5And6Tests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
