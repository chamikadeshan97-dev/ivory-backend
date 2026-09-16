import {
  deleteDriveFile,
  getDriveFileMetadata,
  getDriveFileStream,
  uploadClinicalFile,
} from "./googleDriveService.js";

import { getMediaFolder } from "../utils/patientMedia.js";
import { writeSheet , readSheet } from "../utils/googleSheets.js";




/* ========================================================
   CONFIG
======================================================== */

const SHEET_NAME = "Patient_Media";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "")
    .trim();

const normalizeLower = (value) =>
  normalize(value).toLowerCase();

const isTrue = (value) => {
  const normalized = normalizeLower(value);

  return (
    normalized === "true" ||
    normalized === "1" ||
    normalized === "yes"
  );
};

/* ========================================================
   MEDIA ID
======================================================== */

const generateMediaId = (rows = []) => {
  let maxNumber = 0;

  rows.forEach((row) => {
    const mediaId = normalize(row.media_id);

    const match = mediaId.match(/^MED_(\d+)$/i);

    if (!match) {
      return;
    }

    const number = Number(match[1]);

    if (
      Number.isFinite(number) &&
      number > maxNumber
    ) {
      maxNumber = number;
    }
  });

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
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_");

const getFileExtension = (fileName) => {
  const match = normalize(fileName).match(
    /(\.[^./\\]+)$/,
  );

  return match ? match[1] : "";
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
   GET ALL ROWS
======================================================== */

export const getAllPatientMediaRecords =
  async () => {
    const rows =
      (await readSheet(SHEET_NAME)) || [];

    return rows;
  };

/* ========================================================
   GET ACTIVE ROWS
======================================================== */

export const getActivePatientMediaRecords =
  async () => {
    const rows =
      await getAllPatientMediaRecords();

    return rows.filter(
      (row) => !isTrue(row.is_deleted),
    );
  };

/* ========================================================
   GET BY ID
======================================================== */

export const getPatientMediaById =
  async (mediaId) => {
    const rows =
      await getAllPatientMediaRecords();

    return (
      rows.find(
        (row) =>
          normalizeLower(row.media_id) ===
          normalizeLower(mediaId),
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
      .filter(
        (row) =>
          normalizeLower(row.patient_id) ===
          normalizeLower(patientId),
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.uploaded_at || 0,
        ).getTime();

        const dateB = new Date(
          b.uploaded_at || 0,
        ).getTime();

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

    return rows.filter(
      (row) =>
        normalizeLower(row.appointment_id) ===
        normalizeLower(appointmentId),
    );
  };

/* ========================================================
   GET BY TREATMENT
======================================================== */

export const getPatientMediaByTreatmentId =
  async (treatmentId) => {
    const rows =
      await getActivePatientMediaRecords();

    return rows.filter(
      (row) =>
        normalizeLower(row.treatment_id) ===
        normalizeLower(treatmentId),
    );
  };

/* ========================================================
   UPLOAD MEDIA
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
    if (
      !Array.isArray(files) ||
      files.length === 0
    ) {
      throw new Error(
        "At least one file is required",
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

    const rows =
      await getAllPatientMediaRecords();

    const newRecords = [];

    let nextRows = [...rows];

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

      let uploadedDriveFile = null;

      try {
        uploadedDriveFile =
          await uploadClinicalFile({
            buffer: file.buffer,

            fileName,

            mimeType: file.mimetype,

            patientId,

            categoryFolder,
          });

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

          drive_file_id:
            normalize(
              uploadedDriveFile.id,
            ),

          drive_folder_id:
            normalize(
              uploadedDriveFile.folderId,
            ),

          file_name:
            normalize(
              uploadedDriveFile.name ||
                fileName,
            ),

          mime_type:
            normalize(
              uploadedDriveFile.mimeType ||
                file.mimetype,
            ),

          file_size:
            normalize(
              uploadedDriveFile.size ||
                file.size ||
                "",
            ),

          uploaded_by:
            normalize(uploadedBy),

          uploaded_at:
            new Date().toISOString(),

          is_deleted: "FALSE",
        };

        nextRows.push(record);

        newRecords.push(record);
      } catch (error) {
        /*
         * If Drive upload succeeded but later something
         * fails before writing to Sheet, try to remove
         * the orphan Drive file.
         */
        if (uploadedDriveFile?.id) {
          try {
            await deleteDriveFile(
              uploadedDriveFile.id,
            );
          } catch (cleanupError) {
            console.error(
              "Failed to clean orphan Drive file:",
              cleanupError,
            );
          }
        }

        throw error;
      }
    }

    await writeSheet(
      SHEET_NAME,
      nextRows,
    );

    return newRecords;
  };

/* ========================================================
   GET FILE STREAM
======================================================== */

export const getPatientMediaFileStream =
  async (mediaId) => {
    const media =
      await getPatientMediaById(mediaId);

    if (
      !media ||
      isTrue(media.is_deleted)
    ) {
      return null;
    }

    const fileId = normalize(
      media.drive_file_id,
    );

    if (!fileId) {
      throw new Error(
        "Drive file ID is missing",
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
======================================================== */

export const softDeletePatientMedia =
  async (mediaId) => {
    const rows =
      await getAllPatientMediaRecords();

    const index = rows.findIndex(
      (row) =>
        normalizeLower(row.media_id) ===
        normalizeLower(mediaId),
    );

    if (index === -1) {
      return null;
    }

    rows[index] = {
      ...rows[index],

      is_deleted: "TRUE",
    };

    await writeSheet(
      SHEET_NAME,
      rows,
    );

    return rows[index];
  };

/* ========================================================
   HARD DELETE DRIVE FILE
======================================================== */

export const permanentlyDeletePatientMedia =
  async (mediaId) => {
    const rows =
      await getAllPatientMediaRecords();

    const index = rows.findIndex(
      (row) =>
        normalizeLower(row.media_id) ===
        normalizeLower(mediaId),
    );

    if (index === -1) {
      return null;
    }

    const media = rows[index];

    const driveFileId =
      normalize(
        media.drive_file_id,
      );

    if (driveFileId) {
      await deleteDriveFile(
        driveFileId,
      );
    }

    rows.splice(index, 1);

    await writeSheet(
      SHEET_NAME,
      rows,
    );

    return media;
  };