import multer from "multer";
import path from "path";

/* ========================================================
   STORAGE
======================================================== */

const storage = multer.memoryStorage();

/* ========================================================
   ALLOWED FILE TYPES
======================================================== */

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

const allowedExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".pdf",
];

/* ========================================================
   FILE FILTER
======================================================== */

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  console.log("Patient media upload:", {
    originalname: file.originalname,
    mimetype: file.mimetype,
    extension,
  });

  const validMimeType = allowedMimeTypes.includes(file.mimetype);
  const validExtension = allowedExtensions.includes(extension);

  /*
   * Some browsers / Postman / mobile devices can send files as
   * application/octet-stream even though the file is actually
   * JPG, PNG, HEIC, etc.
   */
  const genericBinaryMime =
    file.mimetype === "application/octet-stream";

  if (
    validMimeType ||
    (genericBinaryMime && validExtension)
  ) {
    return cb(null, true);
  }

  return cb(
    new Error(
      `Unsupported file type (${file.mimetype}). ` +
        `Only JPG, JPEG, PNG, WEBP, HEIC, HEIF and PDF files are allowed.`,
    ),
    false,
  );
};

/* ========================================================
   MULTER CONFIG
======================================================== */

const mediaUpload = multer({
  storage,

  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },

  fileFilter,
});

export default mediaUpload;