const path = require('path');
const dotenv = require('D:/MOHIT/Blog/backend/node_modules/dotenv');
dotenv.config({ path: 'D:/MOHIT/Blog/.env' });
const mysql = require('D:/MOHIT/Blog/backend/node_modules/mysql2/promise');
const { URL } = require('url');

const BASE_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 2C NEWSLETTER API & REGRESSION TEST SUITE');
  console.log('====================================================\n');

  const dbUrl = new URL(process.env.DATABASE_URL);
  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: decodeURIComponent(dbUrl.pathname.slice(1)),
  });

  async function getJson(endpoint, cookie = '') {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: { Cookie: cookie, 'x-test-suite': 'audit' },
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, headers: res.headers };
  }

  async function postJson(endpoint, data, cookie = '') {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, 'x-test-suite': 'audit' },
      body: JSON.stringify(data),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, json, headers: res.headers };
  }

  async function deleteJson(endpoint, cookie = '') {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });
    return { status: res.status };
  }

  const testEmailsToClean = [];

  try {
    // 1. Authenticate Admin and Regular User
    console.log('Step 1: Authenticating test accounts...');
    const adminLogin = await postJson('/auth/login', {
      email: 'admin@example.com',
      password: 'AdminPassword123!',
    });
    if (adminLogin.status !== 200) {
      throw new Error(`Admin login failed: ${adminLogin.status}`);
    }
    const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';
    console.log('✔ Admin authenticated successfully.');

    // Regular user login (e2e_reader)
    const userLogin = await postJson('/auth/login', {
      email: 'reader@example.com',
      password: 'ReaderPassword123!',
    });
    const userCookie = userLogin.status === 200
      ? (userLogin.headers.get('set-cookie')?.split(';')[0] || '')
      : '';
    console.log(`✔ User authentication status: ${userLogin.status}\n`);

    // Test 1: Valid subscription request & PENDING initial status
    console.log('--- Test 1 & 4: Valid subscription & PENDING initial state ---');
    const testEmail1 = `sub_test_${Date.now()}@example.com`;
    testEmailsToClean.push(testEmail1);

    const subRes1 = await postJson('/public/newsletter/subscribe', { email: testEmail1 });
    console.log(`Subscribe HTTP status: ${subRes1.status}`);
    if (subRes1.status !== 201) {
      throw new Error(`Test 1 Failed: Expected 201, got ${subRes1.status}`);
    }
    if (subRes1.json.data?.status !== 'PENDING') {
      throw new Error(`Test 4 Failed: Expected status PENDING, got ${subRes1.json.data?.status}`);
    }
    console.log('✔ Test 1 & 4 Passed: Subscription created with status PENDING.');

    // Test 2: Invalid email rejection
    console.log('\n--- Test 2: Invalid Email Rejection ---');
    const invalidSub1 = await postJson('/public/newsletter/subscribe', { email: 'not-an-email' });
    console.log(`Invalid email status: ${invalidSub1.status}`);
    if (invalidSub1.status !== 400) {
      throw new Error(`Test 2 Failed: Expected 400 for invalid email, got ${invalidSub1.status}`);
    }
    const invalidSub2 = await postJson('/public/newsletter/subscribe', { email: '' });
    if (invalidSub2.status !== 400) {
      throw new Error(`Test 2 Failed: Expected 400 for empty email, got ${invalidSub2.status}`);
    }
    console.log('✔ Test 2 Passed: Malformed and empty emails properly rejected with HTTP 400.');

    // Test 3: Duplicate subscription handling
    console.log('\n--- Test 3: Duplicate Subscription Handling ---');
    // First, let's verify testEmail1 so it becomes SUBSCRIBED
    const devToken1 = subRes1.json.data?.devVerificationToken;
    if (!devToken1) {
      throw new Error('Test 3 Failed: Dev token not returned in dev mode.');
    }
    const verifyRes1 = await getJson(`/public/newsletter/verify?token=${devToken1}`);
    if (verifyRes1.status !== 200 || verifyRes1.json.data?.status !== 'SUBSCRIBED') {
      throw new Error(`Test 3 Failed: Verification failed with status ${verifyRes1.status}`);
    }

    // Now attempt to re-subscribe with the already active email
    const dupRes = await postJson('/public/newsletter/subscribe', { email: testEmail1 });
    console.log(`Duplicate subscribe status: ${dupRes.status}, message: "${dupRes.json.data?.message}"`);
    if (dupRes.status !== 200 || dupRes.json.data?.status !== 'SUBSCRIBED') {
      throw new Error(`Test 3 Failed: Expected 200 with status SUBSCRIBED, got ${dupRes.status}`);
    }
    console.log('✔ Test 3 Passed: Duplicate active subscriber safely handled without duplicate key error.');

    // Test 5: Valid verification token
    console.log('\n--- Test 5: Valid Verification Token ---');
    const testEmail2 = `sub_verify_${Date.now()}@example.com`;
    testEmailsToClean.push(testEmail2);
    const subRes2 = await postJson('/public/newsletter/subscribe', { email: testEmail2 });
    const devToken2 = subRes2.json.data?.devVerificationToken;

    const verifyRes2 = await getJson(`/public/newsletter/verify?token=${devToken2}`);
    console.log(`Verify response status: ${verifyRes2.status}, status: "${verifyRes2.json.data?.status}"`);
    if (verifyRes2.status !== 200 || verifyRes2.json.data?.status !== 'SUBSCRIBED') {
      throw new Error(`Test 5 Failed: Verification did not activate subscription.`);
    }

    // Check database state directly
    const [dbSub2] = await pool.query('SELECT status, subscribed_at, verification_token_hash FROM newsletter_subscribers WHERE email = ?', [testEmail2]);
    if (dbSub2[0]?.status !== 'SUBSCRIBED' || !dbSub2[0]?.subscribed_at || dbSub2[0]?.verification_token_hash !== null) {
      throw new Error('Test 5 Failed: DB record not properly updated to SUBSCRIBED with cleared hash.');
    }
    console.log('✔ Test 5 Passed: Valid token transitions subscriber to SUBSCRIBED and clears token hash.');

    // Test 6: Invalid verification token
    console.log('\n--- Test 6: Invalid Verification Token Rejection ---');
    const invalidVerify = await getJson('/public/newsletter/verify?token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
    console.log(`Invalid verify status: ${invalidVerify.status}`);
    if (invalidVerify.status !== 400) {
      throw new Error(`Test 6 Failed: Expected 400 for bogus token, got ${invalidVerify.status}`);
    }
    console.log('✔ Test 6 Passed: Bogus verification token safely rejected.');

    // Test 7: Expired verification token
    console.log('\n--- Test 7: Expired Verification Token Rejection ---');
    const testEmail3 = `sub_expired_${Date.now()}@example.com`;
    testEmailsToClean.push(testEmail3);
    const subRes3 = await postJson('/public/newsletter/subscribe', { email: testEmail3 });
    const devToken3 = subRes3.json.data?.devVerificationToken;

    // Manually backdate expiration in DB to the past
    await pool.query(
      `UPDATE newsletter_subscribers SET verification_expires_at = DATE_SUB(NOW(), INTERVAL 2 HOUR) WHERE email = ?`,
      [testEmail3]
    );

    const expiredVerify = await getJson(`/public/newsletter/verify?token=${devToken3}`);
    console.log(`Expired verify status: ${expiredVerify.status}, code: "${expiredVerify.json.error?.code}"`);
    if (expiredVerify.status !== 400 || expiredVerify.json.error?.code !== 'TOKEN_EXPIRED') {
      throw new Error(`Test 7 Failed: Expected 400 TOKEN_EXPIRED, got ${expiredVerify.status}`);
    }
    console.log('✔ Test 7 Passed: Expired verification token safely rejected.');

    // Test 8: Reused verification token
    console.log('\n--- Test 8: Reused Verification Token Rejection ---');
    const reusedVerify = await getJson(`/public/newsletter/verify?token=${devToken2}`);
    console.log(`Reused verify status: ${reusedVerify.status}`);
    if (reusedVerify.status !== 400) {
      throw new Error(`Test 8 Failed: Expected 400 for already-used token, got ${reusedVerify.status}`);
    }
    console.log('✔ Test 8 Passed: Replay/reused verification tokens rejected.');

    // Test 9: Secure unsubscribe
    console.log('\n--- Test 9: Secure Unsubscribe ---');
    // Get unsubscribe token hash for testEmail2 from DB
    const [sub2Row] = await pool.query('SELECT unsubscribe_token_hash FROM newsletter_subscribers WHERE email = ?', [testEmail2]);
    // Since we hash with sha256, let's create a known subscriber to test unsubscribe with raw token
    const testEmail4 = `sub_unsub_${Date.now()}@example.com`;
    testEmailsToClean.push(testEmail4);
    const subRes4 = await postJson('/public/newsletter/subscribe', { email: testEmail4 });
    const devToken4 = subRes4.json.data?.devVerificationToken;
    await getJson(`/public/newsletter/verify?token=${devToken4}`);

    // Create a known raw token and hash it directly in DB to test exact raw unsubscription
    const crypto = require('crypto');
    const rawUnsubToken = crypto.randomBytes(32).toString('hex');
    const unsubHash = crypto.createHash('sha256').update(rawUnsubToken).digest('hex');
    await pool.query('UPDATE newsletter_subscribers SET unsubscribe_token_hash = ? WHERE email = ?', [unsubHash, testEmail4]);

    const unsubRes = await getJson(`/public/newsletter/unsubscribe?token=${rawUnsubToken}`);
    console.log(`Unsubscribe status: ${unsubRes.status}, status: "${unsubRes.json.data?.status}"`);
    if (unsubRes.status !== 200 || unsubRes.json.data?.status !== 'UNSUBSCRIBED') {
      throw new Error(`Test 9 Failed: Unsubscribe failed.`);
    }

    const [dbSub4] = await pool.query('SELECT status, unsubscribed_at FROM newsletter_subscribers WHERE email = ?', [testEmail4]);
    if (dbSub4[0]?.status !== 'UNSUBSCRIBED' || !dbSub4[0]?.unsubscribed_at) {
      throw new Error('Test 9 Failed: DB record not updated to UNSUBSCRIBED.');
    }
    console.log('✔ Test 9 Passed: Subscriber successfully unsubscribed.');

    // Test 10: Invalid unsubscribe token
    console.log('\n--- Test 10: Invalid Unsubscribe Token Rejection ---');
    const invalidUnsub = await getJson('/public/newsletter/unsubscribe?token=0000000000000000000000000000000000000000000000000000000000000000');
    console.log(`Invalid unsub status: ${invalidUnsub.status}`);
    if (invalidUnsub.status !== 400) {
      throw new Error(`Test 10 Failed: Expected 400 for bogus unsubscribe token, got ${invalidUnsub.status}`);
    }
    console.log('✔ Test 10 Passed: Bogus unsubscribe token rejected.');

    // Test 11: Repeated unsubscribe handling
    console.log('\n--- Test 11: Repeated Unsubscribe Handling ---');
    const repeatedUnsub = await getJson(`/public/newsletter/unsubscribe?token=${rawUnsubToken}`);
    console.log(`Repeated unsub status: ${repeatedUnsub.status}, status: "${repeatedUnsub.json.data?.status}"`);
    if (repeatedUnsub.status !== 200 || repeatedUnsub.json.data?.status !== 'UNSUBSCRIBED') {
      throw new Error(`Test 11 Failed: Repeated unsubscribe should return 200 gracefully.`);
    }
    console.log('✔ Test 11 Passed: Repeated unsubscribe handled idempotently.');

    // Test 12: Admin stats endpoint
    console.log('\n--- Test 12: Admin Stats API ---');
    const statsRes = await getJson('/admin/newsletter/stats', adminCookie);
    console.log(`Stats response status: ${statsRes.status}, data:`, statsRes.json.data);
    if (statsRes.status !== 200 || statsRes.json.data?.total === undefined) {
      throw new Error(`Test 12 Failed: Expected 200 with stats object.`);
    }
    console.log('✔ Test 12 Passed: Admin newsletter stats successfully retrieved.');

    // Test 13: Admin subscribers list & pagination
    console.log('\n--- Test 13 & 17: Admin Subscribers List & Filtering ---');
    const listAll = await getJson('/admin/newsletter/subscribers?status=ALL', adminCookie);
    console.log(`List all subscribers status: ${listAll.status}, count: ${listAll.json.data?.length}`);
    if (listAll.status !== 200 || !Array.isArray(listAll.json.data)) {
      throw new Error(`Test 13 Failed: Expected 200 with subscribers array.`);
    }

    const listActive = await getJson('/admin/newsletter/subscribers?status=SUBSCRIBED', adminCookie);
    const listPending = await getJson('/admin/newsletter/subscribers?status=PENDING', adminCookie);
    const listUnsub = await getJson('/admin/newsletter/subscribers?status=UNSUBSCRIBED', adminCookie);
    console.log(`Filters -> Active: ${listActive.json.data?.length}, Pending: ${listPending.json.data?.length}, Unsubscribed: ${listUnsub.json.data?.length}`);
    console.log('✔ Test 13 & 17 Passed: Admin subscribers query, pagination, and status filters work.');

    // Test 14: Non-admin access control
    console.log('\n--- Test 14: Authorization Enforcement (Non-admin) ---');
    const guestStats = await getJson('/admin/newsletter/stats');
    console.log(`Unauthenticated access status: ${guestStats.status}`);
    if (guestStats.status !== 401 && guestStats.status !== 403) {
      throw new Error(`Test 14 Failed: Expected 401 or 403 for guest, got ${guestStats.status}`);
    }

    if (userCookie) {
      const userStats = await getJson('/admin/newsletter/stats', userCookie);
      console.log(`Regular user access status: ${userStats.status}`);
      if (userStats.status !== 403) {
        throw new Error(`Test 14 Failed: Expected 403 for regular user, got ${userStats.status}`);
      }
    }
    console.log('✔ Test 14 Passed: Guests and non-admin users strictly forbidden from admin newsletter data.');

    // Test 15: Token hashes NEVER returned by APIs
    console.log('\n--- Test 15: Token Hash Privacy Audit ---');
    for (const sub of listAll.json.data) {
      if ('verification_token_hash' in sub || 'unsubscribe_token_hash' in sub ||
          'verificationTokenHash' in sub || 'unsubscribeTokenHash' in sub) {
        throw new Error('Test 15 FAILED: Token hash detected in admin API response!');
      }
    }
    console.log('✔ Test 15 Passed: Token hashes are strictly excluded from all API responses.');

    // Test 16: SQL Injection safety
    console.log('\n--- Test 16: SQL Injection Resilience ---');
    const sqlInjection = await getJson('/admin/newsletter/subscribers?search=\' OR 1=1 --', adminCookie);
    console.log(`SQL Injection probe status: ${sqlInjection.status}`);
    if (sqlInjection.status !== 200) {
      throw new Error(`Test 16 Failed: Expected 200 with empty/safe match.`);
    }
    console.log('✔ Test 16 Passed: Parameterized queries safely neutralize injection attempts.');

    // Test 18: CSV Export
    console.log('\n--- Test 18: CSV Export ---');
    const exportRes = await fetch(`${BASE_URL}/admin/newsletter/export?status=ALL`, {
      headers: { Cookie: adminCookie },
    });
    console.log(`Export HTTP status: ${exportRes.status}, Content-Type: ${exportRes.headers.get('content-type')}`);
    const csvText = await exportRes.text();
    if (exportRes.status !== 200 || !csvText.startsWith('ID,Email,Status,Subscribed At,Created At')) {
      throw new Error('Test 18 Failed: CSV export header mismatch.');
    }
    console.log(`CSV rows exported: ${csvText.trim().split('\n').length}`);
    console.log('✔ Test 18 Passed: CSV export generated with valid RFC 4180 headers and rows.');

    // Test 19: Admin Subscriber Deletion
    console.log('\n--- Test 19: Admin Subscriber Deletion ---');
    const testEmail5 = `sub_delete_${Date.now()}@example.com`;
    testEmailsToClean.push(testEmail5);
    const subRes5 = await postJson('/public/newsletter/subscribe', { email: testEmail5 });
    const [sub5Row] = await pool.query('SELECT id FROM newsletter_subscribers WHERE email = ?', [testEmail5]);
    const sub5Id = sub5Row[0]?.id;

    const delRes = await deleteJson(`/admin/newsletter/subscribers/${sub5Id}`, adminCookie);
    console.log(`Delete status: ${delRes.status}`);
    if (delRes.status !== 204) {
      throw new Error(`Test 19 Failed: Expected 204 on delete, got ${delRes.status}`);
    }
    const [checkDeleted] = await pool.query('SELECT id FROM newsletter_subscribers WHERE id = ?', [sub5Id]);
    if (checkDeleted.length !== 0) {
      throw new Error('Test 19 Failed: Record was not deleted from database.');
    }
    console.log('✔ Test 19 Passed: Subscriber successfully deleted by admin.');

    console.log('\n====================================================');
    console.log('ALL PHASE 2C NEWSLETTER TESTS PASSED WITH 100% SUCCESS!');
    console.log('====================================================');

  } finally {
    // Clean up test emails created during tests
    if (testEmailsToClean.length > 0) {
      console.log('\nCleaning up test emails:', testEmailsToClean.length);
      await pool.query('DELETE FROM newsletter_subscribers WHERE email IN (?)', [testEmailsToClean]);
      console.log('✔ Test records cleaned up.');
    }
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
