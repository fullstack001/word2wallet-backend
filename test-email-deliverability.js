#!/usr/bin/env node

/**
 * Email Deliverability Testing Script
 *
 * This script helps you test your email setup to avoid spam folder
 *
 * Usage:
 * node test-email-deliverability.js
 */

const https = require("https");
const http = require("http");

// Configuration
const DOMAIN = process.env.MAILGUN_DOMAIN || "mg.yourdomain.com";
const API_KEY = process.env.MAILGUN_API_KEY || "your-mailgun-api-key";
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL || "noreply@yourdomain.com";

// Test email addresses (use your own for testing)
const TEST_EMAILS = ["mr.dimas332@gmail.com"];

/**
 * Test SPF Record
 */
async function testSPFRecord(domain) {
  console.log("🔍 Testing SPF Record...");

  try {
    const response = await makeRequest(
      `https://dns.google/resolve?name=${domain}&type=TXT`
    );
    const data = JSON.parse(response);

    const spfRecord = data.Answer?.find(
      (record) =>
        record.data.includes("v=spf1") && record.data.includes("mailgun.org")
    );

    if (spfRecord) {
      console.log("✅ SPF Record found:", spfRecord.data);
      return true;
    } else {
      console.log("❌ SPF Record not found or incorrect");
      return false;
    }
  } catch (error) {
    console.log("❌ Error checking SPF record:", error.message);
    return false;
  }
}

/**
 * Test DKIM Record
 */
async function testDKIMRecord(domain) {
  console.log("🔍 Testing DKIM Record...");

  try {
    const dkimDomain = `mg._domainkey.${domain}`;
    const response = await makeRequest(
      `https://dns.google/resolve?name=${dkimDomain}&type=TXT`
    );
    const data = JSON.parse(response);

    const dkimRecord = data.Answer?.find(
      (record) => record.data.includes("k=rsa") && record.data.includes("p=")
    );

    if (dkimRecord) {
      console.log(
        "✅ DKIM Record found:",
        dkimRecord.data.substring(0, 50) + "..."
      );
      return true;
    } else {
      console.log("❌ DKIM Record not found or incorrect");
      return false;
    }
  } catch (error) {
    console.log("❌ Error checking DKIM record:", error.message);
    return false;
  }
}

/**
 * Test DMARC Record
 */
async function testDMARCRecord(domain) {
  console.log("🔍 Testing DMARC Record...");

  try {
    const dmarcDomain = `_dmarc.${domain}`;
    const response = await makeRequest(
      `https://dns.google/resolve?name=${dmarcDomain}&type=TXT`
    );
    const data = JSON.parse(response);

    const dmarcRecord = data.Answer?.find((record) =>
      record.data.includes("v=DMARC1")
    );

    if (dmarcRecord) {
      console.log("✅ DMARC Record found:", dmarcRecord.data);
      return true;
    } else {
      console.log("❌ DMARC Record not found or incorrect");
      return false;
    }
  } catch (error) {
    console.log("❌ Error checking DMARC record:", error.message);
    return false;
  }
}

/**
 * Test CNAME Record
 */
async function testCNAMERecord(domain) {
  console.log("🔍 Testing CNAME Record...");

  try {
    const cnameDomain = `mg.${domain}`;
    const response = await makeRequest(
      `https://dns.google/resolve?name=${cnameDomain}&type=CNAME`
    );
    const data = JSON.parse(response);

    const cnameRecord = data.Answer?.find((record) =>
      record.data.includes("mailgun.org")
    );

    if (cnameRecord) {
      console.log("✅ CNAME Record found:", cnameRecord.data);
      return true;
    } else {
      console.log("❌ CNAME Record not found or incorrect");
      return false;
    }
  } catch (error) {
    console.log("❌ Error checking CNAME record:", error.message);
    return false;
  }
}

/**
 * Test Email Sending
 */
async function testEmailSending() {
  console.log("🔍 Testing Email Sending...");

  try {
    const testEmail = {
      from: `Word2Wallet <${FROM_EMAIL}>`,
      to: TEST_EMAILS[0], // Send to first test email
      subject: "Test Email - Deliverability Check",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Test Email</title>
        </head>
        <body style="margin: 0; padding: 20px; font-family: Arial, sans-serif;">
          <h2>Test Email</h2>
          <p>This is a test email to check deliverability.</p>
          <p>If you receive this email, your setup is working!</p>
          <p>Best regards,<br>Word2Wallet Team</p>
        </body>
        </html>
      `,
      text: `Test Email

This is a test email to check deliverability.

If you receive this email, your setup is working!

Best regards,
Word2Wallet Team`,
      "h:Reply-To": "support@word2wallet.com",
      "h:List-Unsubscribe": "<mailto:unsubscribe@word2wallet.com>",
      "h:X-Mailgun-Track": "yes",
      "h:X-Mailgun-Track-Clicks": "yes",
      "h:X-Mailgun-Track-Opens": "yes",
    };

    const response = await sendMailgunEmail(testEmail);

    if (response.id) {
      console.log("✅ Test email sent successfully");
      console.log("📧 Message ID:", response.id);
      return true;
    } else {
      console.log("❌ Failed to send test email");
      return false;
    }
  } catch (error) {
    console.log("❌ Error sending test email:", error.message);
    return false;
  }
}

/**
 * Send email via Mailgun
 */
async function sendMailgunEmail(emailData) {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams();

    // Add all email fields
    Object.keys(emailData).forEach((key) => {
      postData.append(key, emailData[key]);
    });

    const options = {
      hostname: "api.mailgun.net",
      port: 443,
      path: `/v3/${DOMAIN}/messages`,
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${API_KEY}`).toString(
          "base64"
        )}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData.toString()),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(response);
          } else {
            reject(
              new Error(`HTTP ${res.statusCode}: ${response.message || data}`)
            );
          }
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(postData.toString());
    req.end();
  });
}

/**
 * Make HTTP request
 */
async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

/**
 * Main testing function
 */
async function runTests() {
  console.log("🚀 Starting Email Deliverability Tests...\n");

  // Extract domain from MAILGUN_DOMAIN
  const domain = DOMAIN.replace("mg.", "");

  console.log(`📧 Testing domain: ${domain}`);
  console.log(`📧 Mailgun domain: ${DOMAIN}`);
  console.log(`📧 From email: ${FROM_EMAIL}\n`);

  const results = {
    spf: await testSPFRecord(domain),
    dkim: await testDKIMRecord(domain),
    dmarc: await testDMARCRecord(domain),
    cname: await testCNAMERecord(domain),
    email: await testEmailSending(),
  };

  console.log("\n📊 Test Results Summary:");
  console.log("========================");
  console.log(`SPF Record: ${results.spf ? "✅ Pass" : "❌ Fail"}`);
  console.log(`DKIM Record: ${results.dkim ? "✅ Pass" : "❌ Fail"}`);
  console.log(`DMARC Record: ${results.dmarc ? "✅ Pass" : "❌ Fail"}`);
  console.log(`CNAME Record: ${results.cname ? "✅ Pass" : "❌ Fail"}`);
  console.log(`Email Sending: ${results.email ? "✅ Pass" : "❌ Fail"}`);

  const passedTests = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log(`\n🎯 Overall Score: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log("🎉 All tests passed! Your email setup is ready.");
  } else {
    console.log("⚠️  Some tests failed. Please check your DNS setup.");
    console.log("\n📚 Next Steps:");
    console.log("1. Check your DNS records");
    console.log("2. Wait for DNS propagation (24-48 hours)");
    console.log("3. Test with Mail Tester: https://www.mail-tester.com");
    console.log("4. Check spam folder placement");
  }

  console.log("\n📖 For more help, see:");
  console.log("- DNS_SETUP_GUIDE.md");
  console.log("- EMAIL_DELIVERABILITY_GUIDE.md");
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testSPFRecord,
  testDKIMRecord,
  testDMARCRecord,
  testCNAMERecord,
  testEmailSending,
  runTests,
};
