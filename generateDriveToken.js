import { authenticate } from "@google-cloud/local-auth";
import fs from "fs/promises";

const SCOPES = ["https://www.googleapis.com/auth/drive"];

async function main() {
  try {
    console.log("Starting Google Drive authorization...");

    const auth = await authenticate({
      scopes: SCOPES,
      keyfilePath: "./credentials.json",
    });

    if (!auth.credentials.refresh_token) {
      console.warn(
        "WARNING: Google did not return a refresh token."
      );
    }

    await fs.writeFile(
      "./drive-token.json",
      JSON.stringify(auth.credentials, null, 2)
    );

    console.log("\nGoogle Drive authorization successful.");
    console.log("Credentials saved to:");
    console.log("drive-token.json");
  } catch (error) {
    console.error("OAuth failed:", error);
  }
}

main();