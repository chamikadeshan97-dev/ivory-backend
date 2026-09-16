import { authenticate } from "@google-cloud/local-auth";
import fs from "fs/promises";

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
];

async function main() {
  try {
    const auth = await authenticate({
      scopes: SCOPES,
      keyfilePath: "./credentials.json",
    });

    console.log("\n====================================");
    console.log("GOOGLE OAUTH SUCCESS");
    console.log("====================================");

    console.log("\nAccess token:");
    console.log(auth.credentials.access_token);

    console.log("\nRefresh token:");
    console.log(auth.credentials.refresh_token);

    console.log("\n====================================");

    await fs.writeFile(
      "drive-token.json",
      JSON.stringify(auth.credentials, null, 2),
    );

    console.log("\nSaved credentials to:");
    console.log("drive-token.json");
  } catch (error) {
    console.error("OAuth failed:", error);
  }
}

main();