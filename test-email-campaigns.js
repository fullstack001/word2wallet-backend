const axios = require("axios");

// Test configuration
const BASE_URL = process.env.API_URL || "http://127.0.0.1:5000/api";
const TEST_USER = {
  email: "test@example.com",
  password: "testpassword123",
};

let authToken = "";

async function testEmailCampaigns() {
  try {
    console.log("🧪 Testing Email Campaign API...\n");

    // Step 1: Login to get auth token
    console.log("1. Logging in...");
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, TEST_USER);
    authToken = loginResponse.data.data.tokens.accessToken;
    console.log("✅ Login successful\n");

    // Step 2: Test getting user books
    console.log("2. Getting user books...");
    const booksResponse = await axios.get(`${BASE_URL}/email-campaigns/books`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(`✅ Found ${booksResponse.data.data.length} books\n`);

    // Step 3: Create a test campaign
    console.log("3. Creating test campaign...");
    const campaignData = {
      name: "Test Campaign",
      subject: "Test Email Subject",
      content:
        "<h1>Test Email Content</h1><p>This is a test email campaign.</p>",
      books: [],
      senderInfo: {
        name: "Test Sender",
        email: "sender@example.com",
        company: "Test Company",
      },
      settings: {
        trackOpens: true,
        trackClicks: true,
        unsubscribeLink: true,
      },
    };

    const createResponse = await axios.post(
      `${BASE_URL}/email-campaigns`,
      campaignData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    const campaignId = createResponse.data.data._id;
    console.log(`✅ Campaign created with ID: ${campaignId}\n`);

    // Step 4: Get all campaigns
    console.log("4. Getting all campaigns...");
    const campaignsResponse = await axios.get(`${BASE_URL}/email-campaigns`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log(
      `✅ Found ${campaignsResponse.data.data.campaigns.length} campaigns\n`
    );

    // Step 5: Get specific campaign
    console.log("5. Getting specific campaign...");
    const campaignResponse = await axios.get(
      `${BASE_URL}/email-campaigns/${campaignId}`,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    console.log(`✅ Campaign retrieved: ${campaignResponse.data.data.name}\n`);

    // Step 6: Update campaign
    console.log("6. Updating campaign...");
    const updateData = {
      name: "Updated Test Campaign",
      subject: "Updated Test Email Subject",
    };
    const updateResponse = await axios.put(
      `${BASE_URL}/email-campaigns/${campaignId}`,
      updateData,
      {
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    console.log(`✅ Campaign updated: ${updateResponse.data.data.name}\n`);

    // Step 7: Delete campaign
    console.log("7. Deleting campaign...");
    await axios.delete(`${BASE_URL}/email-campaigns/${campaignId}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    console.log("✅ Campaign deleted successfully\n");

    console.log("🎉 All email campaign tests passed!");
  } catch (error) {
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
      console.error("❌ Test failed: Cannot connect to backend server!");
      console.error(`   Error: ${errorMsg}`);
      console.error("   Please ensure the server is running on port 5000:");
      console.error("   npm run dev");
    } else {
      console.error("❌ Test failed:", error.response?.data || errorMsg);
    }
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testEmailCampaigns();
}

module.exports = testEmailCampaigns;
