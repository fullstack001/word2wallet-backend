# Google Cloud Storage Migration Guide

This document outlines the migration from local file storage to Google Cloud Storage (GCS).

## Overview

All file storage operations have been migrated from local filesystem to Google Cloud Storage. Files are now stored in GCS buckets and served via signed URLs.

## Changes Made

### 1. Storage Service

- **Created**: `src/services/gcsStorageService.ts` - New GCS storage service implementation
- **Updated**: `src/services/storageService.ts` - Now exclusively uses GCS
- **Removed**: `src/services/localStorageService.ts` - Local storage has been completely removed

### 2. File Upload Middleware

- **Updated**: `src/middleware/upload.ts` - All multer configurations now use memory storage instead of disk storage
- Files are uploaded directly to GCS from memory buffers

### 3. Controllers Updated

- **bookController.ts**: Handles EPUB, PDF, and audio file uploads to GCS
- **mediaController.ts**: Handles image, audio, and video uploads to GCS
- **courseController.ts**: Handles course content, covers, EPUBs, and multimedia files in GCS
- **writeBookController.ts**: May still generate files locally temporarily (needs review for full GCS migration)
- **emailCampaignController.ts**: May still use local temp files for CSV processing (needs review)

### 4. File Serving Routes

- **Updated**: `src/routes/files.ts` - Now redirects to GCS signed URLs instead of serving local files
- All file serving endpoints now generate signed URLs and redirect to GCS

### 5. Server Configuration

- **Updated**: `src/server.ts` - Removed static file serving for `/uploads` directory
- Files are now served exclusively through GCS

## Configuration Required

### Environment Variables

Add the following to your `.env` file:

```env
# Google Cloud Storage Configuration
GCS_BUCKET_NAME=your-gcs-bucket-name
GCS_PROJECT_ID=your-gcs-project-id

# Option 1: Use service account key file (recommended for local development)
GCS_KEY_FILENAME=path/to/service-account-key.json

# Option 2: Use credentials directly (for production/CI/CD)
# GCS_CLIENT_EMAIL=your-service-account-email@project.iam.gserviceaccount.com
# GCS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n

# Optional: Custom public URL (if using CDN or custom domain)
# GCS_PUBLIC_URL=https://storage.googleapis.com/your-bucket-name
```

### Google Cloud Setup

1. **Create a GCS Bucket**:

   ```bash
   gsutil mb gs://your-bucket-name
   ```

2. **Create a Service Account**:

   - Go to Google Cloud Console → IAM & Admin → Service Accounts
   - Create a new service account
   - Grant it the "Storage Admin" role
   - Create and download a JSON key file

3. **Set Bucket Permissions**:

   - Make bucket publicly readable (if needed for public files)
   - Or use signed URLs for private files (recommended)

4. **Configure CORS** (if serving files directly):

   ```bash
   gsutil cors set cors.json gs://your-bucket-name
   ```

   Example `cors.json`:

   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

## Migration Steps

### 1. Install Dependencies

```bash
npm install @google-cloud/storage
```

### 2. Configure Environment

- Copy `.env.example` to `.env`
- Add GCS configuration variables

### 3. Test Upload

- Upload a file through the API
- Verify it appears in your GCS bucket
- Check that signed URLs work correctly

### 4. Migrate Existing Files (Optional)

If you have existing files in local storage, you'll need to migrate them:

```typescript
// Migration script example
import { getStorageService } from "./src/services/storageService";
import fs from "fs";
import path from "path";

async function migrateFiles() {
  const storageService = getStorageService();
  const uploadsDir = "./uploads";

  // Recursively find all files
  // Upload each to GCS
  // Update database references
}
```

## File Path Changes

### Before (Local Storage)

- Files stored at: `./uploads/books/userId/filename.epub`
- URLs: `http://localhost:5000/uploads/books/userId/filename.epub`

### After (GCS)

- Files stored at: `books/userId/filename.epub` (in GCS bucket)
- URLs: Signed URLs like `https://storage.googleapis.com/bucket/books/userId/filename.epub?X-Goog-Signature=...`

## Important Notes

1. **Signed URLs**: All file access now uses signed URLs with 1-hour expiration
2. **Memory Storage**: Files are processed in memory, no temporary disk storage
3. **EPUB Generation**: EPUBs are generated to temp files, then uploaded to GCS
4. **File Deletion**: File deletion now removes files from GCS, not local filesystem
5. **GCS Only**: The system now exclusively uses Google Cloud Storage - local storage has been removed

## Remaining Work

The following areas may still need updates for complete GCS migration:

1. **writeBookController.ts**: Generates EPUBs/PDFs locally - should upload to GCS
2. **emailCampaignController.ts**: May use local temp files for CSV processing
3. **Frontend Upload Route**: `word2wallet-frontend/src/app/api/upload/route.ts` still saves locally
4. **Database Migration**: Update existing file references to use GCS keys instead of local paths

## Troubleshooting

### Common Issues

1. **"Bucket does not exist"**

   - Ensure bucket name is correct
   - Check bucket exists in your GCS project

2. **"Permission denied"**

   - Verify service account has Storage Admin role
   - Check key file path is correct

3. **"Signed URL generation failed"**

   - Ensure service account has proper permissions
   - Check bucket CORS configuration

4. **Files not accessible**
   - Verify signed URL expiration time
   - Check bucket permissions
   - Ensure CORS is configured correctly

## Important Notes

- **GCS Only**: The system now exclusively uses Google Cloud Storage. Local storage and AWS S3 support have been completely removed.
- All file operations now go through GCS - ensure your GCS bucket is properly configured before deploying.
