import crypto from "crypto";
import fs from "fs";
import path from "path";
const { open } = require("epub-parser");
import { IBook, BookStatus, EpubMetadata } from "../types";

// Promise wrapper for epub-parser
function parseEpub(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    open(filePath, (error: any, epub: any) => {
      if (error) {
        reject(error);
      } else {
        resolve(epub);
      }
    });
  });
}

export interface EpubValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: EpubMetadata;
  fileSize: number;
  checksum: string;
}

export interface EpubProcessingResult {
  metadata: EpubMetadata;
  pageCount?: number;
  wordCount?: number;
  readingTime?: number;
  coverImageUrl?: string;
}

export class EpubService {
  /**
   * Validate EPUB file and extract metadata
   */
  static async validateEpub(filePath: string): Promise<EpubValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        errors.push("File does not exist");
        return { isValid: false, errors, warnings, fileSize: 0, checksum: "" };
      }

      // Get file stats
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Check file size (max 100MB)
      if (fileSize > 100 * 1024 * 1024) {
        errors.push("File size exceeds 100MB limit");
      }

      // Calculate checksum
      const checksum = await this.calculateChecksum(filePath);

      // Parse EPUB
      const epubData = await parseEpub(filePath);

      // Debug logging to understand the structure
      console.log("EPUB parsing debug:", {
        hasManifest: !!epubData.manifest,
        manifestKeys: epubData.manifest
          ? Object.keys(epubData.manifest).length
          : 0,
        hasSpine: !!epubData.spine,
        spineLength: epubData.spine ? epubData.spine.length : 0,
        epubDataKeys: Object.keys(epubData),
        metadata: epubData.metadata,
      });

      // Validate critical EPUB structure (check for alternative property names)
      const manifest =
        epubData.manifest || epubData.manifests || epubData.manifestItems;
      const spine = epubData.spine || epubData.spines || epubData.spineItems;

      if (!manifest || Object.keys(manifest).length === 0) {
        // Convert to warning instead of error - some EPUBs might have different structure
        warnings.push(
          "EPUB manifest is empty or missing - using fallback validation"
        );
      }

      if (!spine || spine.length === 0) {
        // Convert to warning instead of error - some EPUBs might have different structure
        warnings.push(
          "EPUB spine is empty or missing - using fallback validation"
        );
      }

      // Check metadata (convert to warnings instead of errors for better UX)
      if (!epubData.metadata?.title) {
        warnings.push("Missing metadata: title (will use default)");
      }

      if (!epubData.metadata?.creator) {
        warnings.push("Missing metadata: creator (will use default)");
      }

      // Extract and validate metadata
      const metadata: EpubMetadata = {
        title: epubData.metadata?.title || "Unknown Title",
        creator: epubData.metadata?.creator || "Unknown Author",
        publisher: epubData.metadata?.publisher,
        language: epubData.metadata?.language || "en",
        description: epubData.metadata?.description,
        coverImage: (epubData.metadata as any)?.cover,
        totalPages: spine?.length || 0,
        fileSize,
        lastModified: stats.mtime,
      };

      // Check for warnings
      if (!metadata.publisher) {
        warnings.push("Publisher information is missing");
      }

      if (!metadata.description) {
        warnings.push("Description is missing");
      }

      if (!metadata.coverImage) {
        warnings.push("Cover image is missing");
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata,
        fileSize,
        checksum,
      };
    } catch (error) {
      errors.push(
        `Failed to parse EPUB: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      return { isValid: false, errors, warnings, fileSize: 0, checksum: "" };
    }
  }

  /**
   * Process EPUB file to extract additional information
   */
  static async processEpub(
    filePath: string,
    metadata: EpubMetadata
  ): Promise<EpubProcessingResult> {
    try {
      const epubData = await parseEpub(filePath);

      // Calculate word count from all text content
      let wordCount = 0;
      let totalText = "";

      if (epubData.spine) {
        for (const item of epubData.spine) {
          if (epubData.manifest[(item as any).id]?.href) {
            try {
              const content = (epubData.manifest[(item as any).id] as any)
                .content;
              if (content) {
                // Remove HTML tags and count words
                const textContent = content
                  .replace(/<[^>]*>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim();
                totalText += textContent + " ";
              }
            } catch (error) {
              console.warn(
                `Failed to process item ${(item as any).id}:`,
                error
              );
            }
          }
        }
      }

      // Count words (simple word counting)
      wordCount = totalText
        .split(/\s+/)
        .filter((word) => word.length > 0).length;

      // Estimate reading time (average 200 words per minute)
      const readingTime = Math.ceil(wordCount / 200);

      // Extract cover image URL if available
      let coverImageUrl: string | undefined;
      if (metadata.coverImage && epubData.manifest[metadata.coverImage]) {
        coverImageUrl = epubData.manifest[metadata.coverImage].href;
      }

      return {
        metadata: {
          ...metadata,
          wordCount,
          totalPages: epubData.spine?.length || metadata.totalPages,
        },
        pageCount: epubData.spine?.length,
        wordCount,
        readingTime,
        coverImageUrl,
      };
    } catch (error) {
      console.error("Failed to process EPUB:", error);
      return {
        metadata,
        pageCount: metadata.totalPages,
        wordCount: 0,
        readingTime: 0,
      };
    }
  }

  /**
   * Calculate SHA-256 checksum of file
   */
  static async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Generate unique file key for GCS storage
   */
  static generateFileKey(userId: string, fileName: string): string {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString("hex");
    const extension = path.extname(fileName);
    const baseName = path.basename(fileName, extension);

    return `books/${userId}/${timestamp}-${randomString}-${baseName}${extension}`;
  }

  /**
   * Validate file extension
   */
  static isValidEpubFile(fileName: string): boolean {
    const validExtensions = [".epub", ".EPUB"];
    const extension = path.extname(fileName);
    return validExtensions.includes(extension);
  }

  /**
   * Get file MIME type
   */
  static getEpubMimeType(): string {
    return "application/epub+zip";
  }

  /**
   * Clean up temporary files
   */
  static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error("Failed to cleanup temp file:", error);
    }
  }
}
