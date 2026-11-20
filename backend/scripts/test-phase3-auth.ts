import http from "node:http";
import { app } from "../src/app";
import { pool } from "../src/config/mysql";

async function runTests(): Promise<void> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not get server port");
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    const timestamp = Date.now();
    const testUser = {
      username: `testuser_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      password: "TestPassword123!",
      confirmPassword: "TestPassword123!",
    };

    // 1. Test Registration
    console.log("1. Testing Registration API...");
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    if (regRes.status !== 201) {
      throw new Error(`Registration failed with status ${regRes.status}: ${await regRes.text()}`);
    }
    const regData = (await regRes.json()) as { data: { user: { role: string; email: string } } };
    if (regData.data.user.role !== "user") {
      throw new Error(`Expected role 'user', got '${regData.data.user.role}'`);
    }
    console.log("   Registration passed! Role is 'user'.");

    // 2. Test Duplicate Email Prevention
    console.log("2. Testing Duplicate Email Prevention...");
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testUser),
    });
    if (dupRes.status !== 409) {
      throw new Error(`Expected duplicate to fail with 409, got ${dupRes.status}`);
    }
    console.log("   Duplicate email blocked correctly with 409 Conflict.");

    // 3. Test Login with Valid Credentials
    console.log("3. Testing Login with valid credentials...");
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: testUser.password }),
    });
    if (loginRes.status !== 200) {
      throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
    }
    const cookieHeader = loginRes.headers.get("set-cookie");
    if (!cookieHeader || !cookieHeader.includes("blog_access")) {
      throw new Error("Missing blog_access cookie in login response");
    }
    console.log("   Login passed! Received auth cookies.");

    // Extract access cookie
    const cookies = cookieHeader
      .split(/,\s*(?=[a-zA-Z0-9_]+=)/)
      .map((c) => c.split(";")[0])
      .join("; ");

    // 4. Test Authenticated Route /auth/me
    console.log("4. Testing /auth/me with auth cookie...");
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Cookie: cookies },
    });
    if (meRes.status !== 200) {
      throw new Error(`/auth/me failed with status ${meRes.status}: ${await meRes.text()}`);
    }
    const meData = (await meRes.json()) as { data: { user: { email: string } } };
    if (meData.data.user.email !== testUser.email) {
      throw new Error(`Expected email ${testUser.email}, got ${meData.data.user.email}`);
    }
    console.log("   /auth/me passed!");

    // 5. Test Role Authorization: Normal user accessing Admin route
    console.log("5. Testing Role Authorization: user accessing admin route...");
    const adminRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: cookies },
    });
    if (adminRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-admin, got ${adminRes.status}`);
    }
    console.log("   Admin route blocked for normal user with 403 Forbidden.");

    // 6. Test Admin Login and Admin route access
    console.log("6. Testing Admin Login and Dashboard access...");
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@example.com", password: "AdminPassword123!" }),
    });
    if (adminLoginRes.status !== 200) {
      throw new Error(`Admin login failed: ${await adminLoginRes.text()}`);
    }
    const adminCookies = adminLoginRes.headers
      .get("set-cookie")!
      .split(/,\s*(?=[a-zA-Z0-9_]+=)/)
      .map((c) => c.split(";")[0])
      .join("; ");

    const adminDashRes = await fetch(`${baseUrl}/admin/dashboard`, {
      headers: { Cookie: adminCookies },
    });
    if (adminDashRes.status !== 200) {
      throw new Error(`Admin dashboard access failed with ${adminDashRes.status}`);
    }
    console.log("   Admin dashboard access authorized for admin user!");

    // 7. Test User Profile Update
    console.log("7. Testing User Profile Update...");
    const profileRes = await fetch(`${baseUrl}/user/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({ bio: "Updated developer biography." }),
    });
    if (profileRes.status !== 200) {
      throw new Error(`Profile update failed: ${await profileRes.text()}`);
    }
    console.log("   Profile update passed!");

    // 8. Test Change Password
    console.log("8. Testing Change Password...");
    const newPassword = "NewSecretPassword123!";
    const changePassRes = await fetch(`${baseUrl}/user/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
      body: JSON.stringify({
        currentPassword: testUser.password,
        newPassword,
        confirmPassword: newPassword,
      }),
    });
    if (changePassRes.status !== 204) {
      throw new Error(`Change password failed: ${await changePassRes.text()}`);
    }
    console.log("   Password changed successfully!");

    // Verify login with new password
    const reLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: newPassword }),
    });
    if (reLoginRes.status !== 200) {
      throw new Error(`Login with new password failed: ${await reLoginRes.text()}`);
    }
    console.log("   Login with new password verified!");

    // 9. Test Logout
    console.log("9. Testing Logout...");
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookies },
    });
    if (logoutRes.status !== 204) {
      throw new Error(`Logout failed with status ${logoutRes.status}`);
    }
    console.log("   Logout passed!");

    console.log("\nALL PHASE 3 AUTHENTICATION TESTS PASSED WITH 100% SUCCESS!");
  } finally {
    server.close();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
