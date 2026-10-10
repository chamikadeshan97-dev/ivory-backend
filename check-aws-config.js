
import "dotenv/config";

const accessKey =
  process.env.AWS_ACCESS_KEY_ID || "";

const secretKey =
  process.env.AWS_SECRET_ACCESS_KEY || "";

console.log("AWS Configuration Check");

console.log({
  region: process.env.AWS_REGION,
  bucket: process.env.AWS_S3_BUCKET,

  accessKeyConfigured: accessKey.length > 0,
  secretKeyConfigured: secretKey.length > 0,

  accessKeyLength: accessKey.length,
  secretKeyLength: secretKey.length,

  accessKeyPlaceholder:
    accessKey.includes("YOUR_"),

  secretKeyPlaceholder:
    secretKey.includes("YOUR_"),

  hasWhitespace:
    accessKey !== accessKey.trim() ||
    secretKey !== secretKey.trim(),
});
