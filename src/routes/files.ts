import { Router } from "express";
import { getStorageService } from "../services/storageService";

const router = Router();

/**
 * Serve files from GCS storage
 * Redirects to signed URL or streams file from GCS
 */
router.get("/:filename", async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;
    const storageService = getStorageService();

    // Check if file exists
    const exists = await storageService.fileExists(filename);
    if (!exists) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    // Generate signed URL for download (valid for 1 hour)
    const signedUrl = await storageService.generatePresignedDownloadUrl(
      filename,
      3600
    );

    // Redirect to signed URL
    res.redirect(signedUrl);
  } catch (error) {
    console.error("File serve error:", error);
    res.status(500).json({
      success: false,
      message: "Error serving file",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Upload file endpoint (for presigned URL compatibility)
 */
router.put("/upload/:filename", async (req, res): Promise<void> => {
  try {
    const { filename } = req.params;
    const contentType =
      req.headers["content-type"] || "application/octet-stream";

    // Get file buffer from request
    const chunks: Buffer[] = [];

    await new Promise<void>((resolve, reject) => {
      req.on("data", (chunk) => {
        chunks.push(chunk);
      });

      req.on("end", async () => {
        try {
          const fileBuffer = Buffer.concat(chunks);
          const storageService = getStorageService();

          const uploadResult = await storageService.uploadFile(
            filename,
            fileBuffer,
            contentType,
            {
              uploadedAt: new Date().toISOString(),
              contentType,
            }
          );

          res.json({
            success: true,
            message: "File uploaded successfully",
            data: {
              key: uploadResult.key,
              url: uploadResult.url,
              size: fileBuffer.length,
            },
          });
          resolve();
        } catch (error) {
          console.error("Upload error:", error);
          res.status(500).json({
            success: false,
            message: "Error uploading file",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          resolve();
        }
      });

      req.on("error", (error) => {
        console.error("Request error:", error);
        res.status(500).json({
          success: false,
          message: "Error processing upload",
          error: error.message,
        });
        resolve();
      });
    });
  } catch (error) {
    console.error("Upload endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Error in upload endpoint",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
