# Rate Limiting Fix for "Too Many Requests" Error

## Problem

Users were getting "Too many requests" errors when accessing the subjects page, likely due to restrictive rate limiting settings.

## Root Cause

The rate limiting was configured with very restrictive settings:

- **Window**: 15 minutes (900,000ms)
- **Max Requests**: 100 requests per window
- **No localhost exemption** for development

This was too restrictive for development and testing.

## Solution Implemented

### 1. Updated Rate Limiting Configuration

**File**: `src/server.ts`

**Changes**:

- ✅ Increased max requests from 100 to 1000 per window
- ✅ Added localhost exemption for development environment
- ✅ Maintained security for production

```typescript
// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000"), // limit each IP to 1000 requests per windowMs (increased for development)
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (process.env.NODE_ENV === "development") {
      return (
        req.ip === "127.0.0.1" ||
        req.ip === "::1" ||
        req.ip === "::ffff:127.0.0.1"
      );
    }
    return false;
  },
});
```

### 2. Updated Environment Configuration

**File**: `env.example`

**Changes**:

- ✅ Updated default rate limit to 1000 requests
- ✅ Added comment explaining development-friendly settings

```env
# Rate Limiting (Development-friendly settings)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

## How It Works

### Development Environment

- **Localhost requests**: Completely exempt from rate limiting
- **Other IPs**: Limited to 1000 requests per 15 minutes
- **Environment**: Automatically detected via `NODE_ENV`

### Production Environment

- **All IPs**: Limited to configured number of requests
- **Security**: Maintained through environment variables
- **Flexibility**: Can be adjusted via environment variables

## Testing the Fix

### 1. Restart Backend Server

```bash
# Stop current server (Ctrl+C)
# Then restart
npm run dev
```

### 2. Test Subjects Page

1. Navigate to admin dashboard
2. Click on "Subjects"
3. Should load without "too many requests" error

### 3. Verify Rate Limiting

```bash
# Test with multiple requests
for i in {1..10}; do
  curl -H "Authorization: Bearer test" http://localhost:5000/api/subjects
done
```

## Additional Debugging Steps

If you still encounter issues:

### 1. Check Server Logs

Look for rate limiting messages in the backend console:

```
Too many requests from this IP, please try again later.
```

### 2. Verify Environment Variables

```bash
# Check if NODE_ENV is set to development
echo $NODE_ENV
```

### 3. Check IP Detection

The rate limiter might not be detecting localhost correctly. Check the server logs for IP addresses.

### 4. Clear Browser Cache

Sometimes cached requests can cause issues:

- Clear browser cache
- Try incognito/private mode
- Check browser developer tools Network tab

### 5. Check for Multiple API Calls

Verify the frontend isn't making multiple requests:

- Open browser developer tools
- Go to Network tab
- Click on Subjects page
- Check if multiple `/api/subjects` requests are made

## Environment-Specific Configuration

### Development

```env
NODE_ENV=development
RATE_LIMIT_MAX_REQUESTS=1000
# Localhost is exempt from rate limiting
```

### Production

```env
NODE_ENV=production
RATE_LIMIT_MAX_REQUESTS=100  # More restrictive for production
# All IPs are rate limited
```

### Staging

```env
NODE_ENV=staging
RATE_LIMIT_MAX_REQUESTS=500  # Moderate rate limiting
# All IPs are rate limited
```

## Monitoring

### Rate Limiting Headers

The rate limiter adds these headers to responses:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Time when the rate limit resets

### Logging

Monitor server logs for rate limiting events:

```bash
# Watch for rate limiting messages
tail -f logs/app.log | grep "Too many requests"
```

## Troubleshooting

### Still Getting Rate Limited?

1. **Check NODE_ENV**: Ensure it's set to "development"
2. **Restart Server**: Changes require server restart
3. **Check IP**: Verify you're accessing from localhost
4. **Clear Rate Limit**: Wait 15 minutes or restart server

### Production Issues?

1. **Adjust Limits**: Increase `RATE_LIMIT_MAX_REQUESTS`
2. **Monitor Usage**: Check actual request patterns
3. **Implement Caching**: Reduce API calls with frontend caching
4. **Load Balancing**: Distribute requests across multiple servers

## Security Considerations

- ✅ **Development**: Lenient settings for easier development
- ✅ **Production**: Restrictive settings for security
- ✅ **Environment Detection**: Automatic configuration based on environment
- ✅ **IP Exemption**: Only for localhost in development
- ✅ **Configurable**: Can be adjusted via environment variables

The fix maintains security while providing a better development experience.
