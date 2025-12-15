# Google Cloud Storage Setup Guide - Step by Step

This guide will walk you through setting up Google Cloud Storage for your application.

## Prerequisites

- A Google account
- Access to Google Cloud Console (https://console.cloud.google.com)

## Step 1: Create a Google Cloud Project

1. **Go to Google Cloud Console**

   - Visit: https://console.cloud.google.com
   - Sign in with your Google account

2. **Create a New Project**

   - Click the project dropdown at the top of the page
   - Click "New Project"
   - Enter project details:
     - **Project name**: `word2wallet` (or your preferred name)
     - **Project ID**: Will be auto-generated (e.g., `word2wallet-123456`)
     - **Organization**: Select if applicable
   - Click "Create"
   - Wait for the project to be created (usually 10-30 seconds)

3. **Select Your Project**
   - Click the project dropdown again
   - Select your newly created project

## Step 2: Enable Cloud Storage API

1. **Navigate to APIs & Services**

   - In the left sidebar, click "APIs & Services" → "Library"
   - Or go directly to: https://console.cloud.google.com/apis/library

2. **Enable Cloud Storage API**
   - Search for "Cloud Storage API"
   - Click on "Cloud Storage API"
   - Click the "Enable" button
   - Wait for it to enable (usually instant)

## Step 3: Create a Storage Bucket

1. **Navigate to Cloud Storage**

   - In the left sidebar, click "Cloud Storage" → "Buckets"
   - Or go directly to: https://console.cloud.google.com/storage/browser

2. **Create a New Bucket**

   - Click "Create Bucket" button
   - Fill in the bucket details:

   **Step 1: Name your bucket**

   - **Name**: `word2wallet-media` (must be globally unique)
   - Note: Bucket names must be lowercase, contain only letters, numbers, and hyphens
   - Example: `word2wallet-media-prod` or `word2wallet-storage-2024`

   **Step 2: Choose where to store your data**

   - **Location type**: Select "Region" (recommended) or "Multi-region"
   - **Location**: Choose a region close to your users (e.g., `us-central1`, `europe-west1`, `asia-southeast1`)
   - For multi-region: `US`, `EU`, or `ASIA`

   **Step 3: Choose a storage class**

   - **Default storage class**: Select "Standard" (recommended for active files)
   - Options:
     - Standard: Best for frequently accessed files
     - Nearline: For files accessed less than once a month
     - Coldline: For files accessed less than once a quarter
     - Archive: For long-term archival

   **Step 4: Choose how to control access to objects**

   - **Access control**: Select "Uniform" (recommended) or "Fine-grained"
   - **Uniform**: Simpler, bucket-level permissions
   - **Fine-grained**: Object-level permissions (more complex)

   **Step 5: Choose how to protect object data**

   - **Protection tools**: Leave defaults or enable:
     - Object versioning: Keep old versions (optional)
     - Object retention: Prevent deletion (optional)

3. **Create the Bucket**
   - Click "Create"
   - Wait for bucket creation (usually instant)

## Step 4: Configure Bucket Permissions

1. **Open Bucket Settings**

   - Click on your newly created bucket
   - Click the "Permissions" tab

2. **Set Public Access (Optional - for public files)**

   - If you want files to be publicly accessible:
     - Click "Add Principal"
     - **New principals**: `allUsers`
     - **Role**: Select "Storage Object Viewer"
     - Click "Save"
     - Confirm the warning about public access

3. **For Private Files (Recommended)**
   - Keep bucket private
   - Use signed URLs for access (already implemented in code)

## Step 5: Create a Service Account

1. **Navigate to Service Accounts**

   - In the left sidebar, click "IAM & Admin" → "Service Accounts"
   - Or go directly to: https://console.cloud.google.com/iam-admin/serviceaccounts

2. **Create Service Account**

   - Click "Create Service Account"
   - Fill in details:
     - **Service account name**: `word2wallet-storage`
     - **Service account ID**: Auto-generated (e.g., `word2wallet-storage@project-id.iam.gserviceaccount.com`)
     - **Description**: "Service account for Word2Wallet file storage"
   - Click "Create and Continue"

3. **Grant Roles**

   - **Role**: Select "Storage Admin" (full control over buckets and objects)
   - Alternative roles:
     - `Storage Object Admin`: Full control over objects only
     - `Storage Object Creator`: Can create objects
     - `Storage Object Viewer`: Read-only access
   - Click "Continue"

4. **Grant Access to Users (Optional)**
   - Skip this step (not needed for application use)
   - Click "Done"

## Step 6: Create and Download Service Account Key

1. **Open Service Account**

   - Click on your newly created service account

2. **Create Key**

   - Click the "Keys" tab
   - Click "Add Key" → "Create new key"
   - **Key type**: Select "JSON"
   - Click "Create"
   - The JSON key file will automatically download

3. **Save the Key File**

   - Save the downloaded JSON file securely
   - **Recommended location**: `word2wallet-backend/config/gcs-key.json`
   - **Important**: Never commit this file to git!
   - Add to `.gitignore`:
     ```
     config/gcs-key.json
     *.json
     !package.json
     !package-lock.json
     ```

4. **View Key Contents (for environment variables)**
   - Open the JSON file
   - You'll need these values:
     - `project_id`: Your GCP project ID
     - `private_key`: The private key (long string)
     - `client_email`: The service account email

## Step 7: Configure CORS (Optional - for direct browser access)

1. **Create CORS Configuration File**

   - Create a file named `cors.json`:

   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
       "responseHeader": [
         "Content-Type",
         "Content-Length",
         "Content-Range",
         "Range",
         "Access-Control-Allow-Origin"
       ],
       "maxAgeSeconds": 3600
     }
   ]
   ```

2. **Apply CORS Configuration**
   - Open Cloud Shell (click the terminal icon in the top bar)
   - Or use `gsutil` command locally:
   ```bash
   gsutil cors set cors.json gs://your-bucket-name
   ```

## Step 8: Configure Your Application

### Option A: Using Key File (Recommended for Development)

1. **Place the JSON key file**

   - Copy the downloaded JSON file to: `word2wallet-backend/config/gcs-key.json`

2. **Update `.env` file**
   ```env
   # Google Cloud Storage Configuration
   GCS_BUCKET_NAME=word2wallet-media
   GCS_PROJECT_ID=your-project-id
   GCS_KEY_FILENAME=config/gcs-key.json
   ```

### Option B: Using Environment Variables (Recommended for Production)

1. **Extract values from JSON key file**

   - Open the downloaded JSON file
   - Copy the values

2. **Update `.env` file**

   ```env
   # Google Cloud Storage Configuration
   GCS_BUCKET_NAME=word2wallet-media
   GCS_PROJECT_ID=your-project-id
   GCS_CLIENT_EMAIL=word2wallet-storage@your-project-id.iam.gserviceaccount.com
   GCS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
   ```

   **Important**:

   - Keep the `\n` characters in the private key
   - Keep the quotes around the private key value
   - The private key should be on a single line with `\n` characters

3. **Optional: Custom Public URL**
   ```env
   # If using CDN or custom domain
   GCS_PUBLIC_URL=https://storage.googleapis.com/your-bucket-name
   ```

## Step 9: Verify Setup

1. **Test Bucket Access**

   - Run your application
   - Try uploading a file
   - Check the bucket in Google Cloud Console to see if the file appears

2. **Check Logs**
   - Look for: "Using Google Cloud Storage service" in your application logs
   - If you see errors, check:
     - Bucket name is correct
     - Service account has proper permissions
     - Key file path is correct (if using key file)

## Step 10: Set Up Billing (Required)

1. **Enable Billing**

   - Go to: https://console.cloud.google.com/billing
   - Click "Link a billing account"
   - Create a new billing account or link an existing one
   - Enter payment information

2. **Link to Project**
   - Select your project
   - Link the billing account

**Note**: Google Cloud offers a free tier:

- 5 GB of Standard Storage per month
- 5,000 Class A operations per month
- 50,000 Class B operations per month

## Troubleshooting

### Error: "Bucket does not exist"

- **Solution**: Verify bucket name in `.env` matches exactly (case-sensitive)
- Check bucket exists in Google Cloud Console

### Error: "Permission denied"

- **Solution**:
  - Verify service account has "Storage Admin" role
  - Check key file path is correct
  - Verify JSON key file is valid

### Error: "Invalid credentials"

- **Solution**:
  - Regenerate service account key
  - Check `GCS_CLIENT_EMAIL` and `GCS_PRIVATE_KEY` are correct
  - Ensure private key includes `\n` characters

### Files not accessible

- **Solution**:
  - Check bucket permissions
  - Verify CORS is configured if accessing from browser
  - Check signed URL expiration time

## Security Best Practices

1. **Never commit credentials to git**

   - Add `config/gcs-key.json` to `.gitignore`
   - Use environment variables in production

2. **Use least privilege**

   - Service account should only have necessary permissions
   - Use "Storage Object Admin" instead of "Storage Admin" if possible

3. **Rotate keys regularly**

   - Create new keys periodically
   - Delete old keys

4. **Monitor usage**
   - Set up billing alerts
   - Review storage usage regularly

## Cost Estimation

### Storage Costs (per GB/month)

- Standard: ~$0.020
- Nearline: ~$0.010
- Coldline: ~$0.004
- Archive: ~$0.0012

### Operation Costs

- Class A (writes, list): $0.05 per 10,000 operations
- Class B (reads): $0.004 per 10,000 operations

### Example Monthly Cost

- 100 GB storage: ~$2.00/month
- 1 million reads: ~$0.40/month
- 100,000 writes: ~$0.50/month
- **Total**: ~$2.90/month

## Next Steps

1. ✅ Test file uploads
2. ✅ Verify files appear in GCS bucket
3. ✅ Test file downloads/serving
4. ✅ Set up monitoring and alerts
5. ✅ Configure lifecycle policies (optional)
   - Auto-delete old files
   - Move to cheaper storage classes

## Additional Resources

- [GCS Documentation](https://cloud.google.com/storage/docs)
- [Node.js Client Library](https://cloud.google.com/nodejs/docs/reference/storage/latest)
- [Pricing Calculator](https://cloud.google.com/products/calculator)
- [Best Practices](https://cloud.google.com/storage/docs/best-practices)
