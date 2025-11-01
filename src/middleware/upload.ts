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

// Configure storage for thumbnails/covers
const thumbnailStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    cb(null, path.join(uploadPath, "covers"));
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `cover-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// Configure storage for audio files
const audioStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    cb(null, path.join(uploadPath, "audio"));
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `audio-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// Configure storage for video files
const videoStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    cb(null, path.join(uploadPath, "video"));
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `video-${uniqueSuffix}${path.extname(file.originalname)}`;
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

// File filter for audio files
const audioFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/m4a",
    "audio/aac",
    "audio/webm",
  ];

  const allowedExtensions = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"];

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const isValidMime = allowedMimes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(fileExtension);

  if (isValidMime || isValidExtension) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        "Only MP3, WAV, OGG, M4A, AAC, and WebM audio files are allowed",
        400
      )
    );
  }
};

// File filter for video files
const videoFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/3gp",
  ];

  const allowedExtensions = [
    ".mp4",
    ".avi",
    ".mov",
    ".wmv",
    ".flv",
    ".webm",
    ".mkv",
    ".3gp",
  ];

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const isValidMime = allowedMimes.includes(file.mimetype);
  const isValidExtension = allowedExtensions.includes(fileExtension);

  if (isValidMime || isValidExtension) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        "Only MP4, AVI, MOV, WMV, FLV, WebM, MKV, and 3GP video files are allowed",
        400
      )
    );
  }
};

// Legacy upload configurations (kept for backward compatibility)
export const uploadEpub = multer({
  storage: epubStorage,
  fileFilter: epubFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1, // Only one file at a time
  },
});

export const uploadThumbnail = multer({
  storage: thumbnailStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1, // Only one file at a time
  },
});

export const uploadAudio = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Maximum 10 audio files
  },
});

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 10, // Maximum 10 video files
  },
});

// Configure multer for course creation with all file types
export const uploadCourseContent = multer({
  storage: multer.diskStorage({
    destination: (req: Request, file, cb) => {
      const uploadPath = process.env.UPLOAD_PATH || "./uploads";
      let subPath = "";

      // Determine subdirectory based on fieldname
      if (file.fieldname === "cover") {
        subPath = "covers";
      } else if (file.fieldname === "audio") {
        subPath = "audio";
      } else if (file.fieldname === "video") {
        subPath = "video";
      }

      cb(null, path.join(uploadPath, subPath));
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
    const allowedMimes: { [key: string]: string[] } = {
      cover: ["image/jpeg", "image/jpg", "image/png", "image/webp"],
      audio: [
        "audio/mpeg",
        "audio/mp3",
        "audio/wav",
        "audio/ogg",
        "audio/m4a",
        "audio/aac",
        "audio/webm",
      ],
      video: [
        "video/mp4",
        "video/avi",
        "video/mov",
        "video/wmv",
        "video/flv",
        "video/webm",
        "video/mkv",
        "video/3gp",
      ],
    };

    const fieldMimes = allowedMimes[file.fieldname];
    if (fieldMimes && fieldMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new CustomError(`Invalid file type for ${file.fieldname}`, 400));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for all files
    files: 20, // Maximum 20 files total
  },
});

// Configure multer for multiple file types (legacy)
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
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 2, // Maximum 2 files
  },
});

// Configure storage for media files (images, audio, video)
const mediaStorage = multer.diskStorage({
  destination: (req: Request, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || "./uploads";
    const tempDir = path.join(uploadPath, "temp");
    cb(null, tempDir);
  },
  filename: (req: Request, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `media-${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  },
});

// File filter for media files (images, audio, video)
const mediaFileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
    // Audio
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/m4a",
    "audio/aac",
    "audio/webm",
    // Video
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/flv",
    "video/webm",
    "video/mkv",
    "video/3gp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new CustomError(
        "Only images (JPEG, PNG, WebP, GIF), audio (MP3, WAV, OGG, M4A, AAC, WebM), and video (MP4, AVI, MOV, WMV, FLV, WebM, MKV, 3GP) files are allowed",
        400
      )
    );
  }
};

export const uploadMedia = multer({
  storage: mediaStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1, // Only one file at a time
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
        message: "File too large. Please check the file size limits.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Please check the file count limits.",
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
