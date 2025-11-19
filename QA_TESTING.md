# Backend QA Testing Guide

This guide explains how to QA test the Word2Wallet backend API.

## Quick Start

### Prerequisites

1. **Install dependencies** (if not already done)
   ```bash
   cd word2wallet-backend
   npm install
   ```

2. **Backend server must be running**
   ```bash
   # In a separate terminal window/tab
   cd word2wallet-backend
   npm run dev
   # Server should be running on http://localhost:5000
   ```
   
   **Important:** The tests will fail with connection errors if the server is not running. Make sure to start the server before running tests.

3. **Environment variables configured**
   - Ensure `.env` file is properly configured
   - Required variables include:
     - `MONGODB_URI` - MongoDB connection string
     - `JWT_SECRET` - JWT secret key
     - `STRIPE_SECRET_KEY` - Stripe API key (for payment tests)
     - `MAILGUN_API_KEY` - Mailgun API key (for email tests)
     - `OPENAI_API_KEY` - OpenAI API key (for content generation tests)

### Running All Tests

Run the complete QA test suite:

```bash
cd word2wallet-backend
npm run test:qa
```

This will run all test suites in sequence:
- Basic API tests
- Content generation validation tests
- Email campaign tests
- Email deliverability tests (can be slow)

### Quick Test (Skip Slow Tests)

Skip email deliverability tests for faster runs:

```bash
npm run test:qa:quick
```

## Individual Test Suites

### 1. Basic API Test

Tests basic API functionality including health checks and authentication.

```bash
npm run test:api
# or
node test-api.js
```

**What it tests:**
- Health check endpoint (`GET /health`)
- User registration endpoint (`POST /api/auth/register`)
- Environment variable validation (Stripe keys)

**Expected output:**
- ✅ Health check response
- ✅ Register endpoint response
- ✅ Environment variables status

### 2. Content Generation Tests

Tests content generation API validation and error handling.

```bash
npm run test:content
# or
node test-content-generation.js
```

**What it tests:**
- Missing/invalid mode validation
- RAW_XHTML mode validation (requires `html` field)
- STRICT_NATIVE_BLOCKS mode validation
- Field length validations
- Type validations (boolean, string, etc.)

**Requirements:**
- Admin user credentials (set via `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars)
- Default: `admin@example.com` / `admin123`

**Test cases:**
1. Missing mode → should fail
2. Invalid mode → should fail
3. RAW_XHTML without html → should fail
4. RAW_XHTML with empty html → should fail
5. RAW_XHTML with valid html → should succeed
6. STRICT_NATIVE_BLOCKS minimal request → should succeed
7. Title too short → should fail
8. Description too short → should fail
9. Valid STRICT_NATIVE_BLOCKS request → should succeed
10. Invalid strict field type → should fail
11. HTML content too long → should fail

### 3. Email Campaign Tests

Tests email campaign CRUD operations.

```bash
npm run test:email-campaigns
# or
node test-email-campaigns.js
```

**What it tests:**
- User authentication
- Getting user books
- Creating campaigns
- Getting all campaigns
- Getting specific campaign
- Updating campaigns
- Deleting campaigns

**Requirements:**
- Test user account: `test@example.com` / `testpassword123`
- User must be authenticated

**Test flow:**
1. Login → get auth token
2. Get user books
3. Create test campaign
4. Get all campaigns
5. Get specific campaign
6. Update campaign
7. Delete campaign

### 4. Email Deliverability Tests

Tests email deliverability configuration (DNS records, SPF, DKIM, DMARC).

```bash
npm run test:email-deliverability
# or
node test-email-deliverability.js
```

**What it tests:**
- SPF record configuration
- DKIM record configuration
- DMARC record configuration
- CNAME tracking configuration
- MX record configuration
- Test email sending

**Requirements:**
- `MAILGUN_DOMAIN` - Your Mailgun domain (e.g., `mg.wordtowallet.com`)
- `MAILGUN_API_KEY` - Mailgun API key
- `MAILGUN_FROM_EMAIL` - From email address
- `MAILGUN_REGION` - Region (US or EU, default: US)
- `TEST_EMAIL` - Email address to send test email to
- `MAILGUN_DKIM_SELECTORS` - Comma-separated DKIM selectors (default: `smtp,mailo,k1`)

**DNS Checks:**
- ✅ SPF record at domain or mg subdomain
- ✅ DKIM records for specified selectors
- ✅ DMARC record at `_dmarc.domain`
- ✅ CNAME for email tracking
- ✅ MX records for bounce processing
- ✅ Test email sending

## Running Specific Tests

You can run specific test suites using command-line flags:

```bash
# Run only API tests
node run-all-tests.js --only-api --api

# Run only content generation tests
node run-all-tests.js --only-api --content

# Run only email campaign tests
node run-all-tests.js --only-api --email-campaigns

# Run only email deliverability tests
node run-all-tests.js --only-api --email-deliverability

# Combine multiple tests
node run-all-tests.js --only-api --api --content
```

## Test Configuration

### Environment Variables

Create a `.env` file in `word2wallet-backend/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/word2wallet

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRE=7d

# Stripe (for payment tests)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...

# Mailgun (for email tests)
MAILGUN_DOMAIN=mg.wordtowallet.com
MAILGUN_API_KEY=key-...
MAILGUN_FROM_EMAIL=noreply@mg.wordtowallet.com
MAILGUN_REGION=US
TEST_EMAIL=your-email@example.com
MAILGUN_DKIM_SELECTORS=smtp,mailo,k1

# OpenAI (for content generation tests)
OPENAI_API_KEY=sk-...

# Test Credentials
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=admin123
```

### Test User Setup

Before running email campaign tests, ensure a test user exists:

```bash
# The test-api.js script will create a test user automatically
# Or create manually via registration endpoint
```

For content generation tests, ensure an admin user exists:

```bash
npm run create-admin
# Follow prompts to create admin user
```

## Understanding Test Results

### Success Indicators

- ✅ Green checkmarks indicate passed tests
- Test suite exits with code 0 on success

### Failure Indicators

- ❌ Red X marks indicate failed tests
- Error messages show what went wrong
- Test suite exits with code 1 on failure

### Test Output Format

```
🧪 Word2Wallet QA Test Suite
============================================================

============================================================
Running: Basic API Test
============================================================
✅ Health check: { status: 'ok' }
✅ Register endpoint response: { ... }
✅ STRIPE_SECRET_KEY: Set

✅ Basic API Test - PASSED

============================================================
📊 Test Summary
============================================================
✅ PASSED       Basic API Test
✅ PASSED       Content Generation Tests
✅ PASSED       Email Campaign Tests
✅ PASSED       Email Deliverability Tests

------------------------------------------------------------
Total: 4/4 tests passed
------------------------------------------------------------

🎉 All tests passed!
```

## Troubleshooting

### Server Not Running

**Error:** `ECONNREFUSED` or connection errors

**Solution:**
```bash
# Start the backend server
cd word2wallet-backend
npm run dev
```

### Authentication Failures

**Error:** Login failed or unauthorized errors

**Solution:**
- Ensure test user exists in database
- Check credentials in test files or env vars
- Verify JWT_SECRET is set correctly

### Database Connection Issues

**Error:** MongoDB connection errors

**Solution:**
- Ensure MongoDB is running
- Check `MONGODB_URI` in `.env`
- Verify database is accessible

### Email Deliverability Failures

**Error:** DNS records not found

**Solution:**
- Verify DNS records are properly configured
- Check domain DNS settings
- Ensure Mailgun domain is verified
- Wait for DNS propagation (can take up to 48 hours)

### Content Generation Failures

**Error:** OpenAI API errors or 503 status

**Solution:**
- Ensure `OPENAI_API_KEY` is set
- Verify API key is valid and has credits
- Check OpenAI service status

## Best Practices

1. **Run tests before deployment**
   - Always run full test suite before deploying to production
   - Use `npm run test:qa` for comprehensive testing

2. **Run quick tests during development**
   - Use `npm run test:qa:quick` for faster feedback
   - Skip slow email deliverability tests during active development

3. **Check individual test suites**
   - Run specific tests when working on related features
   - Use individual test commands for focused testing

4. **Monitor test output**
   - Review error messages carefully
   - Check environment variable status
   - Verify database state

5. **Keep test data clean**
   - Tests may create test data in database
   - Clean up test campaigns/users periodically
   - Use test-specific email addresses

## CI/CD Integration

To integrate these tests into CI/CD pipelines:

```bash
# In your CI/CD script
cd word2wallet-backend
npm install
npm run build
npm start &  # Start server in background
sleep 5      # Wait for server to start
npm run test:qa:quick  # Run tests (skip slow email tests)
```

## Additional Resources

- [Backend README](./README.md) - General backend documentation
- [Email Setup Guide](./EMAIL_SETUP.md) - Email configuration details
- [Stripe Webhook Setup](./STRIPE_WEBHOOK_SETUP.md) - Payment integration guide

## Getting Help

If tests fail and you need help:

1. Check the error messages in test output
2. Verify all environment variables are set
3. Ensure backend server is running
4. Check database connectivity
5. Review test file source code for expected behavior

