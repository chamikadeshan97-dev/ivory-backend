
import {
  deleteDriveFile,
  getDriveFileMetadata,
  getDriveFileStream,
} from "./googleDriveService.js";

import {
  uploadMulterFileToS3,
  getS3FileStream,
  deleteS3File,
} from "./s3Service.js";

import { getMediaFolder } from "../utils/patientMedia.js";

import {
  writeSheet,
  readSheet,
} from "../utils/googleSheets.js";

/* ========================================================
   CONFIG
======================================================== */

const SHEET_NAME = "Patient_Media";

const STORAGE_PROVIDERS = Object.freeze({
  S3: "s3",
  DRIVE: "google_drive",
});

/*
 * Physical deletion is disabled until explicitly enabled.
 * Clinical records may have legal retention requirements.
 */
const ENABLE_PERMANENT_DELETE =
  process.env.ENABLE_PATIENT_MEDIA_PERMANENT_DELETE ===
  "true";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

const normalizeLower = (value) =>
  normalize(value).toLowerCase();

const isTrue = (value) => {
  const normalized = normalizeLower(value);

  return [
    "true",
    "1",
    "yes",
  ].includes(normalized);
};

const isDeleted = (media) =>
  isTrue(media?.is_deleted);

const matchesId = (left, right) =>
  normalizeLower(left) === normalizeLower(right);

const getStorageProvider = (media) => {
  const provider = normalizeLower(
    media.storage_provider,
  );

  if (provider === STORAGE_PROVIDERS.S3) {
    return STORAGE_PROVIDERS.S3;
  }

  if (provider === STORAGE_PROVIDERS.DRIVE) {
    return STORAGE_PROVIDERS.DRIVE;
  }

  /*
   * Support legacy Google Drive records.
   */
  if (normalize(media.drive_file_id)) {
    return STORAGE_PROVIDERS.DRIVE;
  }

  /*
   * Support S3 records where provider is empty.
   */
  if (normalize(media.s3_key)) {
    return STORAGE_PROVIDERS.S3;
  }

  throw new Error(
    "Media storage provider could not be determined",
  );
};

/* ========================================================
   SERIALIZE LOCAL MEDIA MUTATIONS

   Prevent overlapping read-modify-write operations
   within this Node.js process.

   IMPORTANT:
   This does not coordinate multiple Render instances,
   other backend services, or direct Sheet editors.
======================================================== */

let mutationQueue = Promise.resolve();

const withMediaMutation = (operation) => {
  const result = mutationQueue.then(operation);

  mutationQueue = result.catch(() => {
    // Keep the queue operational after a failure.
  });

  return result;
};

/* ========================================================
   MEDIA ID
======================================================== */

const generateMediaId = (rows = []) => {
  let maxNumber = 0;

  for (const row of rows) {
    const mediaId = normalize(row.media_id);

    const match = mediaId.match(/^MED_(\d+)$/i);

    if (!match) continue;

    const number = Number(match[1]);

    if (
      Number.isSafeInteger(number) &&
      number > maxNumber
    ) {
      maxNumber = number;
    }
  }

  return `MED_${String(maxNumber + 1).padStart(
    6,
    "0",
  )}`;
};

/* ========================================================
   FILE NAME
======================================================== */

const sanitizeFileName = (value) =>
  normalize(value)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");

const getFileExtension = (fileName) => {
  const match = normalize(fileName).match(
    /(\.[^./\\]+)$/,
  );

  return match ? match[1].toLowerCase() : "";
};

const buildClinicalFileName = ({
  mediaId,
  patientId,
  mediaType,
  category,
  toothNumber,
  originalName,
}) => {
  const extension =
    getFileExtension(originalName);

  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  const parts = [
    patientId,
    date,
    mediaType,
    category,
    toothNumber
      ? `TOOTH_${toothNumber}`
      : null,
    mediaId,
  ].filter(Boolean);

  return sanitizeFileName(
    `${parts.join("_")}${extension}`,
  );
};

/* ========================================================
   READ ALL MEDIA

   forceRefresh should be used before mutations.
======================================================== */

export const getAllPatientMediaRecords =
  async ({ forceRefresh = false } = {}) => {
    return (
      (await readSheet(SHEET_NAME, {
        forceRefresh,
      })) || []
    );
  };

/* ========================================================
   GET ACTIVE MEDIA
======================================================== */

export const getActivePatientMediaRecords =
  async () => {
    const rows =
      await getAllPatientMediaRecords();

    return rows.filter(
      (row) => !isDeleted(row),
    );
  };

/* ========================================================
   GET BY ID
======================================================== */

export const getPatientMediaById =
  async (mediaId) => {
    if (!normalize(mediaId)) {
      return null;
    }

    const rows =
      await getAllPatientMediaRecords();

    return (
      rows.find((row) =>
        matchesId(row.media_id, mediaId)
      ) || null
    );
  };

/* ========================================================
   GET BY PATIENT
======================================================== */

export const getPatientMediaByPatientId =
  async (patientId) => {
    const rows =
      await getActivePatientMediaRecords();

    return rows
      .filter((row) =>
        matchesId(row.patient_id, patientId)
      )
      .sort((a, b) => {
        const dateA =
          new Date(a.uploaded_at || 0).getTime() || 0;

        const dateB =
          new Date(b.uploaded_at || 0).getTime() || 0;

        return dateB - dateA;
      });
  };

/* ========================================================
   GET BY APPOINTMENT
======================================================== */

export const getPatientMediaByAppointmentId =
  async (appointmentId) => {
    const rows =
      await getActivePatientMediaRecords();

    return rows.filter((row) =>
      matchesId(
        row.appointment_id,
        appointmentId,
      )
    );
  };

/* ========================================================
   GET BY TREATMENT
======================================================== */

export const getPatientMediaByTreatmentId =
  async (treatmentId) => {
    const rows =
      await getActivePatientMediaRecords();

    return rows.filter((row) =>
      matchesId(
        row.treatment_id,
        treatmentId,
      )
    );
  };

/* ========================================================
   CREATE PATIENT MEDIA RECORDS

   New uploads -> Amazon S3
   Metadata    -> Google Sheets
======================================================== */

export const createPatientMediaRecords =
  async ({
    files,
    patientId,
    appointmentId = "",
    treatmentId = "",
    mediaType,
    category = "",
    toothNumber = "",
    description = "",
    uploadedBy = "",
  }) => {
    return withMediaMutation(async () => {
      if (
        !Array.isArray(files) ||
        files.length === 0 ||
        files.length > 10
      ) {
        throw new Error(
          "Between 1 and 10 files are required",
        );
      }

      if (!normalize(patientId)) {
        throw new Error(
          "Patient ID is required",
        );
      }

      if (!normalize(mediaType)) {
        throw new Error(
          "Media type is required",
        );
      }

      /*
       * Always fetch fresh rows before generating IDs.
       */
      const rows =
        await getAllPatientMediaRecords({
          forceRefresh: true,
        });

      const nextRows = [...rows];
      const newRecords = [];
      const uploadedKeys = [];

      let sheetWriteStarted = false;

      try {
        for (const file of files) {
          const mediaId =
            generateMediaId(nextRows);

          const fileName =
            buildClinicalFileName({
              mediaId,
              patientId,
              mediaType,
              category,
              toothNumber,
              originalName: file.originalname,
            });

          const categoryFolder =
            getMediaFolder(mediaType);

          const uploaded =
            await uploadMulterFileToS3({
              file,
              fileName,
              patientId,
              categoryFolder,
            });

          uploadedKeys.push(uploaded.key);

          const record = {
            media_id: mediaId,

            patient_id:
              normalize(patientId),

            appointment_id:
              normalize(appointmentId),

            treatment_id:
              normalize(treatmentId),

            media_type:
              normalize(mediaType),

            category:
              normalize(category),

            tooth_number:
              normalize(toothNumber),

            description:
              normalize(description),

            // Legacy Google Drive fields
            drive_file_id: "",
            drive_folder_id: "",

            // File metadata
            file_name:
              normalize(uploaded.name),

            mime_type:
              normalize(uploaded.mimeType),

            file_size:
              normalize(uploaded.size),

            uploaded_by:
              normalize(uploadedBy),

            uploaded_at:
              new Date().toISOString(),

            is_deleted: "FALSE",

            // Amazon S3 fields
            storage_provider:
              STORAGE_PROVIDERS.S3,

            s3_bucket:
              normalize(uploaded.bucket),

            s3_key:
              normalize(uploaded.key),

            deleted_at: "",
          };

          nextRows.push(record);
          newRecords.push(record);
        }

        /*
         * Write metadata after all uploads succeed.
         */
        sheetWriteStarted = true;

        await writeSheet(
          SHEET_NAME,
          nextRows,
        );

        return newRecords;
      } catch (error) {
        console.error(
          "Patient media upload failed:",
          error,
        );

        /*
         * Cleanup only if writing to Sheets
         * has not started.
         *
         * Once a sheet write starts, its result
         * may be uncertain, even if it throws.
         */
        if (!sheetWriteStarted) {
          for (const key of uploadedKeys) {
            try {
              await deleteS3File(key);
            } catch (cleanupError) {
              console.error(
                "Failed to clean S3 object:",
                key,
                cleanupError,
              );
            }
          }
        } else {
          console.error(
            "Media upload reconciliation required. " +
            "Inspect Google Sheets and S3 for:",
            uploadedKeys,
          );
        }

        throw error;
      }
    });
  };

/* ========================================================
   GET FILE STREAM

   New files    -> AWS S3
   Legacy files -> Google Drive
======================================================== */

export const getPatientMediaFileStream =
  async (mediaId) => {
    if (!normalize(mediaId)) {
      return null;
    }

    const media =
      await getPatientMediaById(mediaId);

    if (!media || isDeleted(media)) {
      return null;
    }

    const provider =
      getStorageProvider(media);

    /* ---------------- AWS S3 ---------------- */

    if (provider === STORAGE_PROVIDERS.S3) {
      const key =
        normalize(media.s3_key);

      if (!key) {
        throw new Error(
          "S3 object key is missing",
        );
      }

      const result =
        await getS3FileStream(key);

      return {
        media,

        metadata: {
          ...result.metadata,

          name:
            media.file_name ||
            result.metadata.name,
        },

        stream: result.stream,
      };
    }

    /* ---------------- GOOGLE DRIVE ---------------- */

    const fileId =
      normalize(media.drive_file_id);

    if (!fileId) {
      throw new Error(
        "Google Drive file ID is missing",
      );
    }

    const metadata =
      await getDriveFileMetadata(fileId);

    const stream =
      await getDriveFileStream(fileId);

    return {
      media,
      metadata,
      stream,
    };
  };

/* ========================================================
   SOFT DELETE

   Only update metadata.
   The physical file remains in storage.
======================================================== */

export const softDeletePatientMedia =
  async (mediaId) => {
    return withMediaMutation(async () => {
      if (!normalize(mediaId)) {
        return null;
      }

      const rows =
        await getAllPatientMediaRecords({
          forceRefresh: true,
        });

      const index = rows.findIndex(
        (row) =>
          matchesId(row.media_id, mediaId),
      );

      if (index === -1) {
        return null;
      }

      if (isDeleted(rows[index])) {
        return rows[index];
      }

      rows[index] = {
        ...rows[index],

        is_deleted: "TRUE",

        deleted_at:
          new Date().toISOString(),
      };

      await writeSheet(
        SHEET_NAME,
        rows,
      );

      return rows[index];
    });
  };

/* ========================================================
   PHYSICAL DELETE HELPER

   Called only after a record has been
   marked as deleted in Google Sheets.
======================================================== */

const deleteStoredMediaFile = async (media) => {
  const provider =
    getStorageProvider(media);

  if (provider === STORAGE_PROVIDERS.S3) {
    const key =
      normalize(media.s3_key);

    if (!key) {
      throw new Error(
        "Cannot delete media: S3 key missing",
      );
    }

    await deleteS3File(key);

    return;
  }

  const driveFileId =
    normalize(media.drive_file_id);

  if (!driveFileId) {
    throw new Error(
      "Cannot delete media: Drive file ID missing",
    );
  }

  await deleteDriveFile(driveFileId);
};

/* ========================================================
   PERMANENT DELETE

   1. Mark record soft-deleted
   2. Remove current stored object
   3. Remove metadata row

   If storage deletion fails, the soft-deleted
   record remains for reconciliation.

   WARNING:
   S3 versioned objects can retain older versions.
======================================================== */

export const permanentlyDeletePatientMedia =
  async (mediaId) => {
    if (!ENABLE_PERMANENT_DELETE) {
      const error = new Error(
        "Permanent media deletion is disabled",
      );

      error.status = 403;

      throw error;
    }

    return withMediaMutation(async () => {
      if (!normalize(mediaId)) {
        return null;
      }

      const rows =
        await getAllPatientMediaRecords({
          forceRefresh: true,
        });

      const index = rows.findIndex(
        (row) =>
          matchesId(row.media_id, mediaId),
      );

      if (index === -1) {
        return null;
      }

      let media = rows[index];

      /*
       * First make the record inactive.
       */
      if (!isDeleted(media)) {
        media = {
          ...media,

          is_deleted: "TRUE",

          deleted_at:
            new Date().toISOString(),
        };

        rows[index] = media;

        await writeSheet(
          SHEET_NAME,
          rows,
        );
      }

      /*
       * Remove the current stored object.
       *
       * With S3 versioning, older versions
       * may still exist.
       */
      await deleteStoredMediaFile(media);

      /*
       * Remove the metadata row only after
       * the storage operation succeeds.
       */
      const remainingRows =
        rows.filter(
          (row) =>
            !matchesId(
              row.media_id,
              mediaId,
            ),
        );

      await writeSheet(
        SHEET_NAME,
        remainingRows,
      );

      return media;
    });
  };
