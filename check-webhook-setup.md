# Stripe Webhook Signature Verification Troubleshooting

## Current Status

✅ Payload is correctly received as a Buffer  
❌ Signature verification is failing

## Most Likely Causes

### 1. **Wrong Webhook Secret** (Most Common)

Stripe creates a **different signing secret for each webhook endpoint**. You might be using the wrong one.

#### How to Fix:

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Find the webhook endpoint that points to your server: `https://your-domain.com/api/webhooks/stripe`
3. Click on it
4. Click "Reveal" next to "Signing secret"
5. Copy the **exact** value (starts with `whsec_`)
6. Update your `.env` file:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_your_actual_secret_here
   ```
7. **Restart your Node.js server** (pm2 restart / systemctl restart)

**Important Notes:**

- Each webhook endpoint has its own unique secret
- Test mode and live mode endpoints have different secrets
- If you created multiple webhook endpoints, each has a different secret
- The secret shown in the Stripe CLI (`stripe listen`) is different from dashboard webhooks

### 2. **Nginx/Reverse Proxy Modifications**

If you're using nginx or another reverse proxy, it might be modifying the request body.

#### Check your nginx configuration:

```bash
# Find your nginx config
cat /etc/nginx/sites-enabled/your-site.conf
```

#### Required nginx configuration for webhooks:

```nginx
location /api/webhooks/stripe {
    # DO NOT buffer the request body
    proxy_request_buffering off;

    # Pass the request exactly as received
    proxy_pass http://localhost:5000;

    # Preserve the original body
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Don't modify the body
    proxy_http_version 1.1;
    proxy_set_header Connection "";
}
```

#### Test without nginx:

Temporarily test direct connection to your Node.js server to rule out nginx:

```bash
# Forward Stripe webhooks directly to your Node.js port
# In Stripe dashboard, temporarily change webhook URL to: https://your-domain.com:5000/api/webhooks/stripe
```

### 3. **SSL/HTTPS Issues**

If you're behind a load balancer or CloudFlare, the body might be modified during SSL termination.

#### Check:

- Is SSL terminating at nginx or at the application?
- Is CloudFlare "proxied" (orange cloud) or "DNS only" (grey cloud)?
- Try setting CloudFlare to "DNS only" temporarily

### 4. **Environment Variable Not Loaded**

The webhook secret might not be loaded correctly.

#### Verify:

```bash
# Check if .env is loaded
node -e "require('dotenv').config(); console.log('Secret:', process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10))"
```

## Debugging Steps

### Step 1: Verify the webhook secret

```bash
# SSH into your server
cd /var/www/word2wallet-backend

# Check .env file
grep STRIPE_WEBHOOK_SECRET .env

# Compare with Stripe Dashboard secret
```

### Step 2: Check if you're using the correct endpoint

```bash
# In Stripe Dashboard, note the webhook URL
# Make sure it matches your actual domain
```

### Step 3: Test with Stripe CLI (bypasses nginx)

```bash
# Install Stripe CLI on your server
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# In another terminal, trigger a test event
stripe trigger payment_intent.succeeded
```

### Step 4: Check nginx logs

```bash
# Check if nginx is modifying the request
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Step 5: Temporarily disable signature verification (TESTING ONLY!)

To confirm everything else works:

```typescript
// In webhookController.ts - TEMPORARY!
const event = req.body; // Skip verification temporarily
```

If this works, the issue is definitely with signature verification, not your webhook handling code.

## Quick Fix Commands

### If it's a wrong secret:

```bash
# Update .env
nano /var/www/word2wallet-backend/.env
# Update STRIPE_WEBHOOK_SECRET=whsec_...

# Restart
pm2 restart word2wallet-backend
# OR
systemctl restart word2wallet-backend
```

### If it's nginx:

```bash
# Edit nginx config
sudo nano /etc/nginx/sites-enabled/your-site.conf

# Add proxy_request_buffering off; to webhook location

# Test config
sudo nginx -t

# Reload
sudo systemctl reload nginx
```

## Expected Debug Output (Working)

When it's working correctly, you should see:

```
=== WEBHOOK DEBUG ===
Payload type: object
Payload is Buffer: true
Payload length: 7253
Signature present: true
Signature value: t=1759780114,v1=0135621c...
Webhook secret present: true
Webhook secret (first 10 chars): whsec_eIQ3
Payload preview (first 200 chars): {
  "id": "evt_1SD...
Payload SHA256: a1b2c3d4e5f6...
[No errors - webhook processed successfully]
```

## Still Not Working?

### Create a test endpoint to rule out Stripe:

```typescript
// Add temporary test endpoint in webhookController.ts
router.post("/test-raw-body", (req, res) => {
  console.log("Body type:", typeof req.body);
  console.log("Is Buffer:", Buffer.isBuffer(req.body));
  console.log("Body length:", req.body?.length);
  res.json({ ok: true });
});
```

Test with:

```bash
curl -X POST https://your-domain.com/api/webhooks/test-raw-body \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
```

If the body is NOT a Buffer here, your middleware setup is still wrong.

## Contact Stripe Support

If all else fails, Stripe support can check their logs to see:

- If the webhook is being sent
- What signature they're generating
- If there's a network/routing issue

## Common Mistakes Checklist

- [ ] Using test secret for live webhooks (or vice versa)
- [ ] Copy-pasting secret with extra spaces/newlines
- [ ] Using old secret after regenerating it
- [ ] Using Stripe CLI secret instead of dashboard webhook secret
- [ ] Not restarting server after changing .env
- [ ] Nginx buffering enabled
- [ ] CloudFlare or other proxy modifying the body
- [ ] Wrong webhook endpoint URL in Stripe dashboard
