import multer from "multer";
import path from "path";
import { Request } from "express";
import { CustomError } from "./errorHandler";

// Configure storage for EPUB files
const epubStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.EPUB_UPLOAD_PATH || "./uploads/epubs";
    cb(null, uploadPath);
  },
  filename: (req: Request, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `epub-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// Configure storage for thumbnails
const thumbnailStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    cb(null, path.join(uploadPath, "thumbnails"));
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `thumb-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// File filter for EPUB files
const epubFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "application/epub+zip",
    "application/x-epub+zip",
    "application/zip",
  ];

  const allowedExtensions = [".epub"];

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const isValidMime = allowedMimes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(fileExtension);

  if (isValidMime || isValidExtension) {
    cb(null, true);
  } else {
    cb(new CustomError("Only EPUB files are allowed", 400));
  }
};

// File filter for images
const imageFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new CustomError("Only JPEG, PNG, and WebP images are allowed", 400));
  }
};

// Configure multer for EPUB uploads
export const uploadEpub = multer({
  storage: epubStorage,
  fileFilter: epubFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1, // Only one file at a time
  },
});

// Configure multer for thumbnail uploads
export const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only one file at a time
  },
});

// Configure multer for multiple file types
export const uploadMultiple = multer({
  storage: multer.diskStorage({
    destination: (req: Request, file, cb) => {
      const uploadPath = process.env.UPLOAD_PATH || "./uploads";
      cb(null, uploadPath);
    },
    filename: (req: Request, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const filename = `${file.fieldname}-${uniqueSuffix}${path.extname(
        file.originalname
      )}`;
      cb(null, filename);
    },
  }),
  fileFilter: (
    req: Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ) => {
    const allowedMimes = [
      "application/epub+zip",
      "application/x-epub+zip",
      "application/zip",
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new CustomError("Invalid file type", 400));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 2, // Maximum 2 files
  },
});

// Error handling middleware for multer
export const handleUploadError = (
  error: any,
  req: Request,
  res: any,
  next: any
) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 50MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum is 2 files.",
      });
    }
    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field name.",
      });
    }
  }

  if (error instanceof CustomError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
};
