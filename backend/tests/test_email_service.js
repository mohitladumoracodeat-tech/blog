// ============================================================================
// Fieldnotes Journal — Email Service & Transport Automated Verification Tests
// ============================================================================

import assert from "node:assert/strict";
import {
  maskEmail,
  getPublicSiteUrl,
  isSmtpConfigured,
  setMockEmailTransport,
  sendPasswordResetEmail,
  sendNewsletterVerificationEmail,
  sendNewsletterWelcomeEmail,
} from "../dist/src/services/email.service.js";

async function runTests() {
  console.log("Starting Email Service & Transport Verification Tests...\n");
  let passed = 0;

  // Test 1: Email Masking Utility
  console.log("Test 1: Email masking for privacy");
  assert.equal(maskEmail("mohit@example.com"), "m***t@example.com");
  assert.equal(maskEmail("ab@example.com"), "a***@example.com");
  assert.equal(maskEmail("invalid-email"), "***");
  console.log("✓ Email masking works correctly.\n");
  passed++;

  // Test 2: Unconfigured SMTP Fallback Gracefulness
  console.log("Test 2: Unconfigured SMTP fallback");
  setMockEmailTransport(null);
  const unconfiguredReset = await sendPasswordResetEmail("user@example.com", "test-token-12345");
  assert.equal(unconfiguredReset.delivered, false);
  assert.equal(unconfiguredReset.providerConfigured, false);
  assert.equal(typeof unconfiguredReset.devToken, "string");
  console.log("✓ Fallback when SMTP is unconfigured succeeds gracefully without errors.\n");
  passed++;

  // Test 3: Mock Transporter for Password Reset
  console.log("Test 3: Password reset delivery via mock transporter");
  const sentEmails = [];
  const mockTransport = {
    async sendMail(mailOptions) {
      sentEmails.push(mailOptions);
      return { messageId: "mock-msg-" + Date.now() };
    },
  };
  setMockEmailTransport(mockTransport);
  assert.equal(isSmtpConfigured(), true);

  const resetResult = await sendPasswordResetEmail("reader@example.com", "reset-token-secret-xyz");
  assert.equal(resetResult.delivered, true);
  assert.equal(resetResult.providerConfigured, true);
  assert(resetResult.messageId.startsWith("mock-msg-"));
  assert.equal(sentEmails.length, 1);
  assert.equal(sentEmails[0].to, "reader@example.com");
  assert(sentEmails[0].subject.includes("Reset Your Password"));
  assert(sentEmails[0].text.includes("reset-token-secret-xyz"));
  assert(sentEmails[0].html.includes("Reset Password"));
  console.log("✓ Password reset email generated with HTML & text templates and dispatched.\n");
  passed++;

  // Test 4: Mock Transporter for Newsletter Double Opt-In Verification
  console.log("Test 4: Newsletter verification delivery via mock transporter");
  const verifyResult = await sendNewsletterVerificationEmail(
    "subscriber@example.com",
    "verify-token-abc-999",
    "unsub-token-xyz-111",
  );
  assert.equal(verifyResult.delivered, true);
  assert.equal(verifyResult.providerConfigured, true);
  assert.equal(sentEmails.length, 2);
  const verifyEmail = sentEmails[1];
  assert.equal(verifyEmail.to, "subscriber@example.com");
  assert(verifyEmail.subject.includes("Confirm Your Subscription"));
  assert(verifyEmail.text.includes("verify-token-abc-999"));
  assert(verifyEmail.text.includes("unsub-token-xyz-111"));
  assert(verifyEmail.html.includes("Confirm Subscription"));
  console.log("✓ Double opt-in newsletter verification email generated and dispatched.\n");
  passed++;

  // Test 5: Mock Transporter for Newsletter Welcome Email
  console.log("Test 5: Newsletter welcome email delivery via mock transporter");
  const welcomeResult = await sendNewsletterWelcomeEmail("subscriber@example.com", "unsub-token-xyz-111");
  assert.equal(welcomeResult.delivered, true);
  assert.equal(welcomeResult.providerConfigured, true);
  assert.equal(sentEmails.length, 3);
  const welcomeEmail = sentEmails[2];
  assert.equal(welcomeEmail.to, "subscriber@example.com");
  assert(welcomeEmail.subject.includes("Welcome to Fieldnotes Journal"));
  assert(welcomeEmail.text.includes("unsub-token-xyz-111"));
  assert(welcomeEmail.html.includes("Subscription Confirmed"));
  console.log("✓ Newsletter welcome email generated and dispatched.\n");
  passed++;

  // Test 6: Error Handling on Transport Failure
  console.log("Test 6: Transport error handling");
  const failingTransport = {
    async sendMail() {
      throw new Error("Simulated SMTP Connection Timeout");
    },
  };
  setMockEmailTransport(failingTransport);
  const failedResult = await sendPasswordResetEmail("reader@example.com", "fail-token");
  assert.equal(failedResult.delivered, false);
  assert.equal(failedResult.providerConfigured, true);
  assert.equal(failedResult.error, "Simulated SMTP Connection Timeout");
  console.log("✓ Transport errors handled gracefully without uncaught exceptions.\n");
  passed++;

  // Reset mock transporter
  setMockEmailTransport(null);

  console.log(`=======================================================`);
  console.log(`Email Service Verification: ALL ${passed}/6 TESTS PASSED!`);
  console.log(`=======================================================\n`);
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
