
import "dotenv/config";

import {
  S3Client,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION;
const BUCKET = process.env.AWS_S3_BUCKET;

const s3 = new S3Client({
  region: REGION,
});

const testConnection = async () => {
  try {
    console.log("================================");
    console.log("AWS S3 CONNECTION TEST");
    console.log("================================");

    console.log("Region:", REGION);
    console.log("Bucket:", BUCKET);

    await s3.send(
      new HeadBucketCommand({
        Bucket: BUCKET,
      }),
    );

    console.log("✅ AWS S3 connection successful!");
    console.log("✅ Bucket is accessible!");
    console.log("================================");
  } catch (error) {
    console.error("❌ AWS S3 connection failed");

    console.error("Error:", error.name);
    console.error("Message:", error.message);
    console.error("HTTP status:", error.$metadata?.httpStatusCode);
  }
};

testConnection();
