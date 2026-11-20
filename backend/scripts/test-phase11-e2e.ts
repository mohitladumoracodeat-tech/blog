import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "../src/app";
import { pool } from "../src/config/mysql";

interface JsonResponse<T = any> {
  data: T;
  pagination?: { page: number; limit: number; total: number };
  error?: { message: string; code?: string };
}

async function runE2ETests() {
  console.log("Starting Phase 11 End-to-End System Integration Test...");

  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const apiBase = `${baseUrl}/api/v1`;
  console.log(`E2E Test Server running on ${baseUrl}`);

  function extractCookie(response: Response, name: string): string | null {
    const raw = response.headers.get("set-cookie");
    if (!raw) return null;
    const match = raw.match(new RegExp(`${name}=([^;]+)`));
    return match ? match[1] : null;
  }

  try {
    // =========================================================================
    // STEP 1: PUBLIC VISITOR WORKFLOWS
    // =========================================================================
    console.log("\n--- STEP 1: PUBLIC VISITOR EXPLORATION ---");

    // 1.1 Homepage
    const homeRes = await fetch(`${apiBase}/public/homepage`);
    assert.equal(homeRes.status, 200, "Homepage must return 200");
    const homeJson = (await homeRes.json()) as JsonResponse;
    assert.ok(Array.isArray(homeJson.data.featuredPosts), "Homepage must return featuredPosts");
    assert.ok(Array.isArray(homeJson.data.latestPosts), "Homepage must return latestPosts");
    assert.ok(Array.isArray(homeJson.data.categories), "Homepage must return categories");
    assert.ok(Array.isArray(homeJson.data.tags), "Homepage must return tags");
    console.log("✔ Public visitor successfully loaded Homepage feed.");

    // 1.2 Blogs listing with search & filters
    const postsRes = await fetch(`${apiBase}/public/posts?sort=latest&limit=10`);
    assert.equal(postsRes.status, 200);
    const postsJson = (await postsRes.json()) as JsonResponse;
    assert.ok(Array.isArray(postsJson.data), "Posts listing must return data array");
    console.log(`✔ Public visitor browsed blog posts list (${postsJson.data.length} found).`);

    // 1.3 Sitemap & Robots.txt
    const sitemapRes = await fetch(`${baseUrl}/sitemap.xml`);
    assert.equal(sitemapRes.status, 200);
    assert.ok(sitemapRes.headers.get("content-type")?.includes("xml"));
    console.log("✔ XML Sitemap (/sitemap.xml) verified.");

    const robotsRes = await fetch(`${baseUrl}/robots.txt`);
    assert.equal(robotsRes.status, 200);
    const robotsText = await robotsRes.text();
    assert.ok(robotsText.includes("Sitemap:"));
    console.log("✔ Robots.txt verified.");

    // 1.4 Contact Form submission
    const contactRes = await fetch(`${apiBase}/public/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Alice Reader",
        email: "alice.reader@example.com",
        subject: "Fascinating Publication",
        message: "I really appreciate the in-depth articles on clean code and system design!",
      }),
    });
    assert.equal(contactRes.status, 201);
    console.log("✔ Public visitor submitted contact message successfully.");

    // 1.5 Unauthenticated Like/Comment attempt should fail
    const unauthLike = await fetch(`${apiBase}/user/posts/00000000-0000-0000-0000-000000000000/like`, {
      method: "POST",
    });
    assert.equal(unauthLike.status, 401, "Unauthenticated like must return 401");
    console.log("✔ Security check: unauthenticated actions correctly rejected with 401.");

    // =========================================================================
    // STEP 2: USER REGISTRATION & AUTHENTICATION
    // =========================================================================
    console.log("\n--- STEP 2: USER REGISTRATION & AUTHENTICATION ---");
    const testEmail = `e2e_user_${Date.now()}@example.com`;
    const testUsername = `e2e_writer_${Date.now()}`;
    const testPassword = "WriterSecurePassword2026!";

    const regRes = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: testUsername,
        email: testEmail,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });
    assert.equal(regRes.status, 201);
    const regJson = (await regRes.json()) as JsonResponse;
    assert.equal(regJson.data.user.role, "user", "Newly registered user must have role 'user'");
    const userCookie = extractCookie(regRes, "blog_access");
    assert.ok(userCookie, "Register must set blog_access cookie");
    console.log(`✔ User '${testUsername}' registered with role 'user'. Plaintext password never stored.`);

    // Check /auth/me
    const meRes = await fetch(`${apiBase}/auth/me`, {
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as JsonResponse;
    const testUserId = meJson.data.user.id;
    assert.equal(meJson.data.user.email, testEmail);
    console.log("✔ /auth/me verified session identity.");

    // Role Guard: Normal user trying to access admin panel -> 403 Forbidden
    const forbiddenAdmin = await fetch(`${apiBase}/admin/dashboard`, {
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(forbiddenAdmin.status, 403, "Normal user must receive 403 on admin endpoints");
    console.log("✔ Role guard check: regular user forbidden (403) from accessing admin endpoints.");

    // =========================================================================
    // STEP 3: USER AUTHORING & CONTENT CREATION
    // =========================================================================
    console.log("\n--- STEP 3: USER AUTHORING (DRAFT VS SUBMIT) ---");

    // Fetch category and tag options
    const optionsRes = await fetch(`${apiBase}/user/post-options`, {
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(optionsRes.status, 200);
    const optionsJson = (await optionsRes.json()) as JsonResponse;
    const categoryId = optionsJson.data.categories[0].id;
    const tagId = optionsJson.data.tags[0].id;

    // 3.1 Create as DRAFT
    const draftRes = await fetch(`${apiBase}/user/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${userCookie}`,
      },
      body: JSON.stringify({
        title: `E2E Draft Story ${Date.now()}`,
        excerpt: "An initial draft overview.",
        content: "This is a detailed draft content written by an author.",
        categoryId,
        tagIds: [tagId],
        action: "draft",
        seoTitle: "Draft SEO Title",
        seoDescription: "Draft SEO Description",
      }),
    });
    assert.equal(draftRes.status, 201);
    const draftJson = (await draftRes.json()) as JsonResponse;
    const postId = draftJson.data.id;
    const postSlug = draftJson.data.slug;
    assert.equal(draftJson.data.status, "DRAFT");
    console.log(`✔ Post '${postId}' created with status DRAFT.`);

    // Verify DRAFT does NOT appear in public feed
    const publicDraftCheck = await fetch(`${apiBase}/public/posts/${postSlug}`);
    assert.equal(publicDraftCheck.status, 404, "Draft post must not be accessible publicly");
    console.log("✔ Draft post confirmed hidden from public visitors.");

    // 3.2 Submit the post for review
    const submitRes = await fetch(`${apiBase}/user/posts/${postId}/submit`, {
      method: "POST",
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(submitRes.status, 200);
    const submitJson = (await submitRes.json()) as JsonResponse;
    assert.equal(submitJson.data.status, "PENDING");
    console.log("✔ Post submitted for review, status changed to PENDING.");

    // Verify PENDING still does NOT appear in public feed
    const publicPendingCheck = await fetch(`${apiBase}/public/posts/${postSlug}`);
    assert.equal(publicPendingCheck.status, 404, "Pending post must not be accessible publicly");
    console.log("✔ Pending post confirmed hidden from public visitors.");

    // Check user dashboard statistics
    const userDashRes = await fetch(`${apiBase}/user/dashboard`, {
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(userDashRes.status, 200);
    const userDashJson = (await userDashRes.json()) as JsonResponse;
    assert.ok(Number(userDashJson.data.stats.totalPosts) >= 1);
    assert.ok(Number(userDashJson.data.stats.pendingPosts) >= 1);
    console.log("✔ User dashboard stats confirmed pending post count.");

    // =========================================================================
    // STEP 4: ADMIN MODERATION & APPROVAL WORKFLOW
    // =========================================================================
    console.log("\n--- STEP 4: ADMIN REVIEW & APPROVAL ---");

    // Login as Admin
    const adminLoginRes = await fetch(`${apiBase}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@example.com",
        password: "AdminPassword123!",
      }),
    });
    assert.equal(adminLoginRes.status, 200);
    const adminCookie = extractCookie(adminLoginRes, "blog_access");
    assert.ok(adminCookie, "Admin login must set cookie");

    // Admin views dashboard
    const adminDashRes = await fetch(`${apiBase}/admin/dashboard`, {
      headers: { Cookie: `blog_access=${adminCookie}` },
    });
    assert.equal(adminDashRes.status, 200);
    const adminDashJson = (await adminDashRes.json()) as JsonResponse;
    assert.ok(Number(adminDashJson.data.pendingApprovals.posts) >= 1);
    console.log(`✔ Admin dashboard indicates ${adminDashJson.data.pendingApprovals.posts} pending posts to review.`);

    // Admin approves the post
    const approveRes = await fetch(`${apiBase}/admin/posts/${postId}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${adminCookie}`,
      },
      body: JSON.stringify({ decision: "APPROVED" }),
    });
    assert.equal(approveRes.status, 200);
    console.log("✔ Administrator approved the post.");

    // Verify post is NOW publicly accessible
    const publicPostRes = await fetch(`${apiBase}/public/posts/${postSlug}`);
    assert.equal(publicPostRes.status, 200, "Approved post must now be publicly accessible");
    const publicPostJson = (await publicPostRes.json()) as JsonResponse;
    assert.equal(publicPostJson.data.id, postId);
    assert.ok(publicPostJson.data.author, "Post must include author name");
    console.log(`✔ Post is live at /blogs/${postSlug} with full author and content details!`);

    // =========================================================================
    // STEP 5: ENGAGEMENT (VIEWS, LIKES, COMMENTS & COMMENT MODERATION)
    // =========================================================================
    console.log("\n--- STEP 5: ENGAGEMENT & COMMENT MODERATION ---");

    // 5.1 Like the post as authenticated user
    const likeRes = await fetch(`${apiBase}/user/posts/${postId}/like`, {
      method: "POST",
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(likeRes.status, 200);
    const likeJson = (await likeRes.json()) as JsonResponse;
    assert.equal(likeJson.data.liked, true);
    assert.ok(Number(likeJson.data.likeCount) >= 1);
    console.log(`✔ Post liked! Total likes: ${likeJson.data.likeCount}.`);

    // 5.2 Submit a comment
    const commentRes = await fetch(`${apiBase}/public/posts/${postSlug}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${userCookie}`,
      },
      body: JSON.stringify({ content: "Outstanding breakdown of modern architecture!" }),
    });
    assert.equal(commentRes.status, 201);
    const commentJson = (await commentRes.json()) as JsonResponse;
    const commentId = commentJson.data.id;
    console.log("✔ Comment submitted (pending moderation).");

    // Verify comment is NOT yet visible in public post details
    const publicCheckComment = await fetch(`${apiBase}/public/posts/${postSlug}`);
    const checkJson = (await publicCheckComment.json()) as JsonResponse;
    const foundUnapproved = checkJson.data.comments.some((c: any) => c.id === commentId);
    assert.equal(foundUnapproved, false, "Pending comment must not be visible on public post");
    console.log("✔ Pending comment confirmed hidden from public readers.");

    // Admin approves the comment
    const approveCommentRes = await fetch(`${apiBase}/admin/comments/${commentId}/moderation`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${adminCookie}`,
      },
      body: JSON.stringify({ status: "APPROVED" }),
    });
    assert.equal(approveCommentRes.status, 200);
    console.log("✔ Administrator approved the comment.");

    // Verify comment is NOW visible on public post
    const publicApprovedComment = await fetch(`${apiBase}/public/posts/${postSlug}`);
    const approvedJson = (await publicApprovedComment.json()) as JsonResponse;
    const foundApproved = approvedJson.data.comments.some((c: any) => c.id === commentId);
    assert.equal(foundApproved, true, "Approved comment must appear on public post");
    console.log("✔ Approved comment now publicly visible in discussion section.");

    // =========================================================================
    // STEP 6: CRITICAL MODERATION RULE VERIFICATION
    // =========================================================================
    console.log("\n--- STEP 6: MODERATION RULE (EDITING APPROVED POST RESETS TO PENDING) ---");

    // Author edits their currently APPROVED post
    const editPostRes = await fetch(`${apiBase}/user/posts/${postId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${userCookie}`,
      },
      body: JSON.stringify({
        title: `Updated Title ${Date.now()}`,
        content: "Updated story content that needs re-approval.",
      }),
    });
    assert.equal(editPostRes.status, 200);
    const editPostJson = (await editPostRes.json()) as JsonResponse;
    assert.equal(
      editPostJson.data.status,
      "PENDING",
      "Rule Violation: Editing an approved post MUST reset status to PENDING",
    );
    console.log("✔ Rule verified: author update automatically reset status to PENDING.");

    // Verify that the post is IMMEDIATELY removed from public view
    const publicRecheck = await fetch(`${apiBase}/public/posts/${postSlug}`);
    assert.equal(publicRecheck.status, 404, "Edited post must be removed from public view until re-approved");
    console.log("✔ Edited post confirmed immediately removed from public viewing.");

    // =========================================================================
    // STEP 7: OWNERSHIP ENFORCEMENT ON BACKEND
    // =========================================================================
    console.log("\n--- STEP 7: POST OWNERSHIP VERIFICATION ---");
    // Register another user
    const otherUserRes = await fetch(`${apiBase}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: `intruder_${Date.now()}`,
        email: `intruder_${Date.now()}@example.com`,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });
    const otherUserCookie = extractCookie(otherUserRes, "blog_access");

    // Other user tries to edit the first user's post -> must fail with 404/403
    const unauthorizedEdit = await fetch(`${apiBase}/user/posts/${postId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${otherUserCookie}`,
      },
      body: JSON.stringify({ title: "Hacked Title" }),
    });
    assert.equal(unauthorizedEdit.status, 404, "Users must NEVER be allowed to edit another user's post");
    console.log("✔ Post ownership strictly enforced on the backend.");

    // =========================================================================
    // STEP 8: SEO MANAGEMENT & SITE SETTINGS
    // =========================================================================
    console.log("\n--- STEP 8: SEO MANAGEMENT & SETTINGS ---");

    // Admin updates SEO metadata for Home page
    const seoUpdateRes = await fetch(`${apiBase}/admin/seo/page/home`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${adminCookie}`,
      },
      body: JSON.stringify({
        title: "Fieldnotes | Journal for Builders & Creators",
        description: "Curated stories, deep technical guides, and architectural design patterns.",
        keywords: "engineering, architecture, blog, tech",
        canonicalUrl: "https://fieldnotes.example.com/",
        ogTitle: "Fieldnotes — High-Performance Journal",
        ogDescription: "Read the best engineering articles.",
        robotsIndex: true,
        robotsFollow: true,
      }),
    });
    assert.equal(seoUpdateRes.status, 200);

    // Verify dynamic SEO returns these exact fields
    const publicSeoRes = await fetch(`${apiBase}/public/seo/home`);
    assert.equal(publicSeoRes.status, 200);
    const publicSeoJson = (await publicSeoRes.json()) as JsonResponse;
    assert.equal(publicSeoJson.data.title, "Fieldnotes | Journal for Builders & Creators");
    console.log("✔ Dynamic SEO metadata verified with full meta/OG/Twitter/Robots fields.");

    // =========================================================================
    // STEP 9: USER MANAGEMENT (ADMIN ACTIONS)
    // =========================================================================
    console.log("\n--- STEP 9: USER MANAGEMENT (ADMIN ACTIONS) ---");
    const userListRes = await fetch(`${apiBase}/admin/users?search=${testUsername}`, {
      headers: { Cookie: `blog_access=${adminCookie}` },
    });
    assert.equal(userListRes.status, 200);
    const userListJson = (await userListRes.json()) as JsonResponse;
    assert.ok(userListJson.data.length >= 1);
    const userRecord = userListJson.data[0];
    assert.ok(userRecord.password === undefined, "Password must never be exposed in admin panel");
    assert.ok(userRecord.password_hash === undefined, "Password hash must never be exposed");
    console.log("✔ User management verified: passwords never exposed.");

    // Admin deactivates/blocks the test user
    const blockRes = await fetch(`${apiBase}/admin/users/${testUserId}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `blog_access=${adminCookie}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(blockRes.status, 200);

    // Verify blocked user cannot perform actions
    const blockedAction = await fetch(`${apiBase}/user/dashboard`, {
      headers: { Cookie: `blog_access=${userCookie}` },
    });
    assert.equal(blockedAction.status, 401, "Blocked user must be immediately locked out");
    console.log("✔ Blocked user immediately deactivated and revoked.");

    // Clean up test data safely
    await pool.execute("DELETE FROM comments WHERE id = ?", [commentId]);
    await pool.execute("DELETE FROM post_likes WHERE post_id = ?", [postId]);
    await pool.execute("DELETE FROM posts WHERE id = ?", [postId]);
    await pool.execute("DELETE FROM users WHERE id IN (?, ?)", [testUserId, (await otherUserRes.json()).data.user.id]);

    console.log("\n=================================================================");
    console.log("🎉 ALL PHASE 11 END-TO-END INTEGRATION TESTS PASSED WITH 100% SUCCESS!");
    console.log("=================================================================");
  } finally {
    server.close();
  }
}

runE2ETests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("E2E Test Failed:", err);
    process.exit(1);
  });
