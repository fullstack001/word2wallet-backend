import AWS from "aws-sdk";
import { S3 } from "aws-sdk";
import crypto from "crypto";
import { Readable } from "stream";

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string; // For S3-compatible services like Cloudflare R2
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

export class S3Service {
  private s3: S3;
  private bucket: string;

  constructor(config: S3Config) {
    const s3Config: S3.ClientConfiguration = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region,
    };

    // Add endpoint for S3-compatible services
    if (config.endpoint) {
      s3Config.endpoint = config.endpoint;
      s3Config.s3ForcePathStyle = true; // Required for some S3-compatible services
    }

    this.s3 = new S3(s3Config);
    this.bucket = config.bucket;
  }

  /**
   * Generate presigned URL for direct upload
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    const params = {
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      Expires: expiresIn,
      Conditions: [
        ["content-length-range", 1, 100 * 1024 * 1024], // 1 byte to 100MB
      ],
    };

    try {
      const uploadUrl = await this.s3.getSignedUrlPromise("putObject", params);

      return {
        uploadUrl,
        key,
        expiresIn,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate presigned URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Upload file directly to S3
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<UploadResult> {
    const params: S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      Metadata: metadata,
    };

    try {
      const result = await this.s3.upload(params).promise();

      return {
        key: result.Key,
        url: result.Location,
        etag: result.ETag || "",
        size: fileBuffer.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to upload file: ${
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
    const params: S3.PutObjectRequest = {
      Bucket: this.bucket,
      Key: key,
      Body: stream,
      ContentType: contentType,
      Metadata: metadata,
    };

    try {
      const result = await this.s3.upload(params).promise();

      return {
        key: result.Key,
        url: result.Location,
        etag: result.ETag || "",
        size: 0, // Size not available from stream upload
      };
    } catch (error) {
      throw new Error(
        `Failed to upload stream: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download file from S3
   */
  async downloadFile(key: string): Promise<Buffer> {
    const params: S3.GetObjectRequest = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      const result = await this.s3.getObject(params).promise();
      return result.Body as Buffer;
    } catch (error) {
      throw new Error(
        `Failed to download file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(key: string): Promise<S3.HeadObjectOutput> {
    const params: S3.HeadObjectRequest = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      return await this.s3.headObject(params).promise();
    } catch (error) {
      throw new Error(
        `Failed to get file metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    const params: S3.DeleteObjectRequest = {
      Bucket: this.bucket,
      Key: key,
    };

    try {
      await this.s3.deleteObject(params).promise();
    } catch (error) {
      throw new Error(
        `Failed to delete file: ${
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
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate public URL for file
   */
  getPublicUrl(key: string): string {
    if (process.env.S3_BASE_URL) {
      return `${process.env.S3_BASE_URL}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.s3.config.region}.amazonaws.com/${key}`;
  }

  /**
   * Generate presigned URL for download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const params = {
      Bucket: this.bucket,
      Key: key,
      Expires: expiresIn,
    };

    try {
      return await this.s3.getSignedUrlPromise("getObject", params);
    } catch (error) {
      throw new Error(
        `Failed to generate download URL: ${
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
  ): Promise<S3.Object[]> {
    const params: S3.ListObjectsV2Request = {
      Bucket: this.bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
    };

    try {
      const result = await this.s3.listObjectsV2(params).promise();
      return result.Contents || [];
    } catch (error) {
      throw new Error(
        `Failed to list files: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Copy file within S3
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    const params: S3.CopyObjectRequest = {
      Bucket: this.bucket,
      CopySource: `${this.bucket}/${sourceKey}`,
      Key: destinationKey,
    };

    try {
      await this.s3.copyObject(params).promise();
    } catch (error) {
      throw new Error(
        `Failed to copy file: ${
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
      return metadata.ContentLength || 0;
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
let s3ServiceInstance: S3Service | null = null;

export const getS3Service = (): S3Service => {
  if (!s3ServiceInstance) {
    const config: S3Config = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
      region: process.env.S3_REGION || "us-east-1",
      bucket: process.env.S3_BUCKET || "",
      endpoint: process.env.S3_ENDPOINT, // Optional for S3-compatible services
    };

    // Validate required configuration
    if (!config.accessKeyId) {
      throw new Error("S3_ACCESS_KEY_ID environment variable is required");
    }
    if (!config.secretAccessKey) {
      throw new Error("S3_SECRET_ACCESS_KEY environment variable is required");
    }
    if (!config.bucket) {
      throw new Error("S3_BUCKET environment variable is required");
    }

    s3ServiceInstance = new S3Service(config);
  }

  return s3ServiceInstance;
};
