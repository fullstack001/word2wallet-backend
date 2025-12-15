# Google Cloud Storage Quick Start Guide

## 🚀 Quick Setup (5 Minutes)

### Step 1: Create Project & Enable API

1. Go to https://console.cloud.google.com
2. Create new project: "word2wallet"
3. Enable "Cloud Storage API" (APIs & Services → Library)

### Step 2: Create Bucket

1. Go to Cloud Storage → Buckets
2. Click "Create Bucket"
3. **Name**: `word2wallet-media` (must be unique globally)
4. **Location**: Choose region closest to users
5. **Storage class**: Standard
6. **Access control**: Uniform
7. Click "Create"

### Step 3: Create Service Account

1. Go to IAM & Admin → Service Accounts
2. Click "Create Service Account"
3. **Name**: `word2wallet-storage`
4. Click "Create and Continue"
5. **Role**: Select "Storage Admin"
6. Click "Done"

### Step 4: Download Key

1. Click on the service account
2. Go to "Keys" tab
3. Click "Add Key" → "Create new key"
4. Select "JSON"
5. Click "Create" (file downloads automatically)

### Step 5: Configure Application

**Option A: Key File (Development)**

```bash
# Create config directory
mkdir -p config

# Move downloaded JSON file
mv ~/Downloads/your-project-*.json config/gcs-key.json
```

**Update `.env`:**

```env
GCS_BUCKET_NAME=word2wallet-media
GCS_PROJECT_ID=your-project-id
GCS_KEY_FILENAME=config/gcs-key.json
```

**Option B: Environment Variables (Production)**

```env
GCS_BUCKET_NAME=word2wallet-media
GCS_PROJECT_ID=your-project-id
GCS_CLIENT_EMAIL=word2wallet-storage@your-project-id.iam.gserviceaccount.com
GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

### Step 6: Enable Billing

1. Go to Billing → Link billing account
2. Add payment method
3. Link to your project

### Step 7: Test

```bash
# Start your application
npm run dev

# Try uploading a file through your API
# Check bucket in Google Cloud Console to verify
```

## ✅ Verification Checklist

- [ ] Project created
- [ ] Cloud Storage API enabled
- [ ] Bucket created
- [ ] Service account created with Storage Admin role
- [ ] JSON key downloaded
- [ ] Key file placed in `config/` or env vars set
- [ ] `.env` file updated
- [ ] Billing enabled
- [ ] Application starts without errors
- [ ] File upload works
- [ ] File appears in GCS bucket

## 🔒 Security Checklist

- [ ] Key file added to `.gitignore`
- [ ] Key file NOT committed to git
- [ ] Service account has minimal required permissions
- [ ] Bucket permissions configured correctly

## 📝 Important Notes

1. **Bucket names must be globally unique** - If `word2wallet-media` is taken, try:

   - `word2wallet-media-prod`
   - `word2wallet-storage-2024`
   - `yourcompany-word2wallet-media`

2. **Private Key Format** - When using environment variables:

   - Keep `\n` characters in the private key
   - Keep quotes around the entire key
   - Example: `GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"`

3. **File Paths** - Key file path is relative to project root:
   - `config/gcs-key.json` ✅
   - `./config/gcs-key.json` ✅
   - `/absolute/path/to/key.json` ✅

## 🆘 Common Issues

**"Bucket does not exist"**

- Check bucket name spelling (case-sensitive)
- Verify bucket exists in Google Cloud Console

**"Permission denied"**

- Verify service account has "Storage Admin" role
- Check key file path is correct
- Regenerate key if needed

**"Invalid credentials"**

- Check `GCS_CLIENT_EMAIL` matches service account email
- Verify `GCS_PRIVATE_KEY` includes `\n` characters
- Ensure private key is properly quoted

## 📚 Full Documentation

See `GCS_SETUP_GUIDE.md` for detailed step-by-step instructions with screenshots.
