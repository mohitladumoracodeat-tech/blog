// ============================================================================
// Fieldnotes Journal — Auth Session Revocation & Safe Cleanup Regression Test
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

  // 1. Fetch a real test user from database (admin or mohit)
  const [users] = await pool.execute(
    "SELECT id, username, email, role, is_active FROM users WHERE role = 'ADMIN' LIMIT 1"
  );
  if (users.length === 0) {
    throw new Error("No admin user found to execute test against.");
  }
  const testUser = {
    id: users[0].id,
    username: users[0].username,
    email: users[0].email,
    role: users[0].role,
    isActive: Boolean(users[0].is_active),
  };

  // Test 1: Session creation and validation
  console.log("Test 1: Create session and validate access token");
  const session = await createSession(testUser);
  assert(session.accessToken, "Should generate access token");
  assert(session.refreshToken, "Should generate refresh token");

  const authenticated = await getAuthenticatedUser(session.accessToken);
  assert.equal(authenticated.id, testUser.id);
  assert.equal(authenticated.username, testUser.username);
  console.log("✓ Session created and access token verified successfully.\n");
  passed++;

  // Test 2: Session Rotation
  console.log("Test 2: Rotate session with valid refresh token");
  const rotated = await rotateSession(session.refreshToken);
  assert(rotated.accessToken, "Should generate new access token");
  assert(rotated.refreshToken, "Should generate new refresh token");
  assert.notEqual(rotated.refreshToken, session.refreshToken);

  const rotatedUser = await getAuthenticatedUser(rotated.accessToken);
  assert.equal(rotatedUser.id, testUser.id);
  console.log("✓ Session rotation succeeded with new token pair.\n");
  passed++;

  // Test 3: Old refresh token is invalid after rotation
  console.log("Test 3: Old refresh token invalidation after rotation");
  let oldTokenRejected = false;
  try {
    await rotateSession(session.refreshToken);
  } catch (err) {
    oldTokenRejected = true;
    assert.equal(err.code, "INVALID_SESSION");
  }
  assert.equal(oldTokenRejected, true, "Old rotated refresh token must be rejected with INVALID_SESSION");
  console.log("✓ Old refresh token rejected correctly upon reuse attempt.\n");
  passed++;

  // Test 4: Revocation invalidates both refresh and access tokens
  console.log("Test 4: Revocation invalidates refresh and access tokens");
  await revokeRefreshToken(rotated.refreshToken);

  let refreshRejected = false;
  try {
    await rotateSession(rotated.refreshToken);
  } catch (err) {
    refreshRejected = true;
    assert.equal(err.code, "INVALID_SESSION");
  }
  assert.equal(refreshRejected, true, "Revoked refresh token must be rejected");

  let accessRejected = false;
  try {
    await getAuthenticatedUser(rotated.accessToken);
  } catch (err) {
    accessRejected = true;
    assert.equal(err.code, "UNAUTHENTICATED");
  }
  assert.equal(accessRejected, true, "Access token of revoked session must be rejected");
  console.log("✓ Revocation immediately invalidated both refresh and access tokens.\n");
  passed++;

  // Test 5: Safe Cleanup Strategy
  console.log("Test 5: Safe session cleanup (purges expired/old-revoked, preserves active)");
  // Insert a synthetic expired session
  const expiredSessionId = "00000000-0000-0000-0000-000000000099";
  await pool.execute(
    `INSERT INTO auth_sessions (id, user_id, refresh_token_hash, expires_at)
     VALUES (?, ?, 'dummy_expired_hash_123', DATE_SUB(NOW(), INTERVAL 1 DAY))
     ON DUPLICATE KEY UPDATE expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [expiredSessionId, testUser.id]
  );

  // Run cleanup
  const cleanupResult = await cleanupExpiredSessions();
  assert(cleanupResult.expiredDeleted >= 1, "Should have deleted at least the dummy expired session");

  // Verify expired session was deleted
  const [checkExpired] = await pool.execute(
    "SELECT id FROM auth_sessions WHERE id = ?",
    [expiredSessionId]
  );
  assert.equal(checkExpired.length, 0, "Expired session must no longer exist in database");

  // Verify active sessions still exist
  const [activeSessions] = await pool.execute(
    "SELECT COUNT(*) AS count FROM auth_sessions WHERE revoked_at IS NULL AND expires_at >= NOW()"
  );
  assert(Number(activeSessions[0].count) > 0, "Active sessions must NOT be deleted");

  console.log(`✓ Expired sessions purged: ${cleanupResult.expiredDeleted}, Active sessions preserved: ${activeSessions[0].count}.\n`);
  passed++;

  console.log(`=======================================================`);
  console.log(`Session Security Verification: ALL ${passed}/5 TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runSessionTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
