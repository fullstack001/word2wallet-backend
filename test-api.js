// Simple test script to verify backend API is working
const fetch = require("node-fetch");

const API_BASE = "http://localhost:5000/api";

async function testAPI() {
  console.log("Testing backend API...\n");

  // Test 1: Health check
  try {
    console.log("1. Testing health check...");
    const healthResponse = await fetch("http://localhost:5000/health");
    const healthData = await healthResponse.json();
    console.log("✅ Health check:", healthData);
  } catch (error) {
    console.log("❌ Health check failed:", error.message);
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
    });

    const registerData = await registerResponse.json();
    console.log("✅ Register endpoint response:", {
      status: registerResponse.status,
      data: registerData,
    });
  } catch (error) {
    console.log("❌ Register endpoint failed:", error.message);
  }

  // Test 3: Check if Stripe environment variables are set
  console.log("\n3. Checking environment variables...");
  const requiredEnvVars = [
    "STRIPE_SECRET_KEY",
    "STRIPE_PUBLISHABLE_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_BASIC_PRICE_ID",
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
