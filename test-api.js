// Simple test script to verify backend API is working
// Using Node.js built-in fetch (available in Node 18+)
// Try both localhost and 127.0.0.1 to handle IPv6/IPv4 issues
const SERVER_URL = process.env.API_URL || "http://127.0.0.1:5000";
const API_BASE = `${SERVER_URL}/api`;

async function testAPI() {
  console.log("Testing backend API...\n");

  // Test 1: Health check
  try {
    console.log("1. Testing health check...");
    const healthResponse = await fetch(`${SERVER_URL}/health`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (!healthResponse.ok) {
      throw new Error(
        `HTTP ${healthResponse.status}: ${healthResponse.statusText}`
      );
    }
    const healthData = await healthResponse.json();
    console.log("✅ Health check:", healthData);
  } catch (error) {
    const errorMsg = error.message || String(error);
    const errorCode = error.code || "";
    const errorCause = error.cause?.code || "";

    // Check for connection errors
    if (
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("EACCES") ||
      errorMsg.includes("fetch failed") ||
      errorMsg.includes("network") ||
      errorMsg.includes("timeout") ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "EACCES" ||
      errorCause === "ECONNREFUSED" ||
      errorCause === "EACCES" ||
      error.name === "AbortError"
    ) {
      console.log("❌ Health check failed: Cannot connect to backend server!");
      console.log(`   Error: ${errorMsg}`);
      console.log("   Please ensure the server is running on port 5000:");
      console.log("   npm run dev");
      process.exit(1);
    }
    console.log("❌ Health check failed:", errorMsg);
    if (error.code) console.log("   Error code:", error.code);
  }

  // Test 2: Auth register endpoint
  try {
    console.log("\n2. Testing auth register endpoint...");
    const registerResponse = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "test@example.com",
        password: "testpassword123",
        firstName: "Test",
        lastName: "User",
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const registerData = await registerResponse.json();
    console.log("✅ Register endpoint response:", {
      status: registerResponse.status,
      data: registerData,
    });
  } catch (error) {
    const errorMsg = error.message || String(error);
    const errorCode = error.code || "";
    const errorCause = error.cause?.code || "";

    // Check for connection errors
    if (
      errorMsg.includes("ECONNREFUSED") ||
      errorMsg.includes("EACCES") ||
      errorMsg.includes("fetch failed") ||
      errorMsg.includes("network") ||
      errorMsg.includes("timeout") ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "EACCES" ||
      errorCause === "ECONNREFUSED" ||
      errorCause === "EACCES" ||
      error.name === "AbortError"
    ) {
      console.log(
        "❌ Register endpoint failed: Cannot connect to backend server!"
      );
      console.log(`   Error: ${errorMsg}`);
      console.log("   Please ensure the server is running on port 5000:");
      console.log("   npm run dev");
      process.exit(1);
    }
    console.log("❌ Register endpoint failed:", errorMsg);
    if (error.code) console.log("   Error code:", error.code);
  }

  // Test 3: Check if Stripe environment variables are set
  console.log("\n3. Checking environment variables...");
  const requiredEnvVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PREMIUM_PRICE_ID",
  ];

  requiredEnvVars.forEach((varName) => {
    const value = process.env[varName];
    if (value) {
      console.log(`✅ ${varName}: Set`);
    } else {
      console.log(`❌ ${varName}: Not set`);
    }
  });
}

testAPI().catch(console.error);
