import { google } from "googleapis";
import { Readable } from "stream";

/* ========================================================
   CONFIG
======================================================== */

const ROOT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_CLINICAL_ROOT_FOLDER_ID;

if (!ROOT_FOLDER_ID) {
  console.warn(
    "GOOGLE_DRIVE_CLINICAL_ROOT_FOLDER_ID is not configured",
  );
}

/* ========================================================
   AUTH - OAUTH USER ACCOUNT
======================================================== */

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
);

oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

/*
 * Use the same OAuth Drive client everywhere.
 *
 * This means Google Drive operations are performed as the
 * Google account that authorized the refresh token.
 */
const drive = google.drive({
  version: "v3",
  auth: oauth2Client,
});

console.log("====================================");
console.log("GOOGLE DRIVE AUTH");
console.log("Mode: OAuth user account");
console.log(
  "Refresh token configured:",
  Boolean(process.env.GOOGLE_REFRESH_TOKEN),
);
console.log(
  "Clinical root folder:",
  ROOT_FOLDER_ID,
);
console.log("====================================");

/* ========================================================
   HELPERS
======================================================== */

const escapeDriveQueryValue = (value) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");

const bufferToStream = (buffer) => {
  return Readable.from(buffer);
};

/* ========================================================
   FIND FOLDER
======================================================== */

const findFolder = async ({
  folderName,
  parentFolderId,
}) => {
  const safeName = escapeDriveQueryValue(folderName);

  const response = await drive.files.list({
    q: [
      `name = '${safeName}'`,
      `mimeType = 'application/vnd.google-apps.folder'`,
      `'${parentFolderId}' in parents`,
      "trashed = false",
    ].join(" and "),

    fields: "files(id,name)",

    supportsAllDrives: true,

    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0] || null;
};

/* ========================================================
   CREATE FOLDER
======================================================== */

const createFolder = async ({
  folderName,
  parentFolderId,
}) => {
  const response = await drive.files.create({
    requestBody: {
      name: folderName,

      mimeType:
        "application/vnd.google-apps.folder",

      parents: [parentFolderId],
    },

    fields: "id,name",

    supportsAllDrives: true,
  });

  return response.data;
};

/* ========================================================
   GET OR CREATE FOLDER
======================================================== */

export const getOrCreateFolder = async ({
  folderName,
  parentFolderId,
}) => {
  const existingFolder = await findFolder({
    folderName,
    parentFolderId,
  });

  if (existingFolder) {
    return existingFolder;
  }

  return await createFolder({
    folderName,
    parentFolderId,
  });
};

/* ========================================================
   PATIENT FOLDER
======================================================== */

export const getPatientFolder = async (
  patientId,
) => {
  if (!ROOT_FOLDER_ID) {
    throw new Error(
      "Google Drive clinical root folder is not configured",
    );
  }

  return await getOrCreateFolder({
    folderName: patientId,
    parentFolderId: ROOT_FOLDER_ID,
  });
};

/* ========================================================
   CATEGORY FOLDER
======================================================== */

export const getPatientCategoryFolder = async ({
  patientId,
  categoryFolder,
}) => {
  const patientFolder =
    await getPatientFolder(patientId);

  return await getOrCreateFolder({
    folderName: categoryFolder,
    parentFolderId: patientFolder.id,
  });
};

/* ========================================================
   UPLOAD FILE
======================================================== */

export const uploadClinicalFile = async ({
  buffer,
  fileName,
  mimeType,
  patientId,
  categoryFolder,
}) => {
  const folder =
    await getPatientCategoryFolder({
      patientId,
      categoryFolder,
    });

  const response = await drive.files.create({
    requestBody: {
      name: fileName,

      parents: [folder.id],
    },

    media: {
      mimeType,

      body: bufferToStream(buffer),
    },

    fields: [
      "id",
      "name",
      "mimeType",
      "size",
      "createdTime",
    ].join(","),

    supportsAllDrives: true,
  });

  return {
    ...response.data,

    folderId: folder.id,
  };
};

/* ========================================================
   GET FILE METADATA
======================================================== */

export const getDriveFileMetadata = async (
  fileId,
) => {
  const response = await drive.files.get({
    fileId,

    fields: [
      "id",
      "name",
      "mimeType",
      "size",
      "createdTime",
    ].join(","),

    supportsAllDrives: true,
  });

  return response.data;
};

/* ========================================================
   DOWNLOAD / STREAM FILE
======================================================== */

export const getDriveFileStream = async (
  fileId,
) => {
  const response = await drive.files.get(
    {
      fileId,

      alt: "media",

      supportsAllDrives: true,
    },
    {
      responseType: "stream",
    },
  );

  return response.data;
};

/* ========================================================
   DELETE FILE
======================================================== */

export const deleteDriveFile = async (
  fileId,
) => {
  await drive.files.delete({
    fileId,

    supportsAllDrives: true,
  });

  return true;
};

/* ========================================================
   OPTIONAL TEST - ROOT FOLDER ACCESS
======================================================== */

export const testDriveAccess = async () => {
  if (!ROOT_FOLDER_ID) {
    throw new Error(
      "Google Drive clinical root folder is not configured",
    );
  }

  try {
    const response = await drive.files.get({
      fileId: ROOT_FOLDER_ID,

      fields: "id,name,mimeType",

      supportsAllDrives: true,
    });

    console.log("✅ GOOGLE DRIVE OAUTH ACCESS OK");
    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error(
      "❌ GOOGLE DRIVE OAUTH ACCESS FAILED:",
      error?.response?.data ||
        error?.message ||
        error,
    );

    throw error;
  }
};