# Email Service Setup

The email confirmation feature requires a configured email service. Currently, the system uses **Mailgun** for sending emails.

## Quick Fix: Disable Email Confirmation (Testing)

If you want to test the landing pages without setting up email, you can:

1. When creating an email signup landing page, **uncheck the "Confirm Email" option**
2. This will allow users to download immediately without email confirmation

## Setting Up Mailgun (Recommended)

### 1. Create a Mailgun Account

1. Go to [mailgun.com](https://www.mailgun.com)
2. Sign up for a free account (includes 5,000 free emails/month for 3 months)
3. Verify your email address

### 2. Get Your API Credentials

1. Log in to Mailgun dashboard
2. Go to **Settings** → **API Keys**
3. Copy your **Private API Key**
4. Go to **Sending** → **Domains**
5. Copy your **Domain Name** (e.g., `sandbox123.mailgun.org` for testing)

### 3. Configure Environment Variables

Add these to your `.env` file:

```env
# Mailgun Configuration
MAILGUN_API_KEY=your-private-api-key-here
MAILGUN_DOMAIN=sandbox123.mailgun.org
MAILGUN_FROM_EMAIL=noreply@yourdomain.com
MAILGUN_REGION=US
SUPPORT_EMAIL=support@yourdomain.com

# Landing Page URLs
LANDING_PAGE_URL=http://localhost:3001
API_URL=http://localhost:5000/api
```

### 4. Verify Domain (For Production)

For production use, you need to:

1. Add your own domain in Mailgun
2. Update DNS records as instructed by Mailgun
3. Wait for verification (usually a few hours)
4. Update `MAILGUN_DOMAIN` to your verified domain

### 5. Add Authorized Recipients (Sandbox Mode)

If using the sandbox domain:

1. Go to **Sending** → **Domains** → Click your sandbox domain
2. Under **Authorized Recipients**, add email addresses you want to test with
3. Verify those email addresses

## Alternative: Use SendGrid

If you prefer SendGrid over Mailgun:

1. Sign up at [sendgrid.com](https://sendgrid.com)
2. Get your API key
3. Modify `src/services/emailService.ts` to use SendGrid's API instead

## Testing Email Sending

You can test if emails are working by:

1. Creating an email signup landing page with "Confirm Email" enabled
2. Submitting your email
3. Checking your inbox (and spam folder)
4. Verify the confirmation email arrives

## Troubleshooting

### Error: "Forbidden"

- **Cause**: Invalid API key or domain not verified
- **Fix**: Double-check your `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` in `.env`

### Error: "Domain not found"

- **Cause**: Wrong domain name
- **Fix**: Make sure `MAILGUN_DOMAIN` matches exactly what's in your Mailgun dashboard

### Emails not arriving (Sandbox mode)

- **Cause**: Recipient not authorized
- **Fix**: Add the recipient email to "Authorized Recipients" in Mailgun dashboard

### Emails going to spam

- **Cause**: Using sandbox domain or unverified domain
- **Fix**: Verify your own domain and set up proper SPF/DKIM records

## Current Status

✅ Email confirmation code is implemented
✅ System works even if email sending fails
⚠️ **Mailgun needs to be configured with valid credentials**

## What Happens Without Email Configuration?

The system will:

- ✅ Still capture emails in the database
- ✅ Still track analytics
- ✅ Show "Almost finished..." message
- ❌ Won't send confirmation emails
- ❌ Users won't be able to complete the confirmation flow

**Recommendation**: For production, set up Mailgun or disable email confirmation until ready.
