# Complete Stripe Webhook Setup Guide

## Overview

This guide explains how to set up all Stripe webhooks for your Word2Wallet application. Webhooks allow Stripe to notify your application about events that happen in your Stripe account.

## 🚀 Quick Setup Steps

### 1. Access Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **Webhooks**
3. Click **"Add endpoint"**

### 2. Configure Webhook Endpoint

#### **Endpoint URL:**

```
https://yourdomain.com/api/webhooks/stripe
```

#### **Events to Send:**

Select the following events (or use "Send all events" for comprehensive coverage):

## 📋 Complete Event List

### **Subscription Events**

- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription modified
- `customer.subscription.deleted` - Subscription canceled
- `customer.subscription.trial_will_end` - Trial ending soon

### **Payment Events**

- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed
- `invoice.payment_action_required` - Payment needs action

### **Customer Events**

- `customer.created` - New customer created
- `customer.updated` - Customer info updated
- `customer.deleted` - Customer deleted

### **Payment Method Events**

- `payment_method.attached` - Payment method added
- `payment_method.detached` - Payment method removed

### **Invoice Events**

- `invoice.created` - Invoice generated
- `invoice.finalized` - Invoice finalized
- `invoice.upcoming` - Upcoming invoice notification

### **Setup Intent Events**

- `setup_intent.succeeded` - Setup intent successful
- `setup_intent.setup_failed` - Setup intent failed

### **Checkout Session Events**

- `checkout.session.completed` - Checkout completed
- `checkout.session.expired` - Checkout session expired

## 🔧 Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_BASIC_PRICE_ID=price_your_basic_price_id_here
STRIPE_PREMIUM_PRICE_ID=price_your_premium_price_id_here

# Your Domain
FRONTEND_URL=https://your-frontend-domain.com
```

## 🛠️ Backend Setup

### 1. Webhook Route (Already implemented)

Your webhook route is already set up in your routes:

```typescript
// In your routes file
app.post("/api/webhooks/stripe", WebhookController.handleWebhook);
```

### 2. Webhook Controller (Already implemented)

The `WebhookController` handles all webhook events with proper error handling and email notifications.

### 3. Test Your Webhook

#### **Using Stripe CLI (Recommended for Development):**

1. **Install Stripe CLI:**

   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   # Download from: https://github.com/stripe/stripe-cli/releases
   ```

2. **Login to Stripe:**

   ```bash
   stripe login
   ```

3. **Forward webhooks to your local server:**

   ```bash
   stripe listen --forward-to localhost:5000/api/webhooks/stripe
   ```

4. **Test specific events:**

   ```bash
   # Test subscription created
   stripe trigger customer.subscription.created

   # Test payment succeeded
   stripe trigger invoice.payment_succeeded

   # Test payment failed
   stripe trigger invoice.payment_failed
   ```

#### **Using Stripe Dashboard:**

1. Go to **Webhooks** in your Stripe Dashboard
2. Click on your webhook endpoint
3. Click **"Send test webhook"**
4. Select an event type to test
5. Click **"Send test webhook"**

## 📊 Webhook Event Flow

### **Trial Subscription Flow:**

```
1. User starts trial → customer.subscription.created
2. Trial ending soon → customer.subscription.trial_will_end
3. Trial ends → invoice.payment_succeeded (if payment works)
4. Payment fails → invoice.payment_failed
```

### **Payment Events:**

```
1. Payment succeeds → invoice.payment_succeeded
2. Payment fails → invoice.payment_failed
3. Payment needs action → invoice.payment_action_required
```

### **Customer Management:**

```
1. Customer created → customer.created
2. Customer updated → customer.updated
3. Customer deleted → customer.deleted
```

## 🔍 Monitoring and Debugging

### **1. Stripe Dashboard Logs:**

- Go to **Developers** → **Webhooks**
- Click on your webhook endpoint
- View **"Recent deliveries"** to see webhook attempts
- Check **"Response"** for success/failure status

### **2. Your Application Logs:**

```bash
# Check your application logs
tail -f logs/app.log

# Or if using PM2
pm2 logs your-app-name
```

### **3. Webhook Response Codes:**

- `200` - Success
- `400` - Bad request (invalid signature)
- `500` - Server error

## 🚨 Common Issues and Solutions

### **Issue 1: Webhook Signature Verification Failed**

**Solution:**

```typescript
// Make sure your webhook secret is correct
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
```

### **Issue 2: Webhook Not Receiving Events**

**Solutions:**

1. Check your endpoint URL is accessible
2. Verify SSL certificate is valid
3. Check firewall settings
4. Ensure your server is running

### **Issue 3: Duplicate Events**

**Solution:**

```typescript
// Implement idempotency in your webhook handlers
const processedEvents = new Set();

if (processedEvents.has(event.id)) {
  return res.json({ received: true });
}
processedEvents.add(event.id);
```

### **Issue 4: Webhook Timeout**

**Solution:**

```typescript
// Keep webhook handlers fast
// Move heavy processing to background jobs
// Return 200 quickly, process async
```

## 📧 Email Notifications

Your webhook system automatically sends emails for:

### **Trial Events:**

- **Trial Start** → Welcome email with trial details
- **Trial Ending** → Payment processing notification
- **Trial Success** → Subscription active confirmation

### **Payment Events:**

- **Payment Failed** → Urgent action required email
- **Payment Succeeded** → Success confirmation

### **Subscription Events:**

- **Subscription Cancelled** → Cancellation confirmation
- **Subscription Updated** → Status change notification

## 🔒 Security Best Practices

### **1. Webhook Signature Verification:**

```typescript
// Always verify webhook signatures
const event = StripeService.constructWebhookEvent(payload, sig);
```

### **2. Rate Limiting:**

```typescript
// Implement rate limiting for webhook endpoints
app.use(
  "/api/webhooks/stripe",
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);
```

### **3. HTTPS Only:**

- Always use HTTPS for webhook endpoints
- Stripe requires HTTPS for webhook delivery

## 🧪 Testing Checklist

### **Development Testing:**

- [ ] Stripe CLI forwarding works
- [ ] All webhook events are received
- [ ] Database updates correctly
- [ ] Email notifications sent
- [ ] Error handling works

### **Production Testing:**

- [ ] Webhook endpoint is accessible
- [ ] SSL certificate is valid
- [ ] All events are processed
- [ ] Monitoring is set up
- [ ] Error alerts are configured

## 📈 Monitoring Setup

### **1. Application Monitoring:**

```typescript
// Add monitoring to your webhook handler
console.log(`Webhook received: ${event.type} at ${new Date().toISOString()}`);
```

### **2. Stripe Dashboard Monitoring:**

- Check webhook delivery success rate
- Monitor response times
- Set up alerts for failures

### **3. Database Monitoring:**

```typescript
// Log webhook processing
await WebhookLog.create({
  eventType: event.type,
  eventId: event.id,
  processed: true,
  timestamp: new Date(),
});
```

## 🚀 Production Deployment

### **1. Environment Setup:**

```bash
# Set production environment variables
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export FRONTEND_URL=https://yourdomain.com
```

### **2. Webhook Endpoint:**

```
https://yourdomain.com/api/webhooks/stripe
```

### **3. SSL Certificate:**

- Ensure your domain has a valid SSL certificate
- Stripe requires HTTPS for webhook delivery

### **4. Monitoring:**

- Set up application monitoring (e.g., New Relic, DataDog)
- Configure alerts for webhook failures
- Monitor database for webhook processing

## 📞 Support

### **Stripe Support:**

- [Stripe Documentation](https://stripe.com/docs/webhooks)
- [Stripe Support](https://support.stripe.com/)

### **Your Application:**

- Check application logs
- Monitor webhook delivery in Stripe Dashboard
- Test with Stripe CLI

---

## 🎯 Quick Start Commands

```bash
# 1. Install Stripe CLI
brew install stripe/stripe-cli/stripe

# 2. Login to Stripe
stripe login

# 3. Start webhook forwarding
stripe listen --forward-to localhost:5000/api/webhooks/stripe

# 4. Test webhook
stripe trigger customer.subscription.created

# 5. Check logs
tail -f logs/app.log
```

Your webhook system is now fully configured and ready to handle all Stripe events! 🚀
