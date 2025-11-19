#!/usr/bin/env node

/**
 * Run all QA tests in sequence
 *
 * Usage:
 *   node run-all-tests.js
 *   node run-all-tests.js --skip-email-deliverability
 *   node run-all-tests.js --only-api
 */

const { spawn } = require("child_process");
const path = require("path");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

const log = (message, color = "reset") => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

const runTest = (testFile, description) => {
  return new Promise((resolve, reject) => {
    log(`\n${"=".repeat(60)}`, "cyan");
    log(`Running: ${description}`, "cyan");
    log(`${"=".repeat(60)}`, "cyan");

    const testPath = path.join(__dirname, testFile);
    const child = spawn("node", [testPath], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        log(`\n✅ ${description} - PASSED`, "green");
        resolve(true);
      } else {
        log(`\n❌ ${description} - FAILED (exit code: ${code})`, "red");
        resolve(false);
      }
    });

    child.on("error", (error) => {
      log(`\n❌ Error running ${description}: ${error.message}`, "red");
      reject(error);
    });
  });
};

const main = async () => {
  const args = process.argv.slice(2);
  const skipEmailDeliverability = args.includes("--skip-email-deliverability");
  const onlyApi = args.includes("--only-api");

  log("\n🧪 Word2Wallet QA Test Suite", "magenta");
  log("=".repeat(60), "magenta");

  const results = [];

  try {
    // 1. Basic API Test
    if (!onlyApi || args.includes("--api")) {
      const passed = await runTest("test-api.js", "Basic API Test");
      results.push({ name: "Basic API Test", passed });
    }

    // 2. Content Generation Tests
    if (!onlyApi || args.includes("--content")) {
      const passed = await runTest(
        "test-content-generation.js",
        "Content Generation Tests"
      );
      results.push({ name: "Content Generation Tests", passed });
    }

    // 3. Email Campaign Tests
    if (!onlyApi || args.includes("--email-campaigns")) {
      const passed = await runTest(
        "test-email-campaigns.js",
        "Email Campaign Tests"
      );
      results.push({ name: "Email Campaign Tests", passed });
    }

    // 4. Email Deliverability Tests (optional, can be slow)
    if (
      !skipEmailDeliverability &&
      (!onlyApi || args.includes("--email-deliverability"))
    ) {
      const passed = await runTest(
        "test-email-deliverability.js",
        "Email Deliverability Tests"
      );
      results.push({ name: "Email Deliverability Tests", passed });
    }

    // Summary
    log("\n" + "=".repeat(60), "magenta");
    log("📊 Test Summary", "magenta");
    log("=".repeat(60), "magenta");

    results.forEach((result) => {
      const status = result.passed ? "✅ PASSED" : "❌ FAILED";
      const color = result.passed ? "green" : "red";
      log(`${status.padEnd(15)} ${result.name}`, color);
    });

    const passedCount = results.filter((r) => r.passed).length;
    const totalCount = results.length;
    const allPassed = passedCount === totalCount;

    log("\n" + "-".repeat(60), "cyan");
    log(
      `Total: ${passedCount}/${totalCount} tests passed`,
      allPassed ? "green" : "yellow"
    );
    log("-".repeat(60), "cyan");

    if (allPassed) {
      log("\n🎉 All tests passed!", "green");
      process.exit(0);
    } else {
      log("\n⚠️  Some tests failed. Please review the output above.", "yellow");
      process.exit(1);
    }
  } catch (error) {
    log(`\n💥 Test suite crashed: ${error.message}`, "red");
    process.exit(1);
  }
};

// Handle help flag
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
Usage: node run-all-tests.js [options]

Options:
  --skip-email-deliverability    Skip email deliverability tests (can be slow)
  --only-api                     Run only API-related tests
  --api                          Run basic API test
  --content                      Run content generation tests
  --email-campaigns              Run email campaign tests
  --email-deliverability         Run email deliverability tests
  --help, -h                     Show this help message

Examples:
  node run-all-tests.js
  node run-all-tests.js --skip-email-deliverability
  node run-all-tests.js --only-api --content
`);
  process.exit(0);
}

main();
