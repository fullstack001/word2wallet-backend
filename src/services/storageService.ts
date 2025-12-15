import { GCSStorageService, getGCSStorageService } from "./gcsStorageService";

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
    storageServiceInstance = getGCSStorageService();
    console.log("Using Google Cloud Storage service");
  }

  return storageServiceInstance;
};

// Export individual services for direct access if needed
export { GCSStorageService };
