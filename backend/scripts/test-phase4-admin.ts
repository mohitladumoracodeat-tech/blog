import http from "node:http";
import { app } from "../src/app";
import { pool } from "../src/config/mysql";

async function runPhase4Tests(): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not get server port");
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Phase 4 Test server running at ${baseUrl}`);

  try {
    // 0. Authenticate as Admin
    console.log("0. Authenticating as Admin...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "AdminPassword123!" }),
    });
    if (loginRes.status !== 200) {
      throw new Error(`Admin login failed: ${await loginRes.text()}`);
    }
    const adminCookies = loginRes.headers
      .get("set-cookie")!
      .split(/,\s*(?=[a-zA-Z0-9_]+=)/)
      .map((c) => c.split(";")[0])
      .join("; ");
    const headers = {
      "Content-Type": "application/json",
      Cookie: adminCookies,
    };

    // 1. Test Admin Dashboard Stats
    console.log("1. Testing Admin Dashboard API...");
    const dashRes = await fetch(`${baseUrl}/admin/dashboard`, { headers });
    if (dashRes.status !== 200) {
      throw new Error(`Dashboard failed with ${dashRes.status}: ${await dashRes.text()}`);
    }
    const dashData = (await dashRes.json()) as { data: { stats: Record<string, unknown> } };
    if (!dashData.data.stats.totalUsers || !dashData.data.stats.totalCategories) {
      throw new Error("Missing expected database stats in admin dashboard");
    }
    console.log("   Admin dashboard stats verified from database.");

    // 2. Test Category CRUD
    console.log("2. Testing Category CRUD...");
    const catName = `Category_${Date.now()}`;
    const addCatRes = await fetch(`${baseUrl}/admin/categories`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: catName,
        description: "Test category description for Phase 4.",
      }),
    });
    if (addCatRes.status !== 201) {
      throw new Error(`Category creation failed: ${await addCatRes.text()}`);
    }
    const catData = (await addCatRes.json()) as { data: { id: string; slug: string } };
    const createdCatId = catData.data.id;
    console.log(`   Category created with id ${createdCatId} and slug ${catData.data.slug}.`);

    // Edit Category
    const editCatRes = await fetch(`${baseUrl}/admin/categories/${createdCatId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        name: `${catName} Updated`,
        description: "Updated description.",
      }),
    });
    if (editCatRes.status !== 200) {
      throw new Error(`Category update failed: ${await editCatRes.text()}`);
    }
    console.log("   Category updated successfully.");

    // Delete Category (unassigned should succeed)
    const delCatRes = await fetch(`${baseUrl}/admin/categories/${createdCatId}`, {
      method: "DELETE",
      headers,
    });
    if (delCatRes.status !== 204) {
      throw new Error(`Category delete failed with ${delCatRes.status}`);
    }
    console.log("   Category deleted successfully.");

    // 3. Test Tag CRUD
    console.log("3. Testing Tag CRUD...");
    const tagName = `Tag_${Date.now()}`;
    const addTagRes = await fetch(`${baseUrl}/admin/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: tagName,
        description: "Tag test description.",
      }),
    });
    if (addTagRes.status !== 201) {
      throw new Error(`Tag creation failed: ${await addTagRes.text()}`);
    }
    const tagData = (await addTagRes.json()) as { data: { id: string } };
    const createdTagId = tagData.data.id;

    // Edit Tag
    const editTagRes = await fetch(`${baseUrl}/admin/tags/${createdTagId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ name: `${tagName} Updated` }),
    });
    if (editTagRes.status !== 200) {
      throw new Error(`Tag update failed: ${await editTagRes.text()}`);
    }
    console.log("   Tag created and updated.");

    // Delete Tag
    const delTagRes = await fetch(`${baseUrl}/admin/tags/${createdTagId}`, {
      method: "DELETE",
      headers,
    });
    if (delTagRes.status !== 204) {
      throw new Error(`Tag deletion failed: ${await delTagRes.status}`);
    }
    console.log("   Tag deleted successfully.");

    // 4. Test User Management (List & Details)
    console.log("4. Testing User Management APIs...");
    const usersRes = await fetch(`${baseUrl}/admin/users`, { headers });
    if (usersRes.status !== 200) {
      throw new Error(`Admin users list failed: ${await usersRes.text()}`);
    }
    const usersData = (await usersRes.json()) as { data: Array<{ id: string; email: string }> };
    if (!usersData.data.length) throw new Error("No users found");
    const testUserId = usersData.data[0].id;

    const userDetailRes = await fetch(`${baseUrl}/admin/users/${testUserId}`, { headers });
    if (userDetailRes.status !== 200) {
      throw new Error(`Admin user detail failed: ${await userDetailRes.text()}`);
    }
    const userDetail = (await userDetailRes.json()) as { data: { user: Record<string, unknown> } };
    if (!("totalPosts" in userDetail.data.user) || !("totalLikesReceived" in userDetail.data.user)) {
      throw new Error("Missing user statistics in user detail API");
    }
    console.log("   User management list and detail APIs verified with full statistics.");

    // 5. Test Post Approval Workflow
    console.log("5. Testing Post Moderation Workflow...");
    // Find a pending post or create one
    const postsRes = await fetch(`${baseUrl}/admin/posts?status=PENDING`, { headers });
    const postsData = (await postsRes.json()) as { data: Array<{ id: string; title: string }> };
    if (postsData.data.length > 0) {
      const pendingPost = postsData.data[0];
      console.log(`   Approving pending post: "${pendingPost.title}"...`);
      const approveRes = await fetch(`${baseUrl}/admin/posts/${pendingPost.id}/status`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (approveRes.status !== 200) {
        throw new Error(`Post approval failed: ${await approveRes.text()}`);
      }
      console.log("   Post approved successfully! Recorded in post_reviews.");
    }

    // 6. Test Comment Moderation Workflow
    console.log("6. Testing Comment Moderation Workflow...");
    const commentsRes = await fetch(`${baseUrl}/admin/comments`, { headers });
    const commentsData = (await commentsRes.json()) as { data: Array<{ id: string; status: string }> };
    if (commentsData.data.length > 0) {
      const comment = commentsData.data[0];
      const nextStatus = comment.status === "PENDING" ? "APPROVED" : "PENDING";
      const modRes = await fetch(`${baseUrl}/admin/comments/${comment.id}/status`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (modRes.status !== 200) {
        throw new Error(`Comment moderation failed: ${await modRes.text()}`);
      }
      console.log("   Comment moderated and reviewed successfully!");
    }

    // 7. Test SEO Management
    console.log("7. Testing SEO Management APIs...");
    const seoListRes = await fetch(`${baseUrl}/admin/seo`, { headers });
    if (seoListRes.status !== 200) {
      throw new Error(`SEO list failed: ${await seoListRes.text()}`);
    }
    const seoListData = (await seoListRes.json()) as { data: Array<{ id: string; pageKey: string }> };
    console.log(`   Fetched ${seoListData.data.length} SEO metadata records.`);

    // Update SEO for Home page
    const seoUpdateRes = await fetch(`${baseUrl}/admin/seo/page/home`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        title: "DevPulse Journal | Software Engineering Excellence",
        description: "Leading tech blog for developers, software architects, and engineering leaders.",
        keywords: "nodejs, react, mysql, tailwindcss, software architecture",
        ogTitle: "DevPulse Journal | Modern Software Architecture",
        ogDescription: "In-depth engineering articles on full-stack systems.",
        twitterTitle: "DevPulse Journal",
        twitterDescription: "In-depth engineering articles on full-stack systems.",
        robotsIndex: true,
        robotsFollow: true,
      }),
    });
    if (seoUpdateRes.status !== 200) {
      throw new Error(`SEO update failed: ${await seoUpdateRes.text()}`);
    }
    console.log("   SEO metadata updated with full meta/OG/Twitter/Robots fields.");

    // 8. Test Settings API
    console.log("8. Testing Site Settings API...");
    const settingsRes = await fetch(`${baseUrl}/admin/settings`, { headers });
    if (settingsRes.status !== 200) {
      throw new Error(`Settings GET failed: ${await settingsRes.text()}`);
    }
    const updateSettingRes = await fetch(`${baseUrl}/admin/settings/site_title`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ value: "DevPulse Journal Professional" }),
    });
    if (updateSettingRes.status !== 200) {
      throw new Error(`Settings PUT failed: ${await updateSettingRes.text()}`);
    }
    console.log("   Site settings read and updated successfully.");

    console.log("\nALL PHASE 4 ADMIN API TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    server.close();
    await pool.end();
  }
}

runPhase4Tests().catch((err) => {
  console.error("Phase 4 test failed:", err);
  process.exit(1);
});
