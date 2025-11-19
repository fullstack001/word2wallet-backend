/**
 * Test script for Content Generation API validation
 *
 * Run this script after starting the backend server to test validation:
 * node test-content-generation.js
 */

const axios = require("axios");

// Configuration
const API_BASE_URL = process.env.API_URL || "http://127.0.0.1:5000/api";
// Default admin credentials match server defaults (from createAdminUser.ts)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@word2wallet.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";

let authToken = "";

// Color codes for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

// Helper functions
const log = (message, color = "reset") => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const logTestResult = (testName, passed, details = "") => {
  const status = passed ? "✓" : "✗";
  const color = passed ? "green" : "red";
  log(`${status} ${testName}`, color);
  if (details) {
    log(`  ${details}`, "yellow");
  }
};

const makeRequest = async (endpoint, data, expectSuccess = true) => {
  try {
    const response = await axios.post(`${API_BASE_URL}${endpoint}`, data, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        data: error.response.data,
        status: error.response.status,
      };
    }
    throw error;
  }
};

// Login to get auth token
const login = async () => {
  log("\n=== Logging in as admin ===", "cyan");
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    authToken = response.data.data.tokens.accessToken;
    log("✓ Login successful", "green");
    return true;
  } catch (error) {
    log("✗ Login failed", "red");
    const errorCode = error.code || error.cause?.code || "";
    const errorMsg = error.message || String(error);
    const isConnectionError = 
      errorCode === "ECONNREFUSED" ||
      errorCode === "EACCES" ||
      errorCode === "ENOTFOUND" ||
      errorMsg.includes("EACCES") ||
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("connect") ||
      errorMsg.includes("network") ||
      (error.response === undefined && error.request !== undefined);
    
    if (isConnectionError) {
      log("Error: Cannot connect to backend server!", "red");
      log(`   Error: ${errorMsg}`, "red");
      log("   Please ensure the server is running on port 5000:", "yellow");
      log("   npm run dev", "yellow");
    } else {
      const errorMessage = error.response?.data?.message || errorMsg;
      log(`Error: ${errorMessage}`, "red");
      if (errorMessage.includes("Invalid email or password")) {
        log("", "yellow");
        log("💡 Tip: Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables", "yellow");
        log(`   Current: ${ADMIN_EMAIL} / ${"*".repeat(ADMIN_PASSWORD.length)}`, "yellow");
        log("   Or ensure admin user exists with matching credentials", "yellow");
      }
    }
    return false;
  }
};

// Test cases
const runTests = async () => {
  log("\n=== Content Generation Validation Tests ===", "blue");

  // Test 1: Missing mode
  log("\n--- Test 1: Missing mode ---", "cyan");
  const test1 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      title: "Test Title",
    },
    false
  );
  logTestResult(
    "Should fail when mode is missing",
    !test1.success && test1.data.errors?.some((e) => e.path === "mode"),
    test1.data.errors?.[0]?.msg
  );

  // Test 2: Invalid mode
  log("\n--- Test 2: Invalid mode ---", "cyan");
  const test2 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "INVALID_MODE",
    },
    false
  );
  logTestResult(
    "Should fail with invalid mode value",
    !test2.success &&
      test2.data.errors?.some((e) => e.msg.includes("RAW_XHTML")),
    test2.data.errors?.[0]?.msg
  );

  // Test 3: RAW_XHTML without html
  log("\n--- Test 3: RAW_XHTML without html ---", "cyan");
  const test3 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "RAW_XHTML",
    },
    false
  );
  logTestResult(
    "Should fail when RAW_XHTML mode missing html",
    !test3.success && test3.data.errors?.some((e) => e.path === "html"),
    test3.data.errors?.[0]?.msg
  );

  // Test 4: RAW_XHTML with empty html
  log("\n--- Test 4: RAW_XHTML with empty html ---", "cyan");
  const test4 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "RAW_XHTML",
      html: "",
    },
    false
  );
  logTestResult(
    "Should fail when html is empty",
    !test4.success && test4.data.errors?.some((e) => e.path === "html"),
    test4.data.errors?.[0]?.msg
  );

  // Test 5: RAW_XHTML with valid html
  log("\n--- Test 5: RAW_XHTML with valid html ---", "cyan");
  const test5 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "RAW_XHTML",
      html: "<h2>Test Content</h2><p>This is a test.</p>",
    },
    true
  );
  logTestResult(
    "Should succeed with valid RAW_XHTML request",
    test5.success && test5.data.data?.mode === "RAW_XHTML",
    test5.success ? "Content sanitized successfully" : test5.data.message
  );

  // Test 6: STRICT_NATIVE_BLOCKS with minimal data
  log("\n--- Test 6: STRICT_NATIVE_BLOCKS minimal request ---", "cyan");
  const test6 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "STRICT_NATIVE_BLOCKS",
    },
    true
  );
  logTestResult(
    "Should succeed with minimal STRICT_NATIVE_BLOCKS request",
    test6.success || test6.status === 503, // 503 if OpenAI not configured
    test6.success ? "Content generated" : test6.data.message
  );

  // Test 7: STRICT_NATIVE_BLOCKS with title too short
  log("\n--- Test 7: STRICT_NATIVE_BLOCKS title too short ---", "cyan");
  const test7 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "STRICT_NATIVE_BLOCKS",
      title: "Hi",
    },
    false
  );
  logTestResult(
    "Should fail when title is too short",
    !test7.success && test7.data.errors?.some((e) => e.path === "title"),
    test7.data.errors?.[0]?.msg
  );

  // Test 8: STRICT_NATIVE_BLOCKS with description too short
  log("\n--- Test 8: STRICT_NATIVE_BLOCKS description too short ---", "cyan");
  const test8 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "STRICT_NATIVE_BLOCKS",
      description: "Too short",
    },
    false
  );
  logTestResult(
    "Should fail when description is too short",
    !test8.success && test8.data.errors?.some((e) => e.path === "description"),
    test8.data.errors?.[0]?.msg
  );

  // Test 9: STRICT_NATIVE_BLOCKS with valid data
  log("\n--- Test 9: STRICT_NATIVE_BLOCKS with valid data ---", "cyan");
  const test9 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "STRICT_NATIVE_BLOCKS",
      title: "Introduction to AI",
      description:
        "Learn the basics of artificial intelligence and machine learning.",
      courseTitle: "AI Fundamentals",
      subjectName: "Computer Science",
    },
    true
  );
  logTestResult(
    "Should succeed with valid STRICT_NATIVE_BLOCKS request",
    test9.success || test9.status === 503,
    test9.success ? "Content generated successfully" : test9.data.message
  );

  // Test 10: Invalid strict field type
  log("\n--- Test 10: Invalid strict field type ---", "cyan");
  const test10 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "STRICT_NATIVE_BLOCKS",
      strict: "yes",
    },
    false
  );
  logTestResult(
    "Should fail when strict is not a boolean",
    !test10.success && test10.data.errors?.some((e) => e.path === "strict"),
    test10.data.errors?.[0]?.msg
  );

  // Test 11: HTML too long (simulated)
  log("\n--- Test 11: HTML content length validation ---", "cyan");
  const longHtml = "<p>" + "a".repeat(50001) + "</p>";
  const test11 = await makeRequest(
    "/content-generation/generate-chapter-content",
    {
      mode: "RAW_XHTML",
      html: longHtml,
    },
    false
  );
  logTestResult(
    "Should fail when html exceeds 50,000 characters",
    !test11.success && test11.data.errors?.some((e) => e.path === "html"),
    test11.data.errors?.[0]?.msg
  );

  log("\n=== Tests Complete ===\n", "blue");
};

// Run the tests
const main = async () => {
  log("Content Generation API Validation Test Suite", "blue");
  log("============================================\n", "blue");

  const loginSuccess = await login();
  if (!loginSuccess) {
    log(
      "\nCannot proceed without authentication. Please check your credentials.",
      "red"
    );
    process.exit(1);
  }

  try {
    await runTests();
  } catch (error) {
    log("\n✗ Test suite failed with error:", "red");
    const errorCode = error.code || error.cause?.code || "";
    const errorMsg = error.message || String(error);
    const isConnectionError = 
      errorCode === "ECONNREFUSED" ||
      errorCode === "EACCES" ||
      errorCode === "ENOTFOUND" ||
      errorMsg.includes("EACCES") ||
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("connect") ||
      errorMsg.includes("network") ||
      (error.response === undefined && error.request !== undefined);
    
    if (isConnectionError) {
      log("Cannot connect to backend server!", "red");
      log(`   Error: ${errorMsg}`, "red");
      log("   Please ensure the server is running on port 5000:", "yellow");
      log("   npm run dev", "yellow");
    } else {
      log(errorMsg, "red");
      if (error.response) {
        log(JSON.stringify(error.response.data, null, 2), "yellow");
      }
    }
    process.exit(1);
  }
};

main();
