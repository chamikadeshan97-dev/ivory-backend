
import multer from "multer";
import path from "node:path";

/* ========================================================
   CONFIG
======================================================== */

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MAX_FILES = 10;

const MAX_FIELDS = 20;

const MAX_FIELD_SIZE = 10 * 1024;

/* ========================================================
   STORAGE

   Files are temporarily kept in memory
   before being uploaded to Amazon S3.
======================================================== */

const storage = multer.memoryStorage();

/* ========================================================
   ALLOWED FILE TYPES
======================================================== */

const MIME_BY_EXTENSION = {
  ".jpg": ["image/jpeg", "image/jpg"],
  ".jpeg": ["image/jpeg", "image/jpg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".heic": [
    "image/heic",
    "application/octet-stream",
  ],
  ".heif": [
    "image/heif",
    "application/octet-stream",
  ],
  ".pdf": ["application/pdf"],
};

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const createUploadError = (message) => {
  const error = new Error(message);

  error.status = 400;

  return error;
};

/* ========================================================
   FILE FILTER
======================================================== */

const fileFilter = (req, file, cb) => {
  try {
    const originalName =
      String(file.originalname || "");

    const extension = path
      .extname(originalName)
      .toLowerCase();

    const mimeType = normalize(
      file.mimetype,
    );

    const allowedMimes =
      MIME_BY_EXTENSION[extension];

    if (!allowedMimes) {
      return cb(
        createUploadError(
          "Unsupported file extension. " +
            "Only JPG, JPEG, PNG, WEBP, " +
            "HEIC, HEIF and PDF files are allowed.",
        ),
      );
    }

    const genericBinary =
      mimeType ===
      "application/octet-stream";

    const validMime =
      allowedMimes.includes(mimeType) ||
      genericBinary;

    if (!validMime) {
      return cb(
        createUploadError(
          `File type does not match extension (${extension}).`,
        ),
      );
    }

    /*
     * Actual file content is validated in
     * s3Service.js before uploading to S3.
     */
    return cb(null, true);
  } catch (error) {
    return cb(error);
  }
};

/* ========================================================
   MULTER CONFIG
======================================================== */

const mediaUpload = multer({
  storage,

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: MAX_FIELDS,
    fieldSize: MAX_FIELD_SIZE,
    parts: MAX_FILES + MAX_FIELDS,
  },

  fileFilter,
});

/* ========================================================
   CONFIG EXPORTS
======================================================== */

export const MEDIA_UPLOAD_LIMITS = {
  maxFileSize: MAX_FILE_SIZE,
  maxFiles: MAX_FILES,
  maxFields: MAX_FIELDS,
  maxFieldSize: MAX_FIELD_SIZE,
};

export default mediaUpload;
