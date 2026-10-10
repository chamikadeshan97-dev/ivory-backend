
import crypto from "node:crypto";
import sharp from "sharp";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

/* =========================================================
   CONFIG
========================================================= */

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "ap-southeast-2";

const BUCKET =
  process.env.AWS_S3_BUCKET ||
  process.env.S3_BUCKET_NAME;

if (!BUCKET) {
  throw new Error("AWS S3 bucket is not configured");
}

const s3 = new S3Client({
  region: REGION,
});

const POSTER_PREFIX = "idle-display/posters/";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const URL_EXPIRATION = 15 * 60;

/* =========================================================
   VALIDATION
========================================================= */

const validateImage = async (file) => {
  if (!file?.buffer) {
    throw new Error("Image is required");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be smaller than 10MB");
  }

  const metadata = await sharp(file.buffer, {
    limitInputPixels: 30_000_000,
  }).metadata();

  if (
    !["jpeg", "png", "webp"].includes(metadata.format)
  ) {
    throw new Error("Unsupported image format");
  }

  return metadata;
};

/* =========================================================
   UPLOAD POSTER
========================================================= */

export const uploadIdlePoster = async (
  slideId,
  file,
) => {
  if (!/^IDL_\d{6,}$/.test(slideId)) {
    throw new Error("Invalid slide ID");
  }

  await validateImage(file);

  // Normalize to WebP to reduce display bandwidth.
  // Animated images are not supported.
  const imageBuffer = await sharp(file.buffer, {
    limitInputPixels: 30_000_000,
    animated: false,
  })
    .rotate()
    .webp({ quality: 88 })
    .toBuffer();

  const uniqueId = crypto.randomUUID();

  const key =
    `${POSTER_PREFIX}${slideId}/${uniqueId}.webp`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: imageBuffer,
      ContentType: "image/webp",
      CacheControl:
        "private, max-age=3600",
    }),
  );

  return {
    key,
    size: imageBuffer.length,
    contentType: "image/webp",
  };
};

/* =========================================================
   GET SIGNED IMAGE URL
========================================================= */

export const getIdlePosterUrl = async (imageKey) => {
  if (
    !imageKey ||
    !imageKey.startsWith(POSTER_PREFIX)
  ) {
    return null;
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: imageKey,
    }),
    {
      expiresIn: URL_EXPIRATION,
    },
  );
};

/* =========================================================
   DELETE POSTER
========================================================= */

export const deleteIdlePoster = async (imageKey) => {
  if (
    !imageKey ||
    !imageKey.startsWith(POSTER_PREFIX)
  ) {
    throw new Error("Invalid poster key");
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: imageKey,
    }),
  );

  return true;
};
