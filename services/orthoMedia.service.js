
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

import {
  getOrthoMediaFolder,
} from "../utils/patientMedia.js";

import {
  writeSheet,
  readSheet,
} from "../utils/googleSheets.js";

/* ========================================================
   CONFIG
======================================================== */

const SHEET_NAME = "Ortho_Media";
const ORTHO_CASES_SHEET = "Ortho_Cases";

const MAX_FILES = 10;

const STORAGE_PROVIDERS = Object.freeze({
  S3: "s3",
  DRIVE: "google_drive",
});

const ENABLE_PERMANENT_DELETE =
  process.env.ENABLE_ORTHO_MEDIA_PERMANENT_DELETE ===
  "true";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

const normalizeLower = (value) =>
  normalize(value).toLowerCase();

const isTrue = (value) =>
  ["true", "1", "yes"].includes(
    normalizeLower(value),
  );

const isDeleted = (record) =>
  isTrue(record?.is_deleted);

const matchesId = (a, b) =>
  normalizeLower(a) === normalizeLower(b);

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

  // Backward compatibility with old Drive records.
  if (normalize(media.drive_file_id)) {
    return STORAGE_PROVIDERS.DRIVE;
  }

  // Compatibility with S3 rows missing provider.
  if (normalize(media.s3_key)) {
    return STORAGE_PROVIDERS.S3;
  }

  throw new Error(
    "Ortho media storage provider could not be determined",
  );
};

/* ========================================================
   LOCAL MUTATION QUEUE

   Serializes changes within this Node.js process.

   Does not protect against multiple Render instances
   or other applications writing to the same sheet.
======================================================== */

let mutationQueue = Promise.resolve();

const withOrthoMediaMutation = (operation) => {
  const result = mutationQueue.then(operation);

  mutationQueue = result.catch(() => {});

  return result;
};

/* ========================================================
   ID GENERATION
======================================================== */

const generateOrthoMediaId = (rows = []) => {
  let maxNumber = 0;

  for (const row of rows) {
    const mediaId = normalize(
      row.ortho_media_id,
    );

    const match = mediaId.match(
      /^ORM_(\d+)$/i,
    );

    if (!match) continue;

    const number = Number(match[1]);

    if (
      Number.isSafeInteger(number) &&
      number > maxNumber
    ) {
      maxNumber = number;
    }
  }

  return `ORM_${String(maxNumber + 1).padStart(
    6,
    "0",
  )}`;
};

/* ========================================================
   FILE NAME HELPERS
======================================================== */

const sanitizeFileName = (value) =>
  normalize(value)
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_");

const getFileExtension = (fileName) => {
  const match = normalize(fileName).match(
    /(\.[^./\\]+)$/,
  );

  return match
    ? match[1].toLowerCase()
    : "";
};

/* ========================================================
   BUILD FILE NAME
======================================================== */

const buildOrthoFileName = ({
  mediaId,
  patientId,
  caseId,
  visitId,
  mediaType,
  category,
  stage,
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
    caseId,
    visitId || null,
    date,
    mediaType,
    category,
    stage,
    mediaId,
  ].filter(Boolean);

  return sanitizeFileName(
    `${parts.join("_")}${extension}`,
  );
};

/* ========================================================
   GET ALL RECORDS
======================================================== */

export const getAllOrthoMediaRecords =
  async ({ forceRefresh = false } = {}) => {
    return (
      (await readSheet(SHEET_NAME, {
        forceRefresh,
      })) || []
    );
  };

/* ========================================================
   GET ACTIVE RECORDS
======================================================== */

export const getActiveOrthoMediaRecords =
  async () => {
    const rows =
      await getAllOrthoMediaRecords();

    return rows.filter(
      (row) => !isDeleted(row),
    );
  };

/* ========================================================
   GET ORTHO CASE
======================================================== */

const getOrthoCase = async (caseId) => {
  const rows =
    (await readSheet(ORTHO_CASES_SHEET)) || [];

  return (
    rows.find((row) =>
      matchesId(
        row.ortho_case_id,
        caseId,
      )
    ) || null
  );
};

/* ========================================================
   GET MEDIA BY ID

   Preserves existing export used by controller.
======================================================== */

export const getOrthoMediaByIdService =
  async (mediaId) => {
    if (!normalize(mediaId)) {
      return null;
    }

    const rows =
      await getAllOrthoMediaRecords();

    return (
      rows.find((row) =>
        matchesId(
          row.ortho_media_id,
          mediaId,
        )
      ) || null
    );
  };

/* ========================================================
   GET ACTIVE MEDIA BY ID
======================================================== */

export const getOrthoMediaById =
  async (mediaId) => {
    const media =
      await getOrthoMediaByIdService(
        mediaId,
      );

    if (!media || isDeleted(media)) {
      return null;
    }

    return media;
  };

/* ========================================================
   GET MEDIA BY CASE
======================================================== */

export const getOrthoMediaByCaseService =
  async (caseId, filters = {}) => {
    const rows =
      await getActiveOrthoMediaRecords();

    let result = rows.filter((row) =>
      matchesId(
        row.ortho_case_id,
        caseId,
      )
    );

    if (normalize(filters.media_type)) {
      result = result.filter((row) =>
        matchesId(
          row.media_type,
          filters.media_type,
        )
      );
    }

    if (normalize(filters.stage)) {
      result = result.filter((row) =>
        matchesId(
          row.stage,
          filters.stage,
        )
      );
    }

    if (normalize(filters.visit_id)) {
      result = result.filter((row) =>
        matchesId(
          row.ortho_visit_id,
          filters.visit_id,
        )
      );
    }

    return result.sort((a, b) => {
      const dateA =
        new Date(a.uploaded_at || 0).getTime() || 0;

      const dateB =
        new Date(b.uploaded_at || 0).getTime() || 0;

      return dateB - dateA;
    });
  };

/* ========================================================
   GET MEDIA BY PATIENT
======================================================== */

export const getOrthoMediaByPatientIdService =
  async (patientId) => {
    const rows =
      await getActiveOrthoMediaRecords();

    return rows
      .filter((row) =>
        matchesId(
          row.patient_id,
          patientId,
        )
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
   GET MEDIA BY VISIT
======================================================== */

export const getOrthoMediaByVisitService =
  async (visitId) => {
    const rows =
      await getActiveOrthoMediaRecords();

    return rows.filter((row) =>
      matchesId(
        row.ortho_visit_id,
        visitId,
      )
    );
  };

/* ========================================================
   CREATE / UPLOAD ORTHO MEDIA

   NEW FILES -> AMAZON S3
   METADATA  -> GOOGLE SHEETS
======================================================== */

export const createOrthoMediaService =
  async ({
    files,
    caseId,
    visitId = "",
    mediaDate = "",
    mediaType,
    category = "",
    stage = "",
    description = "",
    uploadedBy = "",
  }) => {
    return withOrthoMediaMutation(async () => {
      /* --------------------------------------------------
         VALIDATION
      -------------------------------------------------- */

      if (
        !Array.isArray(files) ||
        files.length === 0
      ) {
        throw new Error(
          "At least one file is required",
        );
      }

      if (files.length > MAX_FILES) {
        throw new Error(
          "Maximum 10 files are allowed",
        );
      }

      if (!normalize(caseId)) {
        throw new Error(
          "Ortho case ID is required",
        );
      }

      if (!normalize(mediaType)) {
        throw new Error(
          "Media type is required",
        );
      }

      for (const file of files) {
        if (
          !file ||
          !Buffer.isBuffer(file.buffer) ||
          file.buffer.length === 0
        ) {
          throw new Error(
            "Invalid file buffer. Multer must use memoryStorage().",
          );
        }
      }

      /* --------------------------------------------------
         GET CASE
      -------------------------------------------------- */

      const orthoCase =
        await getOrthoCase(caseId);

      if (!orthoCase) {
        throw new Error(
          "Ortho case not found",
        );
      }

      const patientId =
        normalize(orthoCase.patient_id);

      if (!patientId) {
        throw new Error(
          "Patient ID is missing from Ortho case",
        );
      }

      /*
       * Validate the visit-to-case relationship before
       * recording an ortho_visit_id if supplied.
       *
       * This must be enforced using your existing
       * Ortho_Visits lookup/authorization logic.
       */

      /* --------------------------------------------------
         GET FRESH ROWS
      -------------------------------------------------- */

      const rows =
        await getAllOrthoMediaRecords({
          forceRefresh: true,
        });

      const nextRows = [...rows];
      const newRecords = [];
      const uploadedKeys = [];

      let sheetWriteStarted = false;

      try {
        /* =================================================
           FILE LOOP
        ================================================= */

        for (const file of files) {
          const mediaId =
            generateOrthoMediaId(nextRows);

          const fileName =
            buildOrthoFileName({
              mediaId,
              patientId,
              caseId,
              visitId,
              mediaType,
              category,
              stage,
              originalName: file.originalname,
            });

          /*
           * Reuse existing category helper.
           */
          const categoryFolder =
            getOrthoMediaFolder(mediaType);

          /* -----------------------------------------------
             AWS S3 UPLOAD
          ----------------------------------------------- */

          const uploaded =
            await uploadMulterFileToS3({
              file,
              fileName,
              patientId,
              categoryFolder:
                `ortho_${categoryFolder || "general"}`,
            });

          uploadedKeys.push(uploaded.key);

          /* -----------------------------------------------
             GOOGLE SHEET RECORD
          ----------------------------------------------- */

          const record = {
            ortho_media_id: mediaId,

            ortho_case_id:
              normalize(caseId),

            patient_id:
              patientId,

            ortho_visit_id:
              normalize(visitId),

            media_date:
              normalize(mediaDate) ||
              new Date()
                .toISOString()
                .slice(0, 10),

            media_type:
              normalize(mediaType),

            category:
              normalize(category),

            stage:
              normalize(stage),

            description:
              normalize(description),

            // Legacy Google Drive fields
            drive_file_id: "",
            drive_folder_id: "",

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

            // New AWS S3 fields
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

        /* --------------------------------------------------
           SAVE ALL METADATA
        -------------------------------------------------- */

        sheetWriteStarted = true;

        await writeSheet(
          SHEET_NAME,
          nextRows,
        );

        return newRecords;
      } catch (error) {
        console.error(
          "Ortho media upload failed:",
          error.name,
          error.message,
        );

        /*
         * Before a Sheet write starts, successful uploads
         * from this request can be cleaned up.
         *
         * After writing starts, the result may be
         * uncertain. Retain uploaded objects and
         * reconcile them with the sheet.
         */
        if (!sheetWriteStarted) {
          for (const key of uploadedKeys) {
            try {
              await deleteS3File(key);
            } catch (cleanupError) {
              console.error(
                "Failed to clean orphan S3 object:",
                cleanupError.message,
              );
            }
          }
        } else {
          console.error(
            "Ortho media Sheet/S3 reconciliation required.",
            {
              mediaIds: newRecords.map(
                (record) => record.ortho_media_id,
              ),
              objectCount: uploadedKeys.length,
            },
          );
        }

        throw error;
      }
    });
  };

/* ========================================================
   GET FILE STREAM

   AWS S3 + LEGACY GOOGLE DRIVE
======================================================== */

export const getOrthoMediaFileStream =
  async (mediaId) => {
    const media =
      await getOrthoMediaByIdService(mediaId);

    if (!media || isDeleted(media)) {
      return null;
    }

    const provider =
      getStorageProvider(media);

    /* ---------------- AWS S3 ---------------- */

    if (provider === STORAGE_PROVIDERS.S3) {
      const key = normalize(media.s3_key);

      if (!key) {
        throw new Error(
          "Ortho media S3 object key is missing",
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

    const driveFileId =
      normalize(media.drive_file_id);

    if (!driveFileId) {
      throw new Error(
        "Ortho media Drive file ID is missing",
      );
    }

    const metadata =
      await getDriveFileMetadata(driveFileId);

    const stream =
      await getDriveFileStream(driveFileId);

    return {
      media,
      metadata,
      stream,
    };
  };

/* ========================================================
   SOFT DELETE

   Metadata only.
   Files remain in their storage provider.
======================================================== */

export const deleteOrthoMediaService =
  async (mediaId) => {
    return withOrthoMediaMutation(async () => {
      const rows =
        await getAllOrthoMediaRecords({
          forceRefresh: true,
        });

      const index = rows.findIndex((row) =>
        matchesId(
          row.ortho_media_id,
          mediaId,
        )
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
   DELETE PHYSICAL FILE
======================================================== */




/* ========================================================
   PERMANENT DELETE

   Disabled by default.

   Requires administrative authorization,
   retention checks and audit logging.
======================================================== */

export const permanentlyDeleteOrthoMediaService =
  async (mediaId) => {
    if (!ENABLE_PERMANENT_DELETE) {
      const error = new Error(
        "Permanent Ortho media deletion is disabled",
      );

      error.status = 403;

      throw error;
    }

    return withOrthoMediaMutation(async () => {
      const rows =
        await getAllOrthoMediaRecords({
          forceRefresh: true,
        });

      const index = rows.findIndex((row) =>
        matchesId(
          row.ortho_media_id,
          mediaId,
        )
      );

      if (index === -1) {
        return null;
      }

      let media = rows[index];

      /*
       * Mark the record as deleted first.
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
       * Delete the current stored object.
       * S3 versioned objects may retain old versions.
       */
     
      

      /*
       * Remove metadata after storage operation.
       */
      const remainingRows = rows.filter(
        (row) =>
          !matchesId(
            row.ortho_media_id,
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

  /* ========================================================
   PERMANENTLY DELETE ALL ORTHO MEDIA BY CASE
======================================================== */

export const deleteAllOrthoMediaByCaseService = async (caseId) => {
  /* ----------------------------------------------------
     VALIDATE
  ---------------------------------------------------- */

  const normalizedCaseId = normalize(caseId);

  if (!normalizedCaseId) {
    throw new Error("Ortho case ID is required");
  }

  if (!ENABLE_PERMANENT_DELETE) {
    const error = new Error(
      "Permanent Ortho media deletion is disabled"
    );

    error.status = 403;

    throw error;
  }

  /* ----------------------------------------------------
     GET ALL MEDIA INCLUDING SOFT-DELETED
  ---------------------------------------------------- */

  const allMedia = await getAllOrthoMediaRecords({
    forceRefresh: true,
  });

  const relatedMedia = allMedia.filter((row) =>
    matchesId(row.ortho_case_id, normalizedCaseId)
  );

  /* ----------------------------------------------------
     DELETE EACH FILE AND ITS METADATA
  ---------------------------------------------------- */

  const deletedMediaIds = [];

  for (const media of relatedMedia) {
    try {
      const deleted = await permanentlyDeleteOrthoMediaService(
        media.ortho_media_id
      );

      if (deleted) {
        deletedMediaIds.push(media.ortho_media_id);
      }
    } catch (error) {
      console.error("Failed to delete Ortho media:", {
        caseId: normalizedCaseId,
        mediaId: media.ortho_media_id,
        error: error.message,
      });

      // Stop immediately. Preserve remaining records
      // so the deletion can be investigated or retried.
      error.status = error.status || 500;
      error.deleted_media_ids = deletedMediaIds;

      throw error;
    }
  }

  /* ----------------------------------------------------
     RESULT
  ---------------------------------------------------- */

  return {
    case_id: caseId,

    deleted_count: deletedMediaIds.length,

    deleted_media_ids: deletedMediaIds,
  };
};