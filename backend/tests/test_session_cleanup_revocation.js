// ============================================================================
// Fieldnotes Journal — Session Revocation & Safe Cleanup Regression Tests
// ============================================================================

import assert from "node:assert/strict";
import { pool } from "../dist/src/config/mysql.js";
import {
  createSession,
  getAuthenticatedUser,
  rotateSession,
  revokeRefreshToken,
  cleanupExpiredSessions,
} from "../dist/src/auth/auth.service.js";

async function runSessionTests() {
  console.log("Starting Session Revocation & Cleanup Regression Tests...\n");
  let passed = 0;

  try {
    // 1. Fetch a known test user (admin)
    const [users] = await pool.execute(
      "SELECT id, username, email, role, is_active FROM users WHERE username = 'admin' LIMIT 1"
    );
    assert.equal(users.length, 1, "Admin user must exist");
    const user = {
      id: users[0].id,
      username: users[0].username,
      email: users[0].email,
      role: users[0].role,
      isActive: Boolean(users[0].is_active),
    };

    // 2. Create a fresh test session
    console.log("Test 1: Create session and verify access token authentication");
    const session = await createSession(user);
    assert(session.accessToken, "Access token must be generated");
    assert(session.refreshToken, "Refresh token must be generated");

    const authenticated = await getAuthenticatedUser(session.accessToken);
    assert.equal(authenticated.id, user.id);
    assert.equal(authenticated.username, user.username);
    console.log("✓ Session created and access token verified successfully.\n");
    passed++;

    // 3. Rotate session
    console.log("Test 2: Rotate session token pair");
    const rotated = await rotateSession(session.refreshToken);
    assert(rotated.accessToken, "New access token must be generated");
    assert(rotated.refreshToken, "New refresh token must be generated");
    assert.notEqual(rotated.refreshToken, session.refreshToken, "Refresh token must be changed upon rotation");
    console.log("✓ Session rotated successfully.\n");
    passed++;

    // 4. Old refresh token cannot be reused
    console.log("Test 3: Old rotated refresh token rejection (replay protection)");
    await assert.rejects(
      async () => {
        await rotateSession(session.refreshToken);
      },
      (err) => {
        assert(err.message.includes("Refresh session is invalid or expired") || err.code === "INVALID_SESSION");
        return true;
      }
    );
    console.log("✓ Old refresh token rejected on reuse attempt.\n");
    passed++;

    // 5. Revoke session and verify both access token and refresh token are rejected
    console.log("Test 4: Session revocation invalidates tokens immediately");
    await revokeRefreshToken(rotated.refreshToken);

    // Verify refresh token is rejected
    await assert.rejects(
      async () => {
        await rotateSession(rotated.refreshToken);
      },
      (err) => {
        assert(err.message.includes("Refresh session is invalid or expired") || err.code === "INVALID_SESSION");
        return true;
      }
    );

    // Verify access token linked to revoked session is rejected
    await assert.rejects(
      async () => {
        await getAuthenticatedUser(rotated.accessToken);
      },
      (err) => {
        assert(err.message.includes("Authentication is required") || err.code === "UNAUTHENTICATED");
        return true;
      }
    );
    console.log("✓ Revoked session immediately rejects both refresh and access tokens.\n");
    passed++;

    // 6. Test cleanupExpiredSessions function
    console.log("Test 5: Safe cleanup function execution");
    const cleanupResult = await cleanupExpiredSessions();
    console.log("Cleanup execution result:", cleanupResult);
    assert(typeof cleanupResult.expiredDeleted === "number");
    assert(typeof cleanupResult.oldRevokedDeleted === "number");

    // Verify active valid sessions are NOT deleted
    const [activeAfter] = await pool.execute(
      "SELECT COUNT(*) AS active_count FROM auth_sessions WHERE revoked_at IS NULL AND expires_at >= NOW()"
    );
    assert(activeAfter[0].active_count > 0, "Active unexpired sessions must be preserved");
    console.log(`✓ Cleanup executed safely. Preserved ${activeAfter[0].active_count} active valid sessions.\n`);
    passed++;

    console.log(`=======================================================`);
    console.log(`Session Security: ALL ${passed}/5 TESTS PASSED!`);
    console.log(`=======================================================\n`);

  } finally {
    await pool.end();
  }
}

runSessionTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
