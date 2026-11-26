/**
 * Phase 3B: Search Analytics & Zero-Result Insights Automated Test Suite
 * Fieldnotes Journal API Verification
 *
 * Test Matrix:
 *  1. Search event recording accuracy on GET /public/posts (when not autocomplete)
 *  2. Autocomplete search isolation (no duplicate analytics on autocomplete=true)
 *  3. Explicit search event recording via POST /public/search-events
 *  4. Zero-result search recording (results_count=0, has_results=0)
 *  5. Category-scoped search analytics tracking
 *  6. Admin authorization enforcement (guest 401, non-admin 403, admin 200)
 *  7. Rate limiting & input validation on search events (< 2 chars, > 160 chars)
 *  8. SQL injection resistance on analytics endpoints
 *  9. Admin overview KPIs & timeline trend aggregation
 * 10. Admin zero-result content opportunities report & pagination
 * 11. Admin recent search stream & outcome filters
 * 12. Search analytics prune API
 */

const BASE_URL = process.env.API_BASE_URL || "http://localhost:4000/api/v1";

async function runTests() {
  console.log("══════════════════════════════════════════════════════════════════");
  console.log("  PHASE 3B: SEARCH ANALYTICS AUTOMATED TEST SUITE");
  console.log("  Target URL:", BASE_URL);
  console.log("══════════════════════════════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // Helper for requests
  async function request(method, path, options = {}) {
    const url = new URL(BASE_URL + path);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          url.searchParams.set(k, String(v));
        }
      });
    }

    const headers = {
      "Content-Type": "application/json",
      "x-test-suite": "audit",
      ...(options.headers || {}),
    };

    if (options.cookie) {
      headers["Cookie"] = options.cookie;
    }

    const fetchOpts = {
      method,
      headers,
    };

    if (options.body) {
      fetchOpts.body = JSON.stringify(options.body);
    }

    const res = await fetch(url.toString(), fetchOpts);
    const json = await res.json().catch(() => null);
    return { status: res.status, data: json, headers: res.headers };
  }

  try {
    // ------------------------------------------------------------------------
    // Step 0: Authentication Setup
    // ------------------------------------------------------------------------
    console.log("[Setup] Authenticating test accounts...");
    // Admin login
    const adminLogin = await request("POST", "/auth/login", {
      body: { email: "admin@example.com", password: "AdminPassword123!" },
    });
    const adminCookie = adminLogin.headers.get("set-cookie")?.split(";")[0] || "";
    assert(adminLogin.status === 200 && !!adminCookie, "Admin authenticated successfully");

    // Regular user login (reader@example.com)
    let userCookie = "";
    const userLogin = await request("POST", "/auth/login", {
      body: { email: "reader@example.com", password: "ReaderPassword123!" },
    });
    if (userLogin.status === 200) {
      userCookie = userLogin.headers.get("set-cookie")?.split(";")[0] || "";
    }

    // ------------------------------------------------------------------------
    // Test 1: Search event recording on GET /public/posts
    // ------------------------------------------------------------------------
    console.log("\n[Test 1] Search event recording on public search");
    const testTerm1 = `TestTerm_${Date.now()}`;
    const searchRes = await request("GET", "/public/posts", {
      params: { search: testTerm1 },
    });
    assert(searchRes.status === 200, "GET /public/posts with search term returns 200");

    // Give async recording a moment
    await new Promise((r) => setTimeout(r, 200));

    // Verify it was logged in admin recent searches
    const verifyRecent = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { search: testTerm1 },
    });
    assert(verifyRecent.status === 200, "Admin can query recent search logs");
    const foundLog = (verifyRecent.data?.data || []).find((l) => l.searchQuery === testTerm1);
    assert(!!foundLog, "Search query is recorded in search_analytics");
    assert(foundLog?.normalizedQuery === testTerm1.toLowerCase(), "Normalized query is correctly lowercased");

    // ------------------------------------------------------------------------
    // Test 2: Autocomplete search isolation
    // ------------------------------------------------------------------------
    console.log("\n[Test 2] Autocomplete search isolation (no duplicate analytics)");
    const autoTerm = `AutoComplete_${Date.now()}`;
    const autoRes = await request("GET", "/public/posts", {
      params: { search: autoTerm, autocomplete: "true" },
    });
    assert(autoRes.status === 200, "GET /public/posts with autocomplete=true returns 200");

    await new Promise((r) => setTimeout(r, 200));

    const verifyAuto = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { search: autoTerm },
    });
    const foundAutoLog = (verifyAuto.data?.data || []).find((l) => l.searchQuery === autoTerm);
    assert(!foundAutoLog, "Autocomplete queries with autocomplete=true are NOT recorded (0 duplicate logs)");

    // ------------------------------------------------------------------------
    // Test 3: Explicit search event recording via POST /public/search-events
    // ------------------------------------------------------------------------
    console.log("\n[Test 3] Explicit search event recording via POST /public/search-events");
    const explicitTerm = `Explicit_Click_${Date.now()}`;
    const postEventRes = await request("POST", "/public/search-events", {
      body: { query: explicitTerm, resultsCount: 4, category: "web-development" },
    });
    assert(postEventRes.status === 201, "POST /public/search-events returns 201 Created");
    assert(postEventRes.data?.data?.recorded === true, "Response confirms { recorded: true }");

    await new Promise((r) => setTimeout(r, 200));

    const verifyExplicit = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { search: explicitTerm },
    });
    const explicitLog = (verifyExplicit.data?.data || []).find((l) => l.searchQuery === explicitTerm);
    assert(!!explicitLog, "Explicit event is logged in search_analytics");
    assert(explicitLog?.resultsCount === 4, "Results count matches payload (4)");
    assert(explicitLog?.categoryScope === "web-development", "Category scope matches payload");
    assert(explicitLog?.hasResults === true, "hasResults is true for resultsCount > 0");

    // ------------------------------------------------------------------------
    // Test 4: Zero-result search recording
    // ------------------------------------------------------------------------
    console.log("\n[Test 4] Zero-result search recording");
    const zeroTerm = `NonExistentTopic_${Date.now()}`;
    const zeroSearchRes = await request("GET", "/public/posts", {
      params: { search: zeroTerm },
    });
    assert(zeroSearchRes.status === 200, "Zero-result query executes successfully");
    assert((zeroSearchRes.data?.data || []).length === 0, "No stories match the zero-result query");

    await new Promise((r) => setTimeout(r, 200));

    const verifyZero = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { search: zeroTerm },
    });
    const zeroLog = (verifyZero.data?.data || []).find((l) => l.searchQuery === zeroTerm);
    assert(!!zeroLog, "Zero-result query is recorded in search_analytics");
    assert(zeroLog?.resultsCount === 0, "Zero-result record has resultsCount === 0");
    assert(zeroLog?.hasResults === false, "Zero-result record has hasResults === false");

    // ------------------------------------------------------------------------
    // Test 5: Category-scoped search tracking
    // ------------------------------------------------------------------------
    console.log("\n[Test 5] Category-scoped search tracking");
    const scopedTerm = `Scoped_Query_${Date.now()}`;
    await request("GET", "/public/posts", {
      params: { search: scopedTerm, category: "cloud-and-devops" },
    });

    await new Promise((r) => setTimeout(r, 200));

    const verifyScoped = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { search: scopedTerm },
    });
    const scopedLog = (verifyScoped.data?.data || []).find((l) => l.searchQuery === scopedTerm);
    assert(!!scopedLog, "Category-scoped query is logged");
    assert(scopedLog?.categoryScope === "cloud-and-devops", "Category scope recorded as 'cloud-and-devops'");

    // ------------------------------------------------------------------------
    // Test 6: Admin authorization enforcement
    // ------------------------------------------------------------------------
    console.log("\n[Test 6] Admin authorization enforcement");
    // Guest attempt (no cookie)
    const guestOverview = await request("GET", "/admin/search-analytics/overview");
    assert(guestOverview.status === 401, "Guest access to /admin/search-analytics/overview returns 401");

    const guestZero = await request("GET", "/admin/search-analytics/zero-results");
    assert(guestZero.status === 401, "Guest access to /admin/search-analytics/zero-results returns 401");

    const guestRecent = await request("GET", "/admin/search-analytics/recent");
    assert(guestRecent.status === 401, "Guest access to /admin/search-analytics/recent returns 401");

    // Non-admin user attempt (if user exists)
    if (userCookie) {
      const userOverview = await request("GET", "/admin/search-analytics/overview", {
        cookie: userCookie,
      });
      assert(userOverview.status === 403, "Regular user access returns 403 Forbidden");
    }

    // Admin access
    const adminOverview = await request("GET", "/admin/search-analytics/overview", {
      cookie: adminCookie,
    });
    assert(adminOverview.status === 200, "Admin access returns 200 OK");

    // ------------------------------------------------------------------------
    // Test 7: Input validation & boundaries on search events
    // ------------------------------------------------------------------------
    console.log("\n[Test 7] Input validation & boundaries on search events");
    // Too short (< 2 chars)
    const shortRes = await request("POST", "/public/search-events", {
      body: { query: "a" },
    });
    assert(shortRes.status === 400, "Query with length < 2 rejected with 400");

    // Empty query
    const emptyRes = await request("POST", "/public/search-events", {
      body: { query: "   " },
    });
    assert(emptyRes.status === 400, "Whitespace-only query rejected with 400");

    // Excessively long (> 160 chars)
    const longQuery = "a".repeat(161);
    const longRes = await request("POST", "/public/search-events", {
      body: { query: longQuery },
    });
    assert(longRes.status === 400, "Query with length > 160 rejected with 400");

    // ------------------------------------------------------------------------
    // Test 8: SQL injection resistance on analytics endpoints
    // ------------------------------------------------------------------------
    console.log("\n[Test 8] SQL injection resistance");
    const injectionQueries = [
      "' OR '1'='1",
      "'; DROP TABLE search_analytics; --",
      "\" OR \"\"=\"",
      "%27%20OR%201=1--",
    ];

    for (const inj of injectionQueries) {
      const injRes = await request("GET", "/admin/search-analytics/recent", {
        cookie: adminCookie,
        params: { search: inj },
      });
      assert(injRes.status === 200, `SQL injection probe safely handled: ${inj.slice(0, 20)}`);
      assert(Array.isArray(injRes.data?.data), "Data array returned safely without SQL syntax error");
    }

    // ------------------------------------------------------------------------
    // Test 9: Admin overview KPIs & timeline trend aggregation
    // ------------------------------------------------------------------------
    console.log("\n[Test 9] Admin overview KPIs & timeline trend aggregation");
    const overviewRes = await request("GET", "/admin/search-analytics/overview", {
      cookie: adminCookie,
      params: { period: "30d" },
    });
    assert(overviewRes.status === 200, "Overview query returns 200");
    const summary = overviewRes.data?.data?.summary;
    assert(typeof summary?.totalSearches === "number", "summary.totalSearches is a number");
    assert(typeof summary?.uniqueTerms === "number", "summary.uniqueTerms is a number");
    assert(typeof summary?.zeroResultSearches === "number", "summary.zeroResultSearches is a number");
    assert(typeof summary?.successfulSearches === "number", "summary.successfulSearches is a number");
    assert(typeof summary?.zeroResultRate === "number", "summary.zeroResultRate is a number");
    assert(Array.isArray(overviewRes.data?.data?.activityTrend), "activityTrend is an array");
    assert(Array.isArray(overviewRes.data?.data?.topKeywords), "topKeywords is an array");
    assert(Array.isArray(overviewRes.data?.data?.topZeroResultKeywords), "topZeroResultKeywords is an array");

    // ------------------------------------------------------------------------
    // Test 10: Admin zero-result content opportunities report & pagination
    // ------------------------------------------------------------------------
    console.log("\n[Test 10] Admin zero-result content opportunities report");
    const zeroReport = await request("GET", "/admin/search-analytics/zero-results", {
      cookie: adminCookie,
      params: { page: 1, limit: 5 },
    });
    assert(zeroReport.status === 200, "GET /admin/search-analytics/zero-results returns 200");
    assert(Array.isArray(zeroReport.data?.data), "Zero-result data is an array");
    assert(zeroReport.data?.pagination?.page === 1, "Pagination reports page 1");
    assert(typeof zeroReport.data?.pagination?.total === "number", "Pagination reports total");

    if (zeroReport.data?.data?.length > 0) {
      const item = zeroReport.data.data[0];
      assert(typeof item.normalizedQuery === "string", "Item has normalizedQuery");
      assert(typeof item.originalQuery === "string", "Item has originalQuery");
      assert(typeof item.count === "number", "Item has count");
      assert("lastCategory" in item, "Item has lastCategory");
      assert("lastSearchedAt" in item, "Item has lastSearchedAt");
    }

    // ------------------------------------------------------------------------
    // Test 11: Admin recent search stream & outcome filters
    // ------------------------------------------------------------------------
    console.log("\n[Test 11] Admin recent search stream & outcome filters");
    const filterAll = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { hasResults: "ALL", limit: 5 },
    });
    const filterTrue = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { hasResults: "true", limit: 5 },
    });
    const filterFalse = await request("GET", "/admin/search-analytics/recent", {
      cookie: adminCookie,
      params: { hasResults: "false", limit: 5 },
    });

    assert(filterAll.status === 200, "hasResults=ALL returns 200");
    assert(filterTrue.status === 200, "hasResults=true returns 200");
    assert(filterFalse.status === 200, "hasResults=false returns 200");

    const allTrueMatch = (filterTrue.data?.data || []).every((l) => l.hasResults === true);
    assert(allTrueMatch, "hasResults=true filter only returns records with hasResults=true");

    const allFalseMatch = (filterFalse.data?.data || []).every((l) => l.hasResults === false);
    assert(allFalseMatch, "hasResults=false filter only returns records with hasResults=false");

    // ------------------------------------------------------------------------
    // Test 12: Search analytics prune API
    // ------------------------------------------------------------------------
    console.log("\n[Test 12] Search analytics prune API");
    // Prune test queries older than 365 days
    const pruneRes = await request("DELETE", "/admin/search-analytics/prune", {
      cookie: adminCookie,
      params: { olderThanDays: 365 },
    });
    assert(pruneRes.status === 200, "DELETE /admin/search-analytics/prune returns 200");
    assert(typeof pruneRes.data?.data?.deletedCount === "number", "Prune returns deletedCount");

    console.log("\n══════════════════════════════════════════════════════════════════");
    console.log(`  PHASE 3B TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("══════════════════════════════════════════════════════════════════\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed with error:", err);
    process.exit(1);
  }
}

runTests();
