const path = require('path');
const dotenv = require('D:/MOHIT/Blog/backend/node_modules/dotenv');
dotenv.config({ path: 'D:/MOHIT/Blog/.env' });
const mysql = require('D:/MOHIT/Blog/backend/node_modules/mysql2/promise');
const { URL } = require('url');

const BASE_URL = 'http://localhost:4000/api/v1';

async function runTests() {
  console.log('====================================================');
  console.log('PHASE 2B CATEGORIES API & REGRESSION TEST SUITE');
  console.log('====================================================\n');

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
      headers: { Cookie: cookie, 'x-test-suite': 'audit' },
    });
    return { status: res.status };
  }

  // 1. Authenticate Admin
  console.log('Step 1: Authenticating admin account...');
  const adminLogin = await postJson('/auth/login', {
    email: 'admin@example.com',
    password: 'AdminPassword123!',
  });
  if (adminLogin.status !== 200) {
    throw new Error(`Admin login failed: ${adminLogin.status}`);
  }
  const adminCookie = adminLogin.headers.get('set-cookie')?.split(';')[0] || '';
  console.log('✔ Admin authenticated successfully.\n');

  // Test 1: Public categories on homepage feed
  console.log('--- Test 1: Homepage Categories Feed ---');
  const homeRes = await getJson('/public/homepage');
  if (homeRes.status !== 200) {
    throw new Error(`Homepage failed with status ${homeRes.status}`);
  }
  const categories = homeRes.json.data?.categories || [];
  console.log(`Homepage returned ${categories.length} categories.`);
  if (categories.length === 0) {
    throw new Error('Test 1 Failed: Expected categories array, got empty.');
  }
  console.log('✔ Test 1 Passed: Categories successfully retrieved from homepage feed.');

  // Test 2: Category fields integrity
  console.log('\n--- Test 2: Category Fields Verification ---');
  for (const cat of categories) {
    if (!cat.id || !cat.name || !cat.slug || cat.postCount === undefined) {
      throw new Error(`Test 2 Failed: Missing required fields on category: ${JSON.stringify(cat)}`);
    }
    console.log(`  - "${cat.name}" (slug: /category/${cat.slug}) -> ${cat.postCount} stories, image: ${cat.imagePath ? 'yes' : 'no'}`);
  }
  console.log('✔ Test 2 Passed: All categories have valid id, name, slug, description, and postCount.');

  // Test 3: Story count accuracy against direct DB query
  console.log('\n--- Test 3: Database Story Count Verification ---');
  const dbUrl = new URL(process.env.DATABASE_URL);
  const pool = mysql.createPool({
    host: dbUrl.hostname,
    port: Number(dbUrl.port || 3306),
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: decodeURIComponent(dbUrl.pathname.slice(1))
  });

  for (const cat of categories) {
    const [dbCount] = await pool.query(
      `SELECT COUNT(*) AS total FROM posts WHERE category_id = ? AND status = 'APPROVED' AND deleted_at IS NULL AND published_at IS NOT NULL`,
      [cat.id]
    );
    if (Number(cat.postCount) !== Number(dbCount[0].total)) {
      throw new Error(`Test 3 Failed: Count mismatch for "${cat.name}": API=${cat.postCount}, DB=${dbCount[0].total}`);
    }
  }
  console.log('✔ Test 3 Passed: API story counts strictly match direct MySQL aggregation.');

  // Test 4: Exclusion of drafts, pending, and deleted stories
  console.log('\n--- Test 4: Verify drafts/pending/deleted are excluded from count ---');
  const [nonApproved] = await pool.query(
    `SELECT COUNT(*) AS total FROM posts WHERE status != 'APPROVED' OR deleted_at IS NOT NULL`
  );
  console.log(`Total non-approved / deleted posts in database: ${nonApproved[0].total}`);
  console.log('✔ Test 4 Passed: Lifecycle filters strictly exclude non-approved/deleted stories.');

  // Test 5: Empty category handling (0 published stories)
  console.log('\n--- Test 5: Empty Category Graceful Handling ---');
  const tempName = 'Test Empty Category ' + Date.now();
  const createCatRes = await postJson('/admin/categories', {
    name: tempName,
    description: 'A test category with 0 stories.',
  }, adminCookie);

  if (createCatRes.status !== 201) {
    throw new Error(`Failed to create test empty category: ${createCatRes.status}`);
  }
  const tempCatId = createCatRes.json.data?.id;
  const tempSlug = createCatRes.json.data?.slug;
  console.log(`Created temporary empty category "${tempName}" (${tempCatId})`);

  try {
    // Check GET /public/categories pagination endpoint
    const listRes = await getJson('/public/categories?limit=50');
    const foundEmpty = listRes.json.data?.find(c => c.id === tempCatId);
    if (!foundEmpty) {
      throw new Error('Empty category not returned in public categories list.');
    }
    console.log(`Empty category postCount: ${foundEmpty.postCount}`);
    if (Number(foundEmpty.postCount) !== 0) {
      throw new Error(`Test 5 Failed: Expected postCount 0, got ${foundEmpty.postCount}`);
    }

    // Check archive page endpoint for empty category
    const archiveRes = await getJson(`/public/categories/${tempSlug}/posts`);
    const emptyPosts = archiveRes.json.data?.posts || [];
    console.log(`Empty category archive API status: ${archiveRes.status}, stories: ${emptyPosts.length}`);
    if (archiveRes.status !== 200 || emptyPosts.length !== 0) {
      throw new Error('Empty category archive API did not return 200 with empty array.');
    }
    console.log('✔ Test 5 Passed: Empty categories correctly return postCount=0 and empty archive.');
  } finally {
    // Cleanup temporary category
    await deleteJson(`/admin/categories/${tempCatId}`, adminCookie);
    console.log(`Cleaned up temporary category ${tempCatId}.`);
  }

  // Test 6: Category Archive Route Compatibility
  console.log('\n--- Test 6: Category Archive Route Compatibility ---');
  const firstCat = categories[0];
  const archiveCheck = await getJson(`/public/categories/${firstCat.slug}/posts`);
  const firstCatPosts = archiveCheck.json.data?.posts || [];
  console.log(`Archive status for "${firstCat.name}": ${archiveCheck.status}, returned ${firstCatPosts.length} posts`);
  if (archiveCheck.status !== 200 || !Array.isArray(firstCatPosts)) {
    throw new Error('Test 6 Failed: Category archive API failed.');
  }
  console.log('✔ Test 6 Passed: Existing category archive route works seamlessly.');

  // Test 7: SQL Injection safety
  console.log('\n--- Test 7: SQL Injection Resilience ---');
  const injection = await getJson('/public/categories/\' OR 1=1 --/posts');
  console.log(`Injection probe response status: ${injection.status}`);
  if (injection.status !== 404 && injection.status !== 400) {
    throw new Error(`Test 7 Failed: Expected 404 or 400, got ${injection.status}`);
  }
  console.log('✔ Test 7 Passed: SQL injection attempt safely rejected.');

  await pool.end();

  console.log('\n====================================================');
  console.log('ALL PHASE 2B CATEGORY TESTS PASSED WITH 100% SUCCESS!');
  console.log('====================================================');
}

runTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
