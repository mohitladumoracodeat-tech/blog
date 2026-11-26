const path = require('path');
const dotenv = require('D:/MOHIT/Blog/backend/node_modules/dotenv');
dotenv.config({ path: 'D:/MOHIT/Blog/.env' });
const mysql = require('D:/MOHIT/Blog/backend/node_modules/mysql2/promise');
const { URL } = require('url');
const { randomUUID } = require('crypto');

const BASE_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('SEC-MED-03 PROFILE IMAGE OWNERSHIP TEST SUITE');
  console.log('====================================================\n');

  const dbUrl = new URL(process.env.DATABASE_URL);
  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: decodeURIComponent(dbUrl.pathname.slice(1)),
  });

  async function request(endpoint, options = {}) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Suite': 'audit',
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, headers: res.headers };
  }

  const testImageAId = randomUUID();
  const testImageBId = randomUUID();
  const testAdminImageId = randomUUID();
  const testInvalidMimeImageId = randomUUID();

  const testUserAEmail = `test_sec_user_a_${Date.now()}@example.com`;
  const testUserBEmail = `test_sec_user_b_${Date.now()}@example.com`;
  const testAdminEmail = `test_sec_admin_${Date.now()}@example.com`;
  const testPassword = 'Password123!@#';

  let userACookie = '';
  let userBCookie = '';
  let adminCookie = '';

  let userAActualId = '';
  let userBActualId = '';
  let adminActualId = '';

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passedCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failedCount++;
    }
  }

  try {
    console.log('Step 1: Setting up isolated test accounts and test images...');

    // 1. Register User A
    const regA = await request('/auth/register', {
      method: 'POST',
      body: {
        username: `sec_user_a_${Date.now().toString().slice(-6)}`,
        email: testUserAEmail,
        password: testPassword,
        confirmPassword: testPassword,
      },
    });
    assert(regA.status === 201, 'User A registered successfully');
    const setCookieA = regA.headers.get('set-cookie');
    userACookie = setCookieA ? setCookieA.split(';')[0] : '';
    userAActualId = regA.json.data?.user?.id;

    // 2. Register User B
    const regB = await request('/auth/register', {
      method: 'POST',
      body: {
        username: `sec_user_b_${Date.now().toString().slice(-6)}`,
        email: testUserBEmail,
        password: testPassword,
        confirmPassword: testPassword,
      },
    });
    assert(regB.status === 201, 'User B registered successfully');
    const setCookieB = regB.headers.get('set-cookie');
    userBCookie = setCookieB ? setCookieB.split(';')[0] : '';
    userBActualId = regB.json.data?.user?.id;

    // 3. Register Admin User
    const regAdmin = await request('/auth/register', {
      method: 'POST',
      body: {
        username: `sec_adm_${Date.now().toString().slice(-6)}`,
        email: testAdminEmail,
        password: testPassword,
        confirmPassword: testPassword,
      },
    });
    assert(regAdmin.status === 201, 'Admin user registered successfully');
    adminActualId = regAdmin.json.data?.user?.id;
    
    // Upgrade admin user in database
    await pool.execute("UPDATE users SET role = 'ADMIN' WHERE id = ?", [adminActualId]);

    // Login Admin to get refreshed session with ADMIN role
    const loginAdmin = await request('/auth/login', {
      method: 'POST',
      body: {
        email: testAdminEmail,
        password: testPassword,
      },
    });
    const setCookieAdmin = loginAdmin.headers.get('set-cookie');
    adminCookie = setCookieAdmin ? setCookieAdmin.split(';')[0] : '';

    // Insert mock images directly into images table for controlled tests
    // Image A owned by User A (PNG)
    await pool.execute(
      `INSERT INTO images (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testImageAId, `${testImageAId}.png`, 'avatar_a.png', `/uploads/${testImageAId}.png`, 'image/png', 1024, userAActualId],
    );

    // Image B owned by User B (JPEG)
    await pool.execute(
      `INSERT INTO images (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testImageBId, `${testImageBId}.jpg`, 'avatar_b.jpg', `/uploads/${testImageBId}.jpg`, 'image/jpeg', 2048, userBActualId],
    );

    // Admin Image owned by Admin (WebP)
    await pool.execute(
      `INSERT INTO images (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testAdminImageId, `${testAdminImageId}.webp`, 'avatar_admin.webp', `/uploads/${testAdminImageId}.webp`, 'image/webp', 4096, adminActualId],
    );

    // Image with invalid MIME type owned by User A (SVG)
    await pool.execute(
      `INSERT INTO images (id, file_name, original_file_name, file_path, mime_type, file_size, uploaded_by_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [testInvalidMimeImageId, `${testInvalidMimeImageId}.svg`, 'vector.svg', `/uploads/${testInvalidMimeImageId}.svg`, 'image/svg+xml', 512, userAActualId],
    );

    console.log('\n--- Test 1: User A assigns their own uploaded image ---');
    const test1 = await request('/user/profile', {
      method: 'PUT',
      cookie: userACookie,
      body: { profileImageId: testImageAId },
    });
    assert(test1.status === 200, 'HTTP status is 200 OK');
    assert(test1.json.data?.user?.profileImageId === testImageAId, 'Returned profileImageId matches Image A');
    
    // Check DB persistence
    const [dbRowsA] = await pool.execute(
      'SELECT image_id FROM user_profile_images WHERE user_id = ?',
      [userAActualId],
    );
    assert(dbRowsA.length === 1 && dbRowsA[0].image_id === testImageAId, 'DB record correctly points to Image A');

    console.log("\n--- Test 2: User A attempts to assign User B's image (IDOR Attack) ---");
    const test2 = await request('/user/profile', {
      method: 'PATCH',
      cookie: userACookie,
      body: { profileImageId: testImageBId },
    });
    assert(test2.status === 400, 'HTTP status is 400 Bad Request');
    assert(test2.json.error?.code === 'INVALID_IMAGE', 'Error code is INVALID_IMAGE');
    
    // Verify DB record for User A was NOT modified
    const [dbRowsAAfterAttack] = await pool.execute(
      'SELECT image_id FROM user_profile_images WHERE user_id = ?',
      [userAActualId],
    );
    assert(dbRowsAAfterAttack[0].image_id === testImageAId, "User A profile image remains Image A (attack thwarted)");

    console.log('\n--- Test 3: User A assigns a nonexistent image ID ---');
    const nonexistentId = randomUUID();
    const test3 = await request('/user/profile', {
      method: 'PUT',
      cookie: userACookie,
      body: { profileImageId: nonexistentId },
    });
    assert(test3.status === 400, 'HTTP status is 400 Bad Request');
    assert(test3.json.error?.code === 'INVALID_IMAGE', 'Error code is INVALID_IMAGE');

    console.log('\n--- Test 4: Invalid image ID format (non-UUID) ---');
    const test4 = await request('/user/profile', {
      method: 'PATCH',
      cookie: userACookie,
      body: { profileImageId: 'not-a-valid-uuid' },
    });
    assert(test4.status === 400, 'HTTP status is 400 Bad Request');
    assert(test4.json.error?.code === 'VALIDATION_ERROR', 'Zod validation rejects malformed UUID');

    console.log('\n--- Test 5: User A attempts to assign Admin uploaded image ---');
    const test5 = await request('/user/profile', {
      method: 'PUT',
      cookie: userACookie,
      body: { profileImageId: testAdminImageId },
    });
    assert(test5.status === 400, 'HTTP status is 400 Bad Request (cannot steal admin image)');
    assert(test5.json.error?.code === 'INVALID_IMAGE', 'Error code is INVALID_IMAGE');

    console.log('\n--- Test 6: User A attempts to assign image with unapproved MIME type (SVG) ---');
    const test6 = await request('/user/profile', {
      method: 'PUT',
      cookie: userACookie,
      body: { profileImageId: testInvalidMimeImageId },
    });
    assert(test6.status === 400, 'HTTP status is 400 Bad Request (unapproved image MIME type)');
    assert(test6.json.error?.code === 'INVALID_IMAGE', 'Error code is INVALID_IMAGE');

    console.log('\n--- Test 7: Admin assigns their own uploaded image ---');
    const test7 = await request('/user/profile', {
      method: 'PUT',
      cookie: adminCookie,
      body: { profileImageId: testAdminImageId },
    });
    assert(test7.status === 200, 'HTTP status is 200 OK for Admin assigning owned image');
    assert(test7.json.data?.user?.profileImageId === testAdminImageId, 'Admin profileImageId points to Admin image');

    console.log('\n--- Test 8: Removing an existing profile image (profileImageId: null) ---');
    const test8 = await request('/user/profile', {
      method: 'PATCH',
      cookie: userACookie,
      body: { profileImageId: null },
    });
    assert(test8.status === 200, 'HTTP status is 200 OK for removing avatar');
    assert(test8.json.data?.user?.profileImageId === null, 'Returned profileImageId is null');
    
    // Verify DB row in user_profile_images is removed
    const [dbRowsARemoved] = await pool.execute(
      'SELECT image_id FROM user_profile_images WHERE user_id = ?',
      [userAActualId],
    );
    assert(dbRowsARemoved.length === 0, 'DB record in user_profile_images was cleanly deleted');

    console.log('\n--- Test 9: Existing profile fields (bio, username) continue working cleanly ---');
    const test9 = await request('/user/profile', {
      method: 'PATCH',
      cookie: userACookie,
      body: {
        bio: 'Updated security researcher bio.',
      },
    });
    assert(test9.status === 200, 'HTTP status is 200 OK');
    assert(test9.json.data?.user?.bio === 'Updated security researcher bio.', 'Bio successfully updated');
    assert(test9.json.data?.user?.profileImageId === null, 'profileImageId remains null when omitted');

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    console.log('\nStep 3: Cleaning up isolated test records...');
    try {
      // Clean up user_profile_images, images, and users created by this test
      await pool.execute('DELETE FROM user_profile_images WHERE image_id IN (?, ?, ?, ?)', [
        testImageAId, testImageBId, testAdminImageId, testInvalidMimeImageId,
      ]);
      await pool.execute('DELETE FROM images WHERE id IN (?, ?, ?, ?)', [
        testImageAId, testImageBId, testAdminImageId, testInvalidMimeImageId,
      ]);
      if (userAActualId) {
        await pool.execute('DELETE FROM user_profile_images WHERE user_id = ?', [userAActualId]);
        await pool.execute('DELETE FROM auth_sessions WHERE user_id = ?', [userAActualId]);
        await pool.execute('DELETE FROM users WHERE id = ?', [userAActualId]);
      }
      if (userBActualId) {
        await pool.execute('DELETE FROM user_profile_images WHERE user_id = ?', [userBActualId]);
        await pool.execute('DELETE FROM auth_sessions WHERE user_id = ?', [userBActualId]);
        await pool.execute('DELETE FROM users WHERE id = ?', [userBActualId]);
      }
      if (adminActualId) {
        await pool.execute('DELETE FROM user_profile_images WHERE user_id = ?', [adminActualId]);
        await pool.execute('DELETE FROM auth_sessions WHERE user_id = ?', [adminActualId]);
        await pool.execute('DELETE FROM users WHERE id = ?', [adminActualId]);
      }
      console.log('✓ Cleanup complete.');
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
    await pool.end();
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
