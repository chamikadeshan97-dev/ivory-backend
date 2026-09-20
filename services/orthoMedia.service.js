import {
  deleteDriveFile,
  getDriveFileMetadata,
  getDriveFileStream,
  uploadClinicalFile,
} from "./googleDriveService.js";

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

const SHEET_NAME =
  "Ortho_Media";

const ORTHO_CASES_SHEET =
  "Ortho_Cases";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

const normalizeLower = (
  value,
) =>
  normalize(
    value,
  ).toLowerCase();

const isTrue = (
  value,
) => {
  const normalized =
    normalizeLower(
      value,
    );

  return (
    normalized ===
      "true" ||
    normalized ===
      "1" ||
    normalized ===
      "yes"
  );
};

/* ========================================================
   ID
======================================================== */

const generateOrthoMediaId = (
  rows = [],
) => {
  let maxNumber = 0;

  rows.forEach(
    (row) => {
      const mediaId =
        normalize(
          row.ortho_media_id,
        );

      const match =
        mediaId.match(
          /^ORM_(\d+)$/i,
        );

      if (!match) {
        return;
      }

      const number =
        Number(
          match[1],
        );

      if (
        Number.isFinite(
          number,
        ) &&
        number >
          maxNumber
      ) {
        maxNumber =
          number;
      }
    },
  );

  return `ORM_${String(
    maxNumber + 1,
  ).padStart(
    6,
    "0",
  )}`;
};

/* ========================================================
   FILE NAME HELPERS
======================================================== */

const sanitizeFileName = (
  value,
) =>
  normalize(
    value,
  )
    .replace(
      /[^\w.\-]+/g,
      "_",
    )
    .replace(
      /_+/g,
      "_",
    );

const getFileExtension = (
  fileName,
) => {
  const match =
    normalize(
      fileName,
    ).match(
      /(\.[^./\\]+)$/,
    );

  return match
    ? match[1]
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
    getFileExtension(
      originalName,
    );

  const date =
    new Date()
      .toISOString()
      .slice(
        0,
        10,
      )
      .replaceAll(
        "-",
        "",
      );

  const parts = [
    patientId,
    caseId,

    visitId
      ? visitId
      : null,

    date,

    mediaType,

    category,

    stage,

    mediaId,
  ].filter(Boolean);

  return sanitizeFileName(
    `${parts.join(
      "_",
    )}${extension}`,
  );
};

/* ========================================================
   GET ALL
======================================================== */

export const getAllOrthoMediaRecords =
  async () => {
    const rows =
      (await readSheet(
        SHEET_NAME,
      )) || [];

    return rows;
  };

/* ========================================================
   GET ACTIVE
======================================================== */

export const getActiveOrthoMediaRecords =
  async () => {
    const rows =
      await getAllOrthoMediaRecords();

    return rows.filter(
      (row) =>
        !isTrue(
          row.is_deleted,
        ),
    );
  };

/* ========================================================
   GET ORTHO CASE
======================================================== */

const getOrthoCase =
  async (
    caseId,
  ) => {
    const rows =
      (await readSheet(
        ORTHO_CASES_SHEET,
      )) || [];

    return (
      rows.find(
        (row) =>
          normalizeLower(
            row.ortho_case_id,
          ) ===
          normalizeLower(
            caseId,
          ),
      ) || null
    );
  };

/* ========================================================
   GET MEDIA BY ID
======================================================== */

export const getOrthoMediaByIdService =
  async (
    mediaId,
  ) => {
    const rows =
      await getAllOrthoMediaRecords();

    return (
      rows.find(
        (row) =>
          normalizeLower(
            row.ortho_media_id,
          ) ===
          normalizeLower(
            mediaId,
          ),
      ) || null
    );
  };
export const getOrthoMediaById =
  async (mediaId) => {
    const rows =
      await getAllOrthoMediaRecords();

    const normalizedId =
      normalize(mediaId);

    return (
      rows.find(
        (row) =>
          normalize(
            row.ortho_media_id,
          ) === normalizedId &&
          normalize(
            row.is_deleted,
          ) !== "true",
      ) || null
    );
  };
/* ========================================================
   GET MEDIA BY CASE
======================================================== */

export const getOrthoMediaByCaseService =
  async (
    caseId,
    filters = {},
  ) => {
    const rows =
      await getActiveOrthoMediaRecords();

    let result =
      rows.filter(
        (row) =>
          normalizeLower(
            row.ortho_case_id,
          ) ===
          normalizeLower(
            caseId,
          ),
      );

    if (
      normalize(
        filters.media_type,
      )
    ) {
      result =
        result.filter(
          (row) =>
            normalizeLower(
              row.media_type,
            ) ===
            normalizeLower(
              filters.media_type,
            ),
        );
    }

    if (
      normalize(
        filters.stage,
      )
    ) {
      result =
        result.filter(
          (row) =>
            normalizeLower(
              row.stage,
            ) ===
            normalizeLower(
              filters.stage,
            ),
        );
    }

    if (
      normalize(
        filters.visit_id,
      )
    ) {
      result =
        result.filter(
          (row) =>
            normalizeLower(
              row.ortho_visit_id,
            ) ===
            normalizeLower(
              filters.visit_id,
            ),
        );
    }

    return result.sort(
      (
        a,
        b,
      ) => {
        const dateA =
          new Date(
            a.uploaded_at ||
              0,
          ).getTime();

        const dateB =
          new Date(
            b.uploaded_at ||
              0,
          ).getTime();

        return (
          dateB -
          dateA
        );
      },
    );
  };

/* ========================================================
   GET MEDIA BY PATIENT
======================================================== */

export const getOrthoMediaByPatientIdService =
  async (
    patientId,
  ) => {
    const rows =
      await getActiveOrthoMediaRecords();

    return rows
      .filter(
        (row) =>
          normalizeLower(
            row.patient_id,
          ) ===
          normalizeLower(
            patientId,
          ),
      )
      .sort(
        (
          a,
          b,
        ) => {
          const dateA =
            new Date(
              a.uploaded_at ||
                0,
            ).getTime();

          const dateB =
            new Date(
              b.uploaded_at ||
                0,
            ).getTime();

          return (
            dateB -
            dateA
          );
        },
      );
  };

/* ========================================================
   GET MEDIA BY VISIT
======================================================== */

export const getOrthoMediaByVisitService =
  async (
    visitId,
  ) => {
    const rows =
      await getActiveOrthoMediaRecords();

    return rows.filter(
      (row) =>
        normalizeLower(
          row.ortho_visit_id,
        ) ===
        normalizeLower(
          visitId,
        ),
    );
  };

/* ========================================================
   CREATE / UPLOAD
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
    /* ----------------------------------------------------
       VALIDATE
    ---------------------------------------------------- */

    if (
      !Array.isArray(
        files,
      ) ||
      files.length === 0
    ) {
      throw new Error(
        "At least one file is required",
      );
    }

    if (
      !normalize(
        caseId,
      )
    ) {
      throw new Error(
        "Ortho case ID is required",
      );
    }

    if (
      !normalize(
        mediaType,
      )
    ) {
      throw new Error(
        "Media type is required",
      );
    }

    /* ----------------------------------------------------
       GET CASE
    ---------------------------------------------------- */

    const orthoCase =
      await getOrthoCase(
        caseId,
      );

    if (!orthoCase) {
      throw new Error(
        "Ortho case not found",
      );
    }

    const patientId =
      normalize(
        orthoCase.patient_id,
      );

    if (!patientId) {
      throw new Error(
        "Patient ID is missing from Ortho case",
      );
    }

    /* ----------------------------------------------------
       GET EXISTING ROWS
    ---------------------------------------------------- */

    const rows =
      await getAllOrthoMediaRecords();

    const newRecords =
      [];

    let nextRows = [
      ...rows,
    ];

    /* ====================================================
       FILE LOOP
    ==================================================== */

    for (
      const file of files
    ) {
      /* --------------------------------------------------
         BUFFER CHECK
      -------------------------------------------------- */

      if (
        !Buffer.isBuffer(
          file?.buffer,
        )
      ) {
        console.error(
          "ORTHO MEDIA FILE BUFFER MISSING:",
          {
            originalname:
              file?.originalname,

            mimetype:
              file?.mimetype,

            size:
              file?.size,

            fieldname:
              file?.fieldname,

            path:
              file?.path,

            hasBuffer:
              Buffer.isBuffer(
                file?.buffer,
              ),
          },
        );

        throw new Error(
          `File buffer is missing for ${
            file?.originalname ||
            "uploaded file"
          }. Multer must use memoryStorage().`,
        );
      }

      /* --------------------------------------------------
         ID
      -------------------------------------------------- */

      const mediaId =
        generateOrthoMediaId(
          nextRows,
        );

      /* --------------------------------------------------
         FILE NAME
      -------------------------------------------------- */

      const fileName =
        buildOrthoFileName(
          {
            mediaId,

            patientId,

            caseId,

            visitId,

            mediaType,

            category,

            stage,

            originalName:
              file.originalname,
          },
        );

      /* --------------------------------------------------
         DRIVE FOLDER
      -------------------------------------------------- */

      const categoryFolder =
        getOrthoMediaFolder(
          mediaType,
        );

      let uploadedDriveFile =
        null;

      try {
        /* ==================================================
           GOOGLE DRIVE UPLOAD
        ================================================== */

        uploadedDriveFile =
          await uploadClinicalFile(
            {
              buffer:
                file.buffer,

              fileName,

              mimeType:
                file.mimetype,

              patientId,

              categoryFolder,
            },
          );

        /* --------------------------------------------------
           VALIDATE DRIVE RESULT
        -------------------------------------------------- */

        if (
          !uploadedDriveFile?.id
        ) {
          throw new Error(
            "Google Drive upload did not return a file ID",
          );
        }

        /* ==================================================
           SHEET RECORD
        ================================================== */

        const record = {
          ortho_media_id:
            mediaId,

          ortho_case_id:
            normalize(
              caseId,
            ),

          patient_id:
            patientId,

          ortho_visit_id:
            normalize(
              visitId,
            ),

          media_date:
            normalize(
              mediaDate,
            ) ||
            new Date()
              .toISOString()
              .slice(
                0,
                10,
              ),

          media_type:
            normalize(
              mediaType,
            ),

          category:
            normalize(
              category,
            ),

          stage:
            normalize(
              stage,
            ),

          description:
            normalize(
              description,
            ),

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
            normalize(
              uploadedBy,
            ),

          uploaded_at:
            new Date()
              .toISOString(),

          is_deleted:
            "FALSE",
        };

        nextRows.push(
          record,
        );

        newRecords.push(
          record,
        );
      } catch (error) {
        /*
         * If Google Drive upload succeeded but
         * later processing fails, remove the
         * orphaned Drive file.
         */

        if (
          uploadedDriveFile?.id
        ) {
          try {
            await deleteDriveFile(
              uploadedDriveFile.id,
            );
          } catch (
            cleanupError
          ) {
            console.error(
              "Failed to clean orphan Ortho Drive file:",
              cleanupError,
            );
          }
        }

        throw error;
      }
    }

    /* ====================================================
       SAVE SHEET
    ==================================================== */

    try {
      await writeSheet(
        SHEET_NAME,
        nextRows,
      );
    } catch (error) {
      /*
       * If the sheet write fails, all files uploaded during
       * this request should be removed from Drive because
       * otherwise they become orphan files.
       */

      console.error(
        "Failed to write Ortho media sheet:",
        error,
      );

      for (
        const record of newRecords
      ) {
        if (
          record.drive_file_id
        ) {
          try {
            await deleteDriveFile(
              record.drive_file_id,
            );
          } catch (
            cleanupError
          ) {
            console.error(
              "Failed to clean Ortho Drive file after Sheet error:",
              cleanupError,
            );
          }
        }
      }

      throw error;
    }

    return newRecords;
  };

/* ========================================================
   GET FILE STREAM
======================================================== */

export const getOrthoMediaFileStream =
  async (
    mediaId,
  ) => {
    const media =
      await getOrthoMediaByIdService(
        mediaId,
      );

    if (
      !media ||
      isTrue(
        media.is_deleted,
      )
    ) {
      return null;
    }

    const fileId =
      normalize(
        media.drive_file_id,
      );

    if (!fileId) {
      throw new Error(
        "Drive file ID is missing",
      );
    }

    const metadata =
      await getDriveFileMetadata(
        fileId,
      );

    const stream =
      await getDriveFileStream(
        fileId,
      );

    return {
      media,
      metadata,
      stream,
    };
  };

/* ========================================================
   SOFT DELETE
======================================================== */

export const deleteOrthoMediaService =
  async (
    mediaId,
  ) => {
    const rows =
      await getAllOrthoMediaRecords();

    const index =
      rows.findIndex(
        (row) =>
          normalizeLower(
            row.ortho_media_id,
          ) ===
          normalizeLower(
            mediaId,
          ),
      );

    if (
      index === -1
    ) {
      return null;
    }

    rows[index] = {
      ...rows[index],

      is_deleted:
        "TRUE",
    };

    await writeSheet(
      SHEET_NAME,
      rows,
    );

    return rows[index];
  };

/* ========================================================
   PERMANENT DELETE
======================================================== */

export const permanentlyDeleteOrthoMediaService =
  async (
    mediaId,
  ) => {
    const rows =
      await getAllOrthoMediaRecords();

    const index =
      rows.findIndex(
        (row) =>
          normalizeLower(
            row.ortho_media_id,
          ) ===
          normalizeLower(
            mediaId,
          ),
      );

    if (
      index === -1
    ) {
      return null;
    }

    const media =
      rows[index];

    const driveFileId =
      normalize(
        media.drive_file_id,
      );

    if (
      driveFileId
    ) {
      await deleteDriveFile(
        driveFileId,
      );
    }

    rows.splice(
      index,
      1,
    );

    await writeSheet(
      SHEET_NAME,
      rows,
    );

    return media;
  };