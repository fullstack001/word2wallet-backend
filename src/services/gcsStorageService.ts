import { Storage, Bucket, File } from "@google-cloud/storage";
import { Readable } from "stream";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

export interface GCSStorageConfig {
  bucketName: string;
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email: string;
    private_key: string;
  };
  publicUrl?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  etag: string;
  size: number;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export class GCSStorageService {
  private storage: Storage;
  private bucket: Bucket;
  private bucketName: string;
  private publicUrl?: string;

  constructor(config: GCSStorageConfig) {
    this.bucketName = config.bucketName;
    this.publicUrl = config.publicUrl;

    // Initialize GCS client
    if (config.credentials) {
      this.storage = new Storage({
        projectId: config.projectId,
        credentials: config.credentials,
      });
    } else if (config.keyFilename) {
      this.storage = new Storage({
        projectId: config.projectId,
        keyFilename: config.keyFilename,
      });
    } else {
      // Use default credentials (from environment or metadata service)
      this.storage = new Storage({
        projectId: config.projectId,
      });
    }

    this.bucket = this.storage.bucket(config.bucketName);

    // Ensure bucket exists (create if it doesn't)
    this.bucket
      .exists()
      .then(([exists]) => {
        if (!exists) {
          console.warn(
            `Bucket ${config.bucketName} does not exist. Please create it manually or ensure proper permissions.`
          );
        }
      })
      .catch((error) => {
        console.error("Error checking bucket existence:", error);
      });
  }

  /**
   * Upload file to Google Cloud Storage
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<UploadResult> {
    try {
      const file = this.bucket.file(key);

      // Upload options
      const uploadOptions: any = {
        metadata: {
          contentType,
          metadata: metadata || {},
        },
        resumable: false, // For small files, use simple upload
      };

      // Upload buffer to GCS
      await file.save(fileBuffer, uploadOptions);

      // Make file publicly readable (optional, can be configured)
      // await file.makePublic().catch(() => {}); // Ignore errors if already public

      // Calculate ETag (MD5 hash)
      const etag = crypto.createHash("md5").update(fileBuffer).digest("hex");

      // Generate public URL
      const url = this.getPublicUrl(key);

      return {
        key,
        url,
        etag,
        size: fileBuffer.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to upload file to GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload file from stream
   */
  async uploadStream(
    key: string,
    stream: Readable,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<UploadResult> {
    try {
      const file = this.bucket.file(key);

      // Upload options
      const uploadOptions: any = {
        metadata: {
          contentType,
          metadata: metadata || {},
        },
        resumable: true, // Use resumable upload for streams
      };

      // Create write stream
      const writeStream = file.createWriteStream(uploadOptions);

      // Pipe stream to GCS
      return new Promise((resolve, reject) => {
        let size = 0;
        const chunks: Buffer[] = [];

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
          size += chunk.length;
        });

        stream.on("end", async () => {
          try {
            const fileBuffer = Buffer.concat(chunks);
            await file.save(fileBuffer, {
              metadata: {
                contentType,
                metadata: metadata || {},
              },
            });

            // Calculate ETag
            const etag = crypto
              .createHash("md5")
              .update(fileBuffer)
              .digest("hex");

            const url = this.getPublicUrl(key);

            resolve({
              key,
              url,
              etag,
              size,
            });
          } catch (error) {
            reject(
              new Error(
                `Failed to finalize upload: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              )
            );
          }
        });

        stream.on("error", (error) => {
          reject(new Error(`Failed to upload stream: ${error.message}`));
        });

        // Pipe to write stream
        stream.pipe(writeStream);

        writeStream.on("error", (error) => {
          reject(new Error(`GCS upload error: ${error.message}`));
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to upload stream to GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download file from Google Cloud Storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error(`File not found: ${key}`);
      }

      const [buffer] = await file.download();
      return buffer;
    } catch (error) {
      throw new Error(
        `Failed to download file from GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: { [key: string]: string };
  }> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error(`File not found: ${key}`);
      }

      const [metadata] = await file.getMetadata();

      const sizeValue = metadata.size;
      const size =
        typeof sizeValue === "number"
          ? sizeValue
          : parseInt(String(sizeValue || "0"), 10);

      const dateValue = metadata.updated || metadata.timeCreated;
      const lastModified = dateValue ? new Date(String(dateValue)) : new Date();

      const customMetadata = metadata.metadata || {};
      const stringMetadata: { [key: string]: string } = {};
      for (const [key, value] of Object.entries(customMetadata)) {
        if (value !== null && value !== undefined) {
          stringMetadata[key] = String(value);
        }
      }

      return {
        size,
        lastModified,
        contentType: metadata.contentType,
        metadata: stringMetadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file metadata from GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete file from Google Cloud Storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();

      if (exists) {
        await file.delete();
      }
    } catch (error) {
      throw new Error(
        `Failed to delete file from GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate public URL for file
   */
  getPublicUrl(key: string): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/${key}`;
    }
    // Default GCS public URL format
    return `https://storage.googleapis.com/${this.bucketName}/${key}`;
  }

  /**
   * Generate presigned URL for download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const file = this.bucket.file(key);
      const [exists] = await file.exists();

      if (!exists) {
        throw new Error(`File not found: ${key}`);
      }

      const [url] = await file.getSignedUrl({
        action: "read",
        expires: Date.now() + expiresIn * 1000,
      });

      return url;
    } catch (error) {
      throw new Error(
        `Failed to generate presigned download URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate presigned URL for upload
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    try {
      const file = this.bucket.file(key);

      const [url] = await file.getSignedUrl({
        action: "write",
        expires: Date.now() + expiresIn * 1000,
        contentType,
      });

      return {
        uploadUrl: url,
        key,
        expiresIn,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate presigned upload URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * List files with prefix
   */
  async listFiles(
    prefix: string,
    maxKeys: number = 1000
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const [files] = await this.bucket.getFiles({
        prefix,
        maxResults: maxKeys,
      });

      return files.map((file) => {
        const sizeValue = file.metadata.size;
        const size =
          typeof sizeValue === "number"
            ? sizeValue
            : parseInt(String(sizeValue ?? "0"), 10);

        const dateValue = file.metadata.updated || file.metadata.timeCreated;
        const lastModified = dateValue
          ? new Date(String(dateValue))
          : new Date();

        return {
          key: file.name,
          size,
          lastModified,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to list files from GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Copy file within GCS
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const sourceFile = this.bucket.file(sourceKey);
      const [exists] = await sourceFile.exists();

      if (!exists) {
        throw new Error(`Source file not found: ${sourceKey}`);
      }

      const destinationFile = this.bucket.file(destinationKey);
      await sourceFile.copy(destinationFile);
    } catch (error) {
      throw new Error(
        `Failed to copy file in GCS: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get file size
   */
  async getFileSize(key: string): Promise<number> {
    try {
      const metadata = await this.getFileMetadata(key);
      return metadata.size;
    } catch (error) {
      throw new Error(
        `Failed to get file size: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

// Singleton instance
let gcsStorageInstance: GCSStorageService | null = null;

export const getGCSStorageService = (): GCSStorageService => {
  if (!gcsStorageInstance) {
    const bucketName = process.env.GCS_BUCKET_NAME;
    if (!bucketName) {
      throw new Error(
        "GCS_BUCKET_NAME environment variable is required for GCS storage"
      );
    }

    const config: GCSStorageConfig = {
      bucketName,
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GCS_KEY_FILENAME,
      publicUrl: process.env.GCS_PUBLIC_URL,
      credentials:
        process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY
          ? {
              client_email: process.env.GCS_CLIENT_EMAIL,
              private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }
          : undefined,
    };

    gcsStorageInstance = new GCSStorageService(config);
  }

  return gcsStorageInstance;
};
