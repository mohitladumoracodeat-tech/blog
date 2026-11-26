import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

const tests = [
  "backend/tests/test_phase1g_hindi_translation.js",
  "backend/tests/test_phase2b_categories.js",
  "backend/tests/test_phase2c_newsletter.js",
  "backend/tests/test_phase3a_search.js",
  "backend/tests/test_phase3b_analytics.js",
  "backend/tests/test_sec_med_03_profile_image_ownership.js",
  "backend/tests/test_session_revocation.js",
  "backend/tests/test_session_cleanup_revocation.js",
  "backend/tests/test_email_service.js",
];

let allPassed = true;
const summary = [];

console.log("=== FIELDNOTES JOURNAL AUTOMATED REGRESSION RUNNER ===\n");

for (const test of tests) {
  const fullPath = path.resolve(repoRoot, test);
  try {
    const output = execSync(`node "${fullPath}"`, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const lines = output.trim().split("\n");
    const lastLines = lines.slice(-2).join(" | ");
    summary.push({ test, status: "PASSED", output: lastLines });
    console.log(`[PASS] ${test}: ${lastLines}`);
  } catch (err) {
    allPassed = false;
    summary.push({
      test,
      status: "FAILED",
      error: err.message,
      output: (err.stdout || err.stderr || "").slice(-300),
    });
    console.error(`[FAIL] ${test}`);
    console.error(err.stdout || err.stderr);
  }
}

console.log("\n=======================================");
console.log(`ALL ${tests.length} TEST SUITES: ${allPassed ? "ALL PASSED (100%)" : "FAILURES DETECTED"}`);
console.log("=======================================\n");

process.exit(allPassed ? 0 : 1);
