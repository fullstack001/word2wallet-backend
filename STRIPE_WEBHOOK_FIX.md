# Stripe Webhook Fix Documentation

## Problem

Stripe webhook signature verification was failing with the error:

```
No signatures found matching the expected signature for payload
```

## Root Causes Identified

1. **Middleware Order**: The JSON body parser was running before the raw body parser
2. **Compression Interference**: The `compression()` middleware was modifying the webhook payload
3. **Missing Raw Body Preservation**: The raw body wasn't being explicitly stored for verification

## Solutions Applied

### 1. Fixed Middleware Order (`server.ts`)

**Before:**

```typescript
app.use(express.json({ limit: "100mb" }));
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
```

**After:**

```typescript
// Raw body parsing MUST come BEFORE express.json()
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "100mb" }));
```

### 2. Excluded Webhooks from Compression (`server.ts`)

```typescript
app.use(
  compression({
    filter: (req, res) => {
      // Don't compress webhook endpoints
      if (req.path.startsWith("/api/webhooks")) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);
```

### 3. Enhanced Raw Body Capture (`server.ts`)

```typescript
app.use(
  "/api/webhooks/stripe",
  express.raw({
    type: "application/json",
    verify: (req: any, res, buf) => {
      // Store raw body for Stripe signature verification
      req.rawBody = buf;
    },
  })
);
```

### 4. Updated Webhook Handler (`webhookController.ts`)

```typescript
// Use rawBody if available, otherwise fall back to req.body
const payload = (req as any).rawBody || req.body;

// Validate payload is a Buffer
if (!Buffer.isBuffer(payload)) {
  console.error("Payload is not a Buffer! Type:", typeof payload);
  return res.status(400).json({
    success: false,
    message: "Invalid payload format - must be raw buffer",
  });
}
```

## Verification Steps

### 1. Check Environment Variable

Ensure your `.env` file has the correct webhook secret:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**How to get the webhook secret:**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your webhook endpoint
3. Click "Reveal" next to "Signing secret"
4. Copy the value (starts with `whsec_`)

### 2. Test the Webhook

Use Stripe CLI to test:

```bash
stripe listen --forward-to localhost:5000/api/webhooks/stripe
```

Or send a test event from the Stripe Dashboard:

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook
3. Click "Send test webhook"

### 3. Check Debug Logs

When a webhook is received, you should see:

```
=== WEBHOOK DEBUG ===
Payload type: object
Payload is Buffer: true
Payload length: [some number]
Signature present: true
Webhook secret present: true
Webhook secret (first 10 chars): whsec_xxxx
```

## Common Issues

### Issue: "Payload is not a Buffer"

**Solution:** Restart your server to ensure middleware order changes are applied

### Issue: "Invalid signature" persists

**Solutions:**

1. Verify `STRIPE_WEBHOOK_SECRET` matches your Stripe dashboard
2. Check if you're using the test mode secret for test events
3. Check if you're using the live mode secret for live events
4. Ensure no proxy/load balancer is modifying the request body

### Issue: Working in test but not in production

**Solution:**

- Use the **production webhook secret** (not test secret) for live events
- Check if your reverse proxy (nginx, etc.) is modifying the body

## Testing Checklist

- [ ] Webhook secret in `.env` matches Stripe dashboard
- [ ] Server restarted after changes
- [ ] `Payload is Buffer: true` in logs
- [ ] Signature verification succeeds
- [ ] Events are being processed correctly

## Additional Notes

- The raw body parser **must** be applied before any JSON parsing middleware
- Compression **must** be disabled for webhook endpoints
- The webhook secret for test mode and live mode are **different**
- Always use the Stripe CLI or Dashboard to test webhooks during development
