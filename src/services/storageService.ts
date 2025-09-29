import { S3Service, getS3Service } from "./s3Service";
import {
  LocalStorageService,
  getLocalStorageService,
} from "./localStorageService";

export type StorageProvider = "s3" | "local";

export interface StorageService {
  uploadFile(
    key: string,
    fileBuffer: Buffer,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<{
    key: string;
    url: string;
    etag: string;
    size: number;
  }>;

  uploadStream(
    key: string,
    stream: any,
    contentType: string,
    metadata?: { [key: string]: string }
  ): Promise<{
    key: string;
    url: string;
    etag: string;
    size: number;
  }>;

  downloadFile(key: string): Promise<Buffer>;
  getFileMetadata(key: string): Promise<any>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
  getPublicUrl(key: string): string;
  generatePresignedDownloadUrl(
    key: string,
    expiresIn?: number
  ): Promise<string>;
  generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number
  ): Promise<{
    uploadUrl: string;
    key: string;
    expiresIn: number;
  }>;
  listFiles(prefix: string, maxKeys?: number): Promise<any[]>;
  copyFile(sourceKey: string, destinationKey: string): Promise<void>;
  getFileSize(key: string): Promise<number>;
}

// Singleton instance
let storageServiceInstance: StorageService | null = null;

export const getStorageService = (): StorageService => {
  if (!storageServiceInstance) {
    const provider = (process.env.STORAGE_PROVIDER ||
      "local") as StorageProvider;

    switch (provider) {
      case "s3":
        try {
          storageServiceInstance = getS3Service();
          console.log("Using S3 storage service");
        } catch (error) {
          console.warn(
            "S3 configuration not found, falling back to local storage:",
            error
          );
          storageServiceInstance = getLocalStorageService();
          console.log("Using local storage service (fallback)");
        }
        break;
      case "local":
      default:
        storageServiceInstance = getLocalStorageService();
        console.log("Using local storage service");
        break;
    }
  }

  return storageServiceInstance;
};

// Export individual services for direct access if needed
export { S3Service, LocalStorageService };
