#!/usr/bin/env node
// npm i dotenv
require("dotenv").config();
const https = require("https");

const DOMAIN = process.env.MAILGUN_DOMAIN; // e.g. mg.wordtowallet.com
const API_KEY = process.env.MAILGUN_API_KEY; // key-...
const FROM_EMAIL = process.env.MAILGUN_FROM_EMAIL; // noreply@mg.wordtowallet.com
const REGION = (process.env.MAILGUN_REGION || "US").toUpperCase(); // US | EU
const TEST_EMAIL = process.env.TEST_EMAIL || "you@example.com";
const DKIM_SELECTORS = (process.env.MAILGUN_DKIM_SELECTORS || "smtp,mailo,k1")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

if (!DOMAIN || !API_KEY || !FROM_EMAIL) {
  console.error(
    "❌ Missing env vars. Required: MAILGUN_DOMAIN, MAILGUN_API_KEY, MAILGUN_FROM_EMAIL"
  );
  process.exit(1);
}

const ROOT = DOMAIN.replace(/^mg\./i, "");
const API_BASE = REGION === "EU" ? "api.eu.mailgun.net" : "api.mailgun.net";

function httpGetJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from ${url}: ${data}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function qTXT(name) {
  return httpGetJSON(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`
  );
}
async function qCNAME(name) {
  return httpGetJSON(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=CNAME`
  );
}
async function qMX(name) {
  return httpGetJSON(
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=MX`
  );
}

function hasAnswer(r) {
  return Array.isArray(r.Answer) && r.Answer.length > 0;
}

async function testSPF() {
  console.log("🔍 SPF...");
  const names = [DOMAIN, ROOT]; // check mg.domain and root
  for (const name of names) {
    try {
      const r = await qTXT(name);
      if (hasAnswer(r)) {
        const spf = r.Answer.find((a) => a.data.includes("v=spf1"));
        if (spf) {
          console.log(`  ✅ Found at ${name}: ${spf.data}`);
          return true;
        }
      }
    } catch {}
  }
  console.log("  ❌ SPF not found (check TXT at mg.domain or root)");
  return false;
}

async function testDKIM() {
  console.log("🔍 DKIM...");
  for (const sel of DKIM_SELECTORS) {
    const name = `${sel}._domainkey.${DOMAIN}`;
    try {
      const r = await qTXT(name);
      if (hasAnswer(r)) {
        const hit = r.Answer.find(
          (a) => a.data.includes("k=rsa") && a.data.includes("p=")
        );
        if (hit) {
          console.log(`  ✅ Selector ${sel}: present`);
          return true; // at least one selector is enough
        }
      }
    } catch {}
  }
  console.log(
    "  ❌ No DKIM selectors resolved (check TXT like smtp._domainkey.mg.domain)"
  );
  return false;
}

async function testDMARC() {
  console.log("🔍 DMARC...");
  const names = [`_dmarc.${ROOT}`, `_dmarc.${DOMAIN}`]; // check root & mg subdomain
  let ok = false;
  for (const name of names) {
    try {
      const r = await qTXT(name);
      if (hasAnswer(r)) {
        const rec = r.Answer.find((a) => a.data.includes("v=DMARC1"));
        if (rec) {
          console.log(`  ✅ Found at ${name}: ${rec.data}`);
          ok = true;
        }
      }
    } catch {}
  }
  if (!ok) console.log("  ❌ DMARC not found");
  return ok;
}

async function testCNAME() {
  console.log("🔍 Tracking CNAME...");
  const name = `email.${DOMAIN}`; // Mailgun default tracking CNAME
  try {
    const r = await qCNAME(name);
    if (hasAnswer(r)) {
      const rec = r.Answer.find((a) => /mailgun\.org\.?$/i.test(a.data));
      if (rec) {
        console.log(`  ✅ ${name} → ${rec.data}`);
        return true;
      }
    }
  } catch {}
  console.log("  ❌ CNAME not found (expect email.mg.domain → mailgun.org)");
  return false;
}

async function testMX() {
  console.log("🔍 MX for bounce processing...");
  try {
    const r = await qMX(DOMAIN);
    if (hasAnswer(r)) {
      const hosts = r.Answer.map((a) => a.data.toLowerCase());
      const hasA = hosts.some((h) => h.includes("mxa.mailgun.org"));
      const hasB = hosts.some((h) => h.includes("mxb.mailgun.org"));
      if (hasA && hasB) {
        console.log("  ✅ mxa.mailgun.org and mxb.mailgun.org present");
        return true;
      }
    }
  } catch {}
  console.log(
    "  ❌ Missing one or both MX (need mxa & mxb priority 10 on mg.domain)"
  );
  return false;
}

function postForm(hostname, path, payload, authUser, authPass) {
  const body = new URLSearchParams(payload).toString();
  const headers = {
    Authorization: `Basic ${Buffer.from(`${authUser}:${authPass}`).toString(
      "base64"
    )}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Content-Length": Buffer.byteLength(body),
  };
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname, port: 443, path, method: "POST", headers },
      (res) => {
        let data = "";
        res.on("data", (d) => (data += d));
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
            else
              reject(
                new Error(`HTTP ${res.statusCode}: ${json.message || data}`)
              );
          } catch {
            reject(new Error(`Invalid JSON response: ${data}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function testSend() {
  console.log("🔍 Sending test email...");
  try {
    const res = await postForm(
      API_BASE,
      `/v3/${DOMAIN}/messages`,
      {
        from: `Word2Wallet <${FROM_EMAIL}>`,
        to: TEST_EMAIL,
        subject: "Mailgun Deliverability Test",
        text: "This is a deliverability test from Mailgun.",
        html: "<p>This is a <b>deliverability</b> test from Mailgun.</p>",
        "h:Reply-To": "support@wordtowallet.com",
        "h:X-Mailgun-Track": "yes",
        "h:X-Mailgun-Track-Clicks": "yes",
        "h:X-Mailgun-Track-Opens": "yes",
        "h:List-Unsubscribe": `<https://word2wallet.com/unsubscribe?email=${encodeURIComponent(
          TEST_EMAIL
        )}>, <mailto:unsubscribe@word2wallet.com?subject=Unsubscribe>`,
        "h:List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      "api",
      API_KEY
    );
    console.log("  ✅ Sent. Message ID:", res.id || "(no id)");
    return true;
  } catch (e) {
    console.log("  ❌ Send failed:", e.message);
    return false;
  }
}

(async function run() {
  console.log("🚀 Email Deliverability Tests\n");
  console.log(`📧 Root domain: ${ROOT}`);
  console.log(`📧 Mailgun domain: ${DOMAIN}`);
  console.log(`📧 From: ${FROM_EMAIL}`);
  console.log(`🌍 Region: ${REGION}\n`);

  const results = {
    spf: await testSPF(),
    dkim: await testDKIM(),
    dmarc: await testDMARC(),
    cname: await testCNAME(),
    mx: await testMX(),
    send: await testSend(),
  };

  console.log("\n📊 Summary");
  for (const [k, v] of Object.entries(results)) {
    console.log(`${k.toUpperCase().padEnd(6)}: ${v ? "✅" : "❌"}`);
  }
  const pass = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 ${pass}/${Object.keys(results).length} checks passed\n`);
  process.exit(pass === Object.keys(results).length ? 0 : 2);
})();
