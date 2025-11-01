import { Router, Response } from "express";
import path from "path";
import fs from "fs";
import { getLocalStorageService } from "../services/localStorageService";

const router = Router();

/**
 * Serve files from local storage
 */
router.get("/:filename", async (req, res): Promise<Response> => {
  try {
    const { filename } = req.params;
    const storageService = getLocalStorageService();

    // Check if file exists
    const exists = await storageService.fileExists(filename);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    // Get file metadata
    const metadata = await storageService.getFileMetadata(filename);

    // Set appropriate headers with CORS
    if (metadata.contentType) {
      res.setHeader("Content-Type", metadata.contentType);
    }
    res.setHeader("Content-Length", metadata.size.toString());
    res.setHeader("Last-Modified", metadata.lastModified.toUTCString());
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=31536000");

    // Stream the file
    const filePath = path.join(
      process.env.UPLOAD_PATH || "./uploads",
      filename
    );
    const fileStream = fs.createReadStream(filePath);

    fileStream.on("error", (error) => {
      console.error("File stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Error reading file",
        });
      }
    });

    fileStream.pipe(res);
    return res; // Return the response object
  } catch (error) {
    console.error("File serve error:", error);
    return res.status(500).json({
      success: false,
      message: "Error serving file",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * Upload file endpoint (for presigned URL compatibility)
 */
router.put("/upload/:filename", async (req, res): Promise<Response> => {
  try {
    const { filename } = req.params;
    const contentType =
      req.headers["content-type"] || "application/octet-stream";

    // Get file buffer from request
    const chunks: Buffer[] = [];

    return new Promise<Response>((resolve, reject) => {
      req.on("data", (chunk) => {
        chunks.push(chunk);
      });

      req.on("end", async () => {
        try {
          const fileBuffer = Buffer.concat(chunks);
          const storageService = getLocalStorageService();

          await storageService.uploadFile(filename, fileBuffer, contentType, {
            uploadedAt: new Date().toISOString(),
            contentType,
          });

          const response = res.json({
            success: true,
            message: "File uploaded successfully",
            data: {
              key: filename,
              url: storageService.getPublicUrl(filename),
              size: fileBuffer.length,
            },
          });
          resolve(response);
        } catch (error) {
          console.error("Upload error:", error);
          const response = res.status(500).json({
            success: false,
            message: "Error uploading file",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          resolve(response);
        }
      });

      req.on("error", (error) => {
        console.error("Request error:", error);
        const response = res.status(500).json({
          success: false,
          message: "Error processing upload",
          error: error.message,
        });
        resolve(response);
      });
    });
  } catch (error) {
    console.error("Upload endpoint error:", error);
    return res.status(500).json({
      success: false,
      message: "Error in upload endpoint",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
