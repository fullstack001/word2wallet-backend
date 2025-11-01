import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

export interface LocalStorageConfig {
  uploadPath: string;
  baseUrl: string;
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

export class LocalStorageService {
  private uploadPath: string;
  private baseUrl: string;

  constructor(config: LocalStorageConfig) {
    this.uploadPath = config.uploadPath;
    this.baseUrl = config.baseUrl;

    // Ensure upload directory exists
    this.ensureDirectoryExists(this.uploadPath);
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Generate a unique file key
   */
  private generateFileKey(originalName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, "_");

    return `${sanitizedName}_${timestamp}_${random}${ext}`;
  }

  /**
   * Upload file to local storage
   */
  async uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<UploadResult> {
    try {
      const filePath = path.join(this.uploadPath, key);

      // Ensure the directory for this file exists
      const fileDir = path.dirname(filePath);
      this.ensureDirectoryExists(fileDir);

      // Write file to disk
      fs.writeFileSync(filePath, fileBuffer);

      // Store metadata in a separate file
      if (metadata) {
        const metadataPath = `${filePath}.meta`;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      }

      // Calculate ETag (simple hash of file content)
      const etag = crypto.createHash("md5").update(fileBuffer).digest("hex");

      return {
        key,
        url: `${this.baseUrl}/${key}`,
        etag,
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
    try {
      const filePath = path.join(this.uploadPath, key);

      // Ensure the directory for this file exists
      const fileDir = path.dirname(filePath);
      this.ensureDirectoryExists(fileDir);

      // Write stream to file
      const writeStream = fs.createWriteStream(filePath);
      stream.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on("finish", async () => {
          try {
            const stats = fs.statSync(filePath);

            // Store metadata in a separate file
            if (metadata) {
              const metadataPath = `${filePath}.meta`;
              fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            }

            // Calculate ETag
            const fileBuffer = fs.readFileSync(filePath);
            const etag = crypto
              .createHash("md5")
              .update(fileBuffer)
              .digest("hex");

            resolve({
              key,
              url: `${this.baseUrl}/${key}`,
              etag,
              size: stats.size,
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

        writeStream.on("error", (error) => {
          reject(new Error(`Failed to upload stream: ${error.message}`));
        });
      });
    } catch (error) {
      throw new Error(
        `Failed to upload stream: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Download file from local storage
   */
  async downloadFile(key: string): Promise<Buffer> {
    try {
      const filePath = path.join(this.uploadPath, key);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${key}`);
      }

      return fs.readFileSync(filePath);
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
  async getFileMetadata(key: string): Promise<{
    size: number;
    lastModified: Date;
    contentType?: string;
    metadata?: { [key: string]: string };
  }> {
    try {
      const filePath = path.join(this.uploadPath, key);

      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${key}`);
      }

      const stats = fs.statSync(filePath);
      let metadata: { [key: string]: string } | undefined;

      // Try to read metadata file
      const metadataPath = `${filePath}.meta`;
      if (fs.existsSync(metadataPath)) {
        try {
          const metadataContent = fs.readFileSync(metadataPath, "utf8");
          metadata = JSON.parse(metadataContent);
        } catch (error) {
          // Ignore metadata parsing errors
        }
      }

      return {
        size: stats.size,
        lastModified: stats.mtime,
        contentType: metadata?.contentType,
        metadata,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file metadata: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Delete file from local storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadPath, key);
      const metadataPath = `${filePath}.meta`;

      // Delete main file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete metadata file
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
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
      const filePath = path.join(this.uploadPath, key);
      return fs.existsSync(filePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate public URL for file
   */
  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  /**
   * Generate presigned URL for download (for compatibility with S3 interface)
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    // For local storage, we just return the public URL
    // In a real implementation, you might want to generate temporary tokens
    return this.getPublicUrl(key);
  }

  /**
   * Generate presigned URL for upload (for compatibility with S3 interface)
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<PresignedUrlResult> {
    // For local storage, we return a direct upload endpoint
    return {
      uploadUrl: `${this.baseUrl}/upload/${key}`,
      key,
      expiresIn,
    };
  }

  /**
   * List files with prefix
   */
  async listFiles(
    prefix: string,
    maxKeys: number = 1000
  ): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
    try {
      const results: Array<{ key: string; size: number; lastModified: Date }> =
        [];

      const scanDirectory = (dir: string, currentPrefix: string = ""): void => {
        const items = fs.readdirSync(dir);

        for (const item of items) {
          const itemPath = path.join(dir, item);
          const itemKey = currentPrefix ? `${currentPrefix}/${item}` : item;
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            scanDirectory(itemPath, itemKey);
          } else if (!item.endsWith(".meta") && itemKey.startsWith(prefix)) {
            results.push({
              key: itemKey,
              size: stats.size,
              lastModified: stats.mtime,
            });
          }
        }
      };

      scanDirectory(this.uploadPath);

      return results.slice(0, maxKeys);
    } catch (error) {
      throw new Error(
        `Failed to list files: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Copy file within local storage
   */
  async copyFile(sourceKey: string, destinationKey: string): Promise<void> {
    try {
      const sourcePath = path.join(this.uploadPath, sourceKey);
      const destPath = path.join(this.uploadPath, destinationKey);

      if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourceKey}`);
      }

      // Ensure destination directory exists
      const destDir = path.dirname(destPath);
      this.ensureDirectoryExists(destDir);

      // Copy main file
      fs.copyFileSync(sourcePath, destPath);

      // Copy metadata file if it exists
      const sourceMetadataPath = `${sourcePath}.meta`;
      const destMetadataPath = `${destPath}.meta`;
      if (fs.existsSync(sourceMetadataPath)) {
        fs.copyFileSync(sourceMetadataPath, destMetadataPath);
      }
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
let localStorageInstance: LocalStorageService | null = null;

export const getLocalStorageService = (): LocalStorageService => {
  if (!localStorageInstance) {
    const config: LocalStorageConfig = {
      uploadPath:
        process.env.UPLOAD_PATH || path.join(__dirname, "../../uploads"),
      baseUrl: process.env.BASE_URL || "http://localhost:5000/uploads",
    };

    localStorageInstance = new LocalStorageService(config);
  }

  return localStorageInstance;
};
