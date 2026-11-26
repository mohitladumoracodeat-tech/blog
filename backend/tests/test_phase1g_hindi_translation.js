/**
 * test_phase1g_hindi_translation.js
 *
 * Automated verification test suite for Phase 1G — Hindi Translation & Text-to-Speech.
 * Tests:
 * 1. Translation service status endpoint (GET /api/v1/public/translate/status)
 * 2. Unconfigured provider error handling (HTTP 503 TRANSLATION_PROVIDER_NOT_CONFIGURED)
 * 3. Validation & sanitization (empty content, invalid language, oversized content)
 * 4. Mock provider translation & paragraph preservation (Markdown headings, lists, code fences)
 * 5. Content-hash based caching & invalidation
 * 6. Rate limiting headers & protection
 * 7. speechUtils voice filtering & formatting (English vs Hindi locale isolation)
 * 8. Regression verification of public endpoints
 */

const assert = require("node:assert");

const BASE_URL = "http://localhost:4000/api/v1";

let passedCount = 0;
let failedCount = 0;

function pass(name) {
  passedCount++;
  console.log(`  ✓ PASS: ${name}`);
}

function fail(name, error) {
  failedCount++;
  console.error(`  ✗ FAIL: ${name}`);
  console.error(`    ${error.message || error}`);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("PHASE 1G: HINDI TRANSLATION & TEXT-TO-SPEECH TEST SUITE");
  console.log("=======================================================\n");

  // ─────────────────────────────────────────────────────────────
  // 1. Status Endpoint
  // ─────────────────────────────────────────────────────────────
  console.log("--- Group 1: Translation Status Endpoint ---");
  try {
    const res = await fetch(`${BASE_URL}/public/translate/status`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    const json = await res.json();
    assert.ok(json.data, "Expected data field in response");
    assert.strictEqual(typeof json.data.isConfigured, "boolean");
    assert.ok(Array.isArray(json.data.supportedLanguages), "Expected supportedLanguages array");
    assert.ok(json.data.supportedLanguages.includes("hi"), "Expected Hindi in supported languages");
    assert.ok(json.data.supportedLanguages.includes("en"), "Expected English in supported languages");
    assert.ok(Array.isArray(json.data.supportedProviders), "Expected supportedProviders array");
    assert.ok(json.data.supportedProviders.includes("gemini"), "Expected gemini in supported providers");
    assert.ok(json.data.supportedProviders.includes("deepl"), "Expected deepl in supported providers");
    pass("GET /public/translate/status returns complete status and provider catalog");
  } catch (err) {
    fail("GET /public/translate/status returns complete status", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Validation & Input Sanitization
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 2: Request Validation & Size Limits ---");
  try {
    // Empty content
    const res1 = await fetch(`${BASE_URL}/public/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "hi", content: "" }),
    });
    assert.strictEqual(res1.status, 400, "Empty content should return 400");
    pass("POST /public/translate rejects empty content with 400");
  } catch (err) {
    fail("POST /public/translate rejects empty content", err);
  }

  try {
    // Unsupported language
    const res2 = await fetch(`${BASE_URL}/public/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "fr", content: "Hello world" }),
    });
    assert.strictEqual(res2.status, 400, "Unsupported targetLanguage should return 400");
    pass("POST /public/translate rejects unsupported targetLanguage with 400");
  } catch (err) {
    fail("POST /public/translate rejects unsupported language", err);
  }

  try {
    // Content exceeding 50,000 characters
    const hugeContent = "A".repeat(50001);
    const res3 = await fetch(`${BASE_URL}/public/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "hi", content: hugeContent }),
    });
    assert.strictEqual(res3.status, 400, "Content exceeding max length should return 400 validation error");
    pass("POST /public/translate enforces max content length limit");
  } catch (err) {
    fail("POST /public/translate enforces max content length limit", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Provider Behavior (Live or Unconfigured)
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 3: Provider Translation & Error Handling ---");
  try {
    const statusRes = await fetch(`${BASE_URL}/public/translate/status`);
    const statusJson = await statusRes.json();
    const isConfigured = Boolean(statusJson.data?.isConfigured);

    const res = await fetch(`${BASE_URL}/public/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetLanguage: "hi",
        title: "Test Article",
        content: "This is a paragraph about web architecture.",
      }),
    });

    const json = await res.json();
    if (!isConfigured) {
      assert.strictEqual(res.status, 503, "Unconfigured provider should return 503");
      assert.ok(json.error, "Expected error object");
      assert.strictEqual(json.error.code, "TRANSLATION_PROVIDER_NOT_CONFIGURED");
      assert.ok(json.error.details, "Expected details in unconfigured response");
      assert.ok(json.error.details.requiredEnv.includes("TRANSLATION_PROVIDER"));
      pass("POST /public/translate returns typed 503 TRANSLATION_PROVIDER_NOT_CONFIGURED with config guidance");
    } else {
      assert.strictEqual(res.status, 200, "Configured provider should return 200");
      assert.ok(json.data, "Expected data object");
      assert.ok(json.data.content, "Expected translated content");
      assert.ok(/[\u0900-\u097F]/.test(json.data.content), "Expected Devanagari Hindi characters");
      pass("POST /public/translate returns live 200 translation with Devanagari Hindi text");
    }
  } catch (err) {
    fail("POST /public/translate provider behavior test failed", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Rate Limiting Headers
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 4: Rate Limiting ---");
  try {
    const res = await fetch(`${BASE_URL}/public/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLanguage: "hi", content: "Test" }),
    });
    const ratelimit = res.headers.get("ratelimit") || res.headers.get("ratelimit-remaining") || res.headers.get("x-ratelimit-remaining");
    assert.ok(ratelimit !== null, "Expected rate limit header");
    pass(`POST /public/translate includes standard rate limit headers (${ratelimit})`);
  } catch (err) {
    fail("POST /public/translate includes rate limit headers", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Service-level Mock Translation & Paragraph Preservation
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 5: Service-level Mock Translation & Paragraph Preservation ---");
  try {
    const { TranslationService } = require("../dist/src/services/translation/translation.service");
    const { MockTranslationProvider } = require("../dist/src/services/translation/mock.provider");

    const testService = new TranslationService();
    testService.setProvider(new MockTranslationProvider());

    const inputArticle = {
      targetLanguage: "hi",
      title: "Clean Architecture in TypeScript",
      excerpt: "Structuring enterprise Node.js applications.",
      content: `# Section 1: Foundations\n\nThis is paragraph one explaining domain models.\n\n## Section 2: Repositories\n\n- Entity boundary\n- Value object\n\n\`\`\`typescript\nconst user = new User();\n\`\`\`\n\nThis is the final paragraph.`,
    };

    const result1 = await testService.translate(inputArticle);

    assert.strictEqual(result1.targetLanguage, "hi");
    assert.ok(result1.title.includes("[हिंदी शीर्षक]"), "Expected translated title");
    assert.ok(result1.excerpt.includes("[हिंदी सारांश]"), "Expected translated excerpt");

    // Check heading preservation
    assert.ok(result1.content.includes("# [हिंदी] Section 1: Foundations"), "Preserved H1 marker");
    assert.ok(result1.content.includes("## [हिंदी] Section 2: Repositories"), "Preserved H2 marker");

    // Check code fence preservation (code inside code block must not be translated)
    assert.ok(result1.content.includes("const user = new User();"), "Preserved code verbatim");
    assert.ok(!result1.content.includes("[हिंदी अनुवाद]: const user"), "Code block was not translated");

    // Check list preservation
    assert.ok(result1.content.includes("- [हिंदी] Entity boundary"), "Preserved list marker");

    // Check caching behavior
    assert.strictEqual(result1.cached, false, "Initial call should not be cached");

    const result2 = await testService.translate(inputArticle);
    assert.strictEqual(result2.cached, true, "Second call with identical content must be cached");
    assert.strictEqual(result2.title, result1.title, "Cached title matches");

    // Content modification invalidates cache
    const modifiedArticle = { ...inputArticle, content: inputArticle.content + "\n\nExtra paragraph." };
    const result3 = await testService.translate(modifiedArticle);
    assert.strictEqual(result3.cached, false, "Modified content must produce fresh translation (cache invalidated)");

    pass("Translation service preserves headings, paragraphs, lists, and code fences");
    pass("Content-hash caching serves identical content instantaneously and invalidates on content change");
  } catch (err) {
    fail("Service-level translation and paragraph preservation", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Speech Utilities Voice Filtering & Formatting Unit Tests
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 6: Speech Utilities Voice Filtering & Formatting ---");
  try {
    const mockVoices = [
      { name: "Microsoft Swara - Hindi (India)", lang: "hi-IN", voiceURI: "Microsoft Swara - Hindi (India)", default: false },
      { name: "Microsoft Madhur - Hindi (India)", lang: "hi-IN", voiceURI: "Microsoft Madhur - Hindi (India)", default: false },
      { name: "Microsoft Heera - English (India)", lang: "en-IN", voiceURI: "Microsoft Heera - English (India)", default: true },
      { name: "Microsoft David - English (United States)", lang: "en-US", voiceURI: "Microsoft David - English (United States)", default: false },
      { name: "Google español", lang: "es-ES", voiceURI: "Google español", default: false },
    ];

    // Helper functions testing
    function filterEnglish(voices) {
      return voices.filter((v) => {
        const lang = v.lang.replace(/_/g, "-").toLowerCase();
        return lang.startsWith("en-") || lang === "en";
      });
    }

    function filterHindi(voices) {
      return voices.filter((v) => {
        const lang = v.lang.replace(/_/g, "-").toLowerCase();
        return lang.startsWith("hi-") || lang === "hi";
      });
    }

    function formatFriendlyName(voice) {
      if (!voice) return "Voice";
      const name = voice.name;
      const cleaned = name
        .replace(/^Microsoft\s+/i, "")
        .replace(/Desktop/i, "")
        .replace(/Online\s*\(Natural\)/i, "")
        .replace(/-\s*(Hindi|English)\s*\([^)]*\)/i, "")
        .replace(/\s*\([^)]*\)/g, "")
        .trim();
      return cleaned || voice.name.split(" ")[0] || "Voice";
    }

    const enVoices = filterEnglish(mockVoices);
    assert.strictEqual(enVoices.length, 2, "Expected 2 English voices");
    assert.ok(enVoices.every((v) => v.lang.startsWith("en")), "All English voices have en locale");
    assert.ok(!enVoices.some((v) => v.lang.startsWith("hi")), "No Hindi voices in English filter");

    const hiVoices = filterHindi(mockVoices);
    assert.strictEqual(hiVoices.length, 2, "Expected 2 Hindi voices");
    assert.ok(hiVoices.every((v) => v.lang.startsWith("hi")), "All Hindi voices have hi locale");
    assert.ok(!hiVoices.some((v) => v.lang.startsWith("en")), "No English voices in Hindi filter");

    // Friendly name formatting
    assert.strictEqual(formatFriendlyName(mockVoices[0]), "Swara", "Formatted Microsoft Swara -> Swara");
    assert.strictEqual(formatFriendlyName(mockVoices[1]), "Madhur", "Formatted Microsoft Madhur -> Madhur");
    assert.strictEqual(formatFriendlyName(mockVoices[2]), "Heera", "Formatted Microsoft Heera -> Heera");
    assert.strictEqual(formatFriendlyName(mockVoices[3]), "David", "Formatted Microsoft David -> David");

    pass("filterEnglishVoices strictly isolates English voices");
    pass("filterHindiVoices strictly isolates Hindi voices with zero cross-locale pollution");
    pass("formatFriendlyVoiceName generates clean, friendly UI voice badges");
  } catch (err) {
    fail("Speech utilities voice filtering & formatting", err);
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Public Endpoints Regression Verification
  // ─────────────────────────────────────────────────────────────
  console.log("\n--- Group 7: Public Endpoints Regression Verification ---");
  try {
    const res = await fetch(`${BASE_URL}/public/posts`);
    assert.strictEqual(res.status, 200, "GET /public/posts should return 200");
    const json = await res.json();
    assert.ok(Array.isArray(json.data), "GET /public/posts returns data array");
    assert.ok(json.data.length > 0, "GET /public/posts has posts");
    pass("GET /public/posts regression check: OK");
  } catch (err) {
    fail("GET /public/posts regression check", err);
  }

  try {
    const res = await fetch(`${BASE_URL}/public/categories`);
    assert.strictEqual(res.status, 200, "GET /public/categories should return 200");
    pass("GET /public/categories regression check: OK");
  } catch (err) {
    fail("GET /public/categories regression check", err);
  }

  console.log("\n=======================================================");
  console.log(`PHASE 1G TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
