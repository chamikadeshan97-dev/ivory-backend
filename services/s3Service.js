
import crypto from "node:crypto";
import path from "node:path";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/* ========================================================
   CONFIG
======================================================== */

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

if (!REGION || !BUCKET) {
  throw new Error(
    "AWS_REGION and AWS_S3_BUCKET are required",
  );
}

const s3 = new S3Client({
  region: REGION,
  maxAttempts: 3,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024;

/* ========================================================
   ALLOWED FILE TYPES
======================================================== */

const MIME_BY_EXTENSION = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

const ALLOWED_MIME_TYPES = new Set(
  Object.values(MIME_BY_EXTENSION),
);

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

const safeSegment = (value) =>
  normalize(value)
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 100);

const safeFileName = (value) =>
  path
    .basename(
      normalize(value).replace(/\\/g, "/"),
    )
    .replace(/[^a-zA-Z0-9_.-]/g, "_")
    .slice(0, 180);

const validateObjectKey = (key) => {
  const value = normalize(key);

  const parts = value.split("/");

  if (
    parts.length !== 4 ||
    parts[0] !== "patients" ||
    parts.slice(1).some((part) => !part) ||
    parts.some(
      (part) =>
        part === "." ||
        part === ".." ||
        part.includes("\\")
    )
  ) {
    throw new Error("Invalid S3 object key");
  }

  return value;
};

/* ========================================================
   FILE SIGNATURE VALIDATION
======================================================== */

const detectFileType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return null;
  }

  // JPEG
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  // PNG
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(pngSignature)
  ) {
    return "image/png";
  }

  // WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF
  if (
    buffer.subarray(0, 5).toString("ascii") ===
    "%PDF-"
  ) {
    return "application/pdf";
  }

  // HEIC / HEIF ISO BMFF file types
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 4, 8) === "ftyp"
  ) {
    const boxLength = buffer.readUInt32BE(0);

    if (
      boxLength >= 16 &&
      boxLength <= buffer.length
    ) {
      const brands = [];

      brands.push(
        buffer.toString("ascii", 8, 12),
      );

      for (
        let offset = 16;
        offset + 4 <= boxLength;
        offset += 4
      ) {
        brands.push(
          buffer.toString(
            "ascii",
            offset,
            offset + 4,
          ),
        );
      }

      const heicBrands = new Set([
        "heic",
        "heix",
        "hevc",
        "hevx",
      ]);

      const heifBrands = new Set([
        "mif1",
        "msf1",
      ]);

      if (
        brands.some((brand) =>
          heicBrands.has(brand)
        )
      ) {
        return "image/heic";
      }

      if (
        brands.some((brand) =>
          heifBrands.has(brand)
        )
      ) {
        return "image/heif";
      }
    }
  }

  return null;
};

/* ========================================================
   RESOLVE CONTENT TYPE
======================================================== */

const resolveContentType = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    throw new Error("Invalid uploaded file");
  }

  if (
    !file.buffer.length ||
    file.buffer.length > MAX_FILE_SIZE
  ) {
    throw new Error(
      "File must be between 1 byte and 10 MB",
    );
  }

  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  const expected = MIME_BY_EXTENSION[extension];

  if (!expected) {
    throw new Error(
      "Unsupported file extension",
    );
  }

  const declared = normalize(
    file.mimetype,
  ).toLowerCase();

  const validDeclaredType =
    declared === expected ||
    declared === "application/octet-stream" ||
    (
      expected === "image/jpeg" &&
      declared === "image/jpg"
    );

  if (!validDeclaredType) {
    throw new Error(
      "File extension and MIME type do not match",
    );
  }

  const detected = detectFileType(file.buffer);

  // HEIC and HEIF can share compatible HEIF brands.
  const heifCompatible =
    ["image/heic", "image/heif"].includes(expected) &&
    ["image/heic", "image/heif"].includes(detected);

  if (
    detected !== expected &&
    !heifCompatible
  ) {
    throw new Error(
      "File content does not match its declared type",
    );
  }

  return expected;
};

/* ========================================================
   UPLOAD CLINICAL FILE
======================================================== */

export const uploadClinicalFileToS3 = async ({
  buffer,
  fileName,
  mimeType,
  patientId,
  categoryFolder = "general",
}) => {
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new Error("Invalid file buffer");
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      "File exceeds the 10 MB limit",
    );
  }

  const safePatientId = safeSegment(patientId);
  const safeCategory = safeSegment(categoryFolder);

  if (!safePatientId) {
    throw new Error(
      "Patient ID is required",
    );
  }

  const name = safeFileName(fileName);

  if (!name || name === "." || name === "..") {
    throw new Error("Invalid filename");
  }

  const extension = path
    .extname(name)
    .toLowerCase();

  const expectedMime = MIME_BY_EXTENSION[extension];

  if (
    !ALLOWED_MIME_TYPES.has(mimeType) ||
    expectedMime !== mimeType
  ) {
    throw new Error(
      "Invalid file extension or MIME type",
    );
  }

  const detectedMime = detectFileType(buffer);

  const heifCompatible =
    ["image/heic", "image/heif"].includes(mimeType) &&
    ["image/heic", "image/heif"].includes(detectedMime);

  if (
    detectedMime !== mimeType &&
    !heifCompatible
  ) {
    throw new Error(
      "File content validation failed",
    );
  }

  const uniqueId = crypto.randomUUID();

  const key = [
    "patients",
    safePatientId,
    safeCategory || "general",
    `${uniqueId}_${name}`,
  ].join("/");

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,

        Metadata: {
          patient_id: safePatientId,
        },
      }),
    );

    return {
      key,
      name,
      mimeType,
      size: buffer.length,
      bucket: BUCKET,
    };
  } catch (error) {
    console.error("S3 upload failed:", {
      name: error.name,
      message: error.message,
    });

    throw error;
  }
};

/* ========================================================
   UPLOAD MULTER FILE
======================================================== */

export const uploadMulterFileToS3 = async ({
  file,
  fileName,
  patientId,
  categoryFolder,
}) => {
  const mimeType = resolveContentType(file);

  return uploadClinicalFileToS3({
    buffer: file.buffer,
    fileName,
    mimeType,
    patientId,
    categoryFolder,
  });
};

/* ========================================================
   GET FILE METADATA
======================================================== */

export const getS3FileMetadata = async (key) => {
  const safeKey = validateObjectKey(key);

  const response = await s3.send(
    new HeadObjectCommand({
      Bucket: BUCKET,
      Key: safeKey,
    }),
  );

  return {
    name: path.basename(safeKey),

    mimeType:
      response.ContentType ||
      "application/octet-stream",

    size: response.ContentLength ?? 0,

    lastModified:
      response.LastModified || null,

    etag: response.ETag || "",
  };
};

/* ========================================================
   GET FILE STREAM
======================================================== */

export const getS3FileStream = async (key) => {
  const safeKey = validateObjectKey(key);

  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: safeKey,
    }),
  );

  if (
    !response.Body ||
    typeof response.Body.pipe !== "function"
  ) {
    throw new Error(
      "S3 did not return a readable Node.js stream",
    );
  }

  return {
    stream: response.Body,

    metadata: {
      name: path.basename(safeKey),

      mimeType:
        response.ContentType ||
        "application/octet-stream",

      size: response.ContentLength ?? 0,

      lastModified:
        response.LastModified || null,
    },
  };
};

/* ========================================================
   DELETE FILE
======================================================== */

export const deleteS3File = async (key) => {
  const safeKey = validateObjectKey(key);

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: safeKey,
    }),
  );

  return true;
};

/* ========================================================
   EXPORT CONFIGURATION
======================================================== */

export const S3_CONFIG = {
  bucket: BUCKET,
  region: REGION,
  maxFileSize: MAX_FILE_SIZE,
};
