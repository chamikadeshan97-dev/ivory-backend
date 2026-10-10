
import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import {
  uploadIdlePoster,
  deleteIdlePoster,
  getIdlePosterUrl,
} from "./idleDisplayS3.js";

/* =========================================================
   IVORY DENTAL
   IDLE DISPLAY SERVICE
   GOOGLE SHEETS + AWS S3
========================================================= */

/* =========================================================
   CONFIG
========================================================= */

const SHEET_NAME = "Idle_Slides";

const DEFAULT_DURATION = 6000;
const MIN_DURATION = 1000;
const MAX_DURATION = 120000;

const DEBUG = process.env.NODE_ENV !== "production";

/* =========================================================
   LOGGING
========================================================= */

const log = (message, details) => {
  if (!DEBUG) return;

  if (details !== undefined) {
    console.log(`[IDLE DISPLAY] ${message}`, details);
  } else {
    console.log(`[IDLE DISPLAY] ${message}`);
  }
};

const logError = (message, error) => {
  console.error(`[IDLE DISPLAY] ${message}`, {
    message: error?.message,
    name: error?.name,
    status:
      error?.response?.status ||
      error?.$metadata?.httpStatusCode ||
      error?.status,
    code: error?.code,
  });
};

/* =========================================================
   ERROR HELPER
========================================================= */

const createError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

/* =========================================================
   MUTATION LOCK

   Serializes mutations within this Node.js process.

   IMPORTANT:
   Google Sheets does not provide transaction-level
   protection with the current writeSheet helper.

   Use a single backend writer for this worksheet.
========================================================= */

let mutationQueue = Promise.resolve();

let pendingMutations = 0;

const withMutationLock = async (operation, name = "MUTATION") => {
  const requestedAt = Date.now();

  pendingMutations += 1;

  log(`${name}: Mutation requested`, {
    pendingMutations,
  });

  const previous = mutationQueue;

  let release;

  mutationQueue = new Promise((resolve) => {
    release = resolve;
  });

  try {
    await previous;

    log(`${name}: Lock acquired`, {
      waitMs: Date.now() - requestedAt,
    });

    return await operation();
  } finally {
    pendingMutations -= 1;
    release();

    log(`${name}: Lock released`, {
      pendingMutations,
    });
  }
};

/* =========================================================
   HELPERS
========================================================= */

const isTrue = (value) =>
  value === true ||
  String(value ?? "")
    .trim()
    .toLowerCase() === "true";

const isDeleted = (record) =>
  isTrue(record.deleted);

const getActiveRows = (rows) =>
  rows.filter((row) => !isDeleted(row));

const sortSlides = (slides) =>
  [...slides].sort(
    (a, b) =>
      Number(a.display_order) -
        Number(b.display_order) ||
      String(a.slide_id).localeCompare(
        String(b.slide_id),
      ),
  );

const formatSlideId = (number) =>
  `IDL_${String(number).padStart(6, "0")}`;

const generateNextId = (rows) => {
  const maxId = rows.reduce((maximum, row) => {
    const match = String(
      row.slide_id || "",
    ).match(/^IDL_(\d+)$/);

    if (!match) return maximum;

    const value = Number(match[1]);

    return Number.isSafeInteger(value)
      ? Math.max(maximum, value)
      : maximum;
  }, 0);

  if (!Number.isSafeInteger(maxId + 1)) {
    throw createError(
      "Maximum slide ID reached",
      500,
    );
  }

  return formatSlideId(maxId + 1);
};

const getNextOrder = (rows) =>
  getActiveRows(rows).reduce(
    (maximum, row) =>
      Math.max(
        maximum,
        Number(row.display_order) || 0,
      ),
    0,
  ) + 1;

/* =========================================================
   VALIDATION
========================================================= */

const validateSlideId = (slideId) => {
  const id = String(slideId ?? "").trim();

  if (!/^IDL_\d{6,}$/.test(id)) {
    throw createError("Invalid slide ID");
  }

  return id;
};

const validateTitle = (title) => {
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 150
  ) {
    throw createError(
      "Title must contain 1–150 characters",
    );
  }

  return title.trim();
};

const validateDuration = (duration) => {
  if (
    duration === null ||
    duration === undefined ||
    duration === "" ||
    typeof duration === "boolean"
  ) {
    throw createError("Invalid duration");
  }

  const number = Number(duration);

  if (
    !Number.isInteger(number) ||
    number < MIN_DURATION ||
    number > MAX_DURATION
  ) {
    throw createError(
      "Duration must be between 1000 and 120000 milliseconds",
    );
  }

  return number;
};

const validateOrder = (order) => {
  if (
    order === null ||
    order === undefined ||
    order === "" ||
    typeof order === "boolean"
  ) {
    throw createError("Invalid display order");
  }

  const number = Number(order);

  if (
    !Number.isSafeInteger(number) ||
    number < 1
  ) {
    throw createError(
      "Display order must be a positive integer",
    );
  }

  return number;
};

const validateEnabled = (enabled) => {
  if (
    enabled === true ||
    String(enabled).trim().toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    enabled === false ||
    String(enabled).trim().toLowerCase() === "false"
  ) {
    return false;
  }

  throw createError(
    "Enabled must be true or false",
  );
};

const findSlideIndex = (rows, slideId) =>
  rows.findIndex(
    (row) =>
      String(row.slide_id) === slideId &&
      !isDeleted(row),
  );

/* =========================================================
   NORMALIZE RECORD
========================================================= */

const normalizeSlide = (slide) => ({
  id: String(slide.slide_id || ""),

  title: String(slide.title || ""),

  imageKey: String(slide.image_key || ""),

  duration:
    Number(slide.duration) || DEFAULT_DURATION,

  order:
    Number(slide.display_order) || 1,

  enabled: isTrue(slide.enabled),

  createdAt:
    slide.created_at || null,

  updatedAt:
    slide.updated_at || null,
});

/* =========================================================
   IMAGE URL HANDLING
========================================================= */

const attachImageUrls = async (slides) =>
  Promise.all(
    slides.map(async (slide) => ({
      ...slide,

      image: await getIdlePosterUrl(
        slide.imageKey,
      ),
    })),
  );

/* =========================================================
   GOOGLE SHEETS HELPERS
========================================================= */

const readFreshRows = async () => {
  log("Reading Google Sheets", {
    sheet: SHEET_NAME,
    forceRefresh: true,
  });

  const rows = await readSheet(SHEET_NAME, {
    forceRefresh: true,
  });

  if (!Array.isArray(rows)) {
    throw createError(
      "Invalid Google Sheets response",
      500,
    );
  }

  log("Google Sheets read successful", {
    totalRows: rows.length,
  });

  return rows;
};

const saveRows = async (rows) => {
  log("Starting Google Sheets write", {
    totalRows: rows.length,
  });

  await writeSheet(SHEET_NAME, rows);

  log("Google Sheets write completed", {
    totalRows: rows.length,
  });
};

/* =========================================================
   GET ALL SLIDES
   ADMIN
========================================================= */

export const getAllIdleSlides = async () => {
  const startedAt = Date.now();

  log("GET ALL: Started");

  try {
    const rows = await readSheet(SHEET_NAME);

    const active = getActiveRows(rows);

    const slides = sortSlides(active).map(
      normalizeSlide,
    );

    const result = await attachImageUrls(slides);

    log("GET ALL: Completed", {
      count: result.length,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    logError("GET ALL failed", error);
    throw error;
  }
};

/* =========================================================
   GET ENABLED SLIDES
   PUBLIC DISPLAY
========================================================= */

export const getEnabledIdleSlides = async () => {
  const startedAt = Date.now();

  log("GET ENABLED: Started");

  try {
    const rows = await readSheet(SHEET_NAME);

    const enabled = getActiveRows(rows).filter(
      (slide) => isTrue(slide.enabled),
    );

    const slides = sortSlides(enabled).map(
      normalizeSlide,
    );

    const result = await attachImageUrls(slides);

    log("GET ENABLED: Completed", {
      count: result.length,
      durationMs: Date.now() - startedAt,
    });

    return result;
  } catch (error) {
    logError("GET ENABLED failed", error);
    throw error;
  }
};

/* =========================================================
   CREATE SLIDE
========================================================= */

export const createIdleSlide = async (data, file) =>
  withMutationLock(
    async () => {
      const startedAt = Date.now();

      log("CREATE: Started");

      try {
        /* ---------------------------------------------
           VALIDATION
        --------------------------------------------- */

        log("CREATE: Validating input");

        const title = validateTitle(
          data?.title,
        );

        const duration = validateDuration(
          data?.duration ?? DEFAULT_DURATION,
        );

        const enabled = validateEnabled(
          data?.enabled ?? true,
        );

        if (!file?.buffer) {
          throw createError(
            "Poster image is required",
          );
        }

        log("CREATE: Validation completed", {
          title,
          duration,
          enabled,
          fileSize: file.size,
          fileType: file.mimetype,
        });

        /* ---------------------------------------------
           READ GOOGLE SHEETS
        --------------------------------------------- */

        log("CREATE: Reading existing slides");

        const rows = await readFreshRows();

        /* ---------------------------------------------
           GENERATE ID
        --------------------------------------------- */

        const slideId = generateNextId(rows);

        const displayOrder = getNextOrder(rows);

        log("CREATE: Generated slide information", {
          slideId,
          displayOrder,
        });

        /* ---------------------------------------------
           S3 UPLOAD
        --------------------------------------------- */

        log("CREATE: Starting AWS S3 upload");

        const uploaded = await uploadIdlePoster(
          slideId,
          file,
        );

        log("CREATE: AWS S3 upload successful", {
          key: uploaded.key,
          size: uploaded.size,
        });

        /* ---------------------------------------------
           BUILD RECORD
        --------------------------------------------- */

        const timestamp = new Date().toISOString();

        const record = {
          slide_id: slideId,

          title,

          image_key: uploaded.key,

          duration: String(duration),

          display_order: String(displayOrder),

          enabled: String(enabled).toUpperCase(),

          deleted: "FALSE",

          created_at: timestamp,

          updated_at: timestamp,
        };

        /* ---------------------------------------------
           SAVE GOOGLE SHEETS
        --------------------------------------------- */

        try {
          await saveRows([
            ...rows,
            record,
          ]);
        } catch (error) {
          logError(
            "CREATE: Google Sheets write failed",
            error,
          );

          // Do not immediately delete the uploaded image.
          // A timed-out write can still have committed.
          // The unused S3 object can be reconciled later.
          throw error;
        }

        /* ---------------------------------------------
           GENERATE SIGNED IMAGE URL
        --------------------------------------------- */

        log("CREATE: Generating signed image URL");

        const [result] = await attachImageUrls([
          normalizeSlide(record),
        ]);

        log("CREATE: Completed", {
          slideId,
          durationMs: Date.now() - startedAt,
        });

        return result;
      } catch (error) {
        logError("CREATE: Failed", error);
        throw error;
      }
    },
    "CREATE",
  );

/* =========================================================
   UPDATE SLIDE
========================================================= */

export const updateIdleSlide = async (
  slideId,
  data,
) =>
  withMutationLock(
    async () => {
      const startedAt = Date.now();

      log("UPDATE: Started", {
        slideId,
      });

      try {
        const id = validateSlideId(slideId);

        const rows = await readFreshRows();

        const index = findSlideIndex(rows, id);

        if (index < 0) {
          throw createError(
            "Slide not found",
            404,
          );
        }

        const updated = {
          ...rows[index],
        };

        if (data?.title !== undefined) {
          updated.title = validateTitle(
            data.title,
          );
        }

        if (data?.duration !== undefined) {
          updated.duration = String(
            validateDuration(data.duration),
          );
        }

        if (data?.display_order !== undefined) {
          updated.display_order = String(
            validateOrder(data.display_order),
          );
        }

        if (data?.enabled !== undefined) {
          updated.enabled = String(
            validateEnabled(data.enabled),
          ).toUpperCase();
        }

        updated.updated_at =
          new Date().toISOString();

        rows[index] = updated;

        await saveRows(rows);

        const [result] = await attachImageUrls([
          normalizeSlide(updated),
        ]);

        log("UPDATE: Completed", {
          slideId: id,
          durationMs: Date.now() - startedAt,
        });

        return result;
      } catch (error) {
        logError("UPDATE: Failed", error);
        throw error;
      }
    },
    "UPDATE",
  );

/* =========================================================
   REPLACE SLIDE IMAGE
========================================================= */

export const replaceIdleSlideImage = async (
  slideId,
  file,
) =>
  withMutationLock(
    async () => {
      const startedAt = Date.now();

      log("REPLACE: Started", {
        slideId,
      });

      try {
        const id = validateSlideId(slideId);

        if (!file?.buffer) {
          throw createError(
            "New image is required",
          );
        }

        const rows = await readFreshRows();

        const index = findSlideIndex(rows, id);

        if (index < 0) {
          throw createError(
            "Slide not found",
            404,
          );
        }

        const oldImageKey =
          rows[index].image_key;

        log("REPLACE: Uploading new poster");

        const uploaded = await uploadIdlePoster(
          id,
          file,
        );

        log("REPLACE: New image uploaded", {
          newKey: uploaded.key,
        });

        const updated = {
          ...rows[index],

          image_key: uploaded.key,

          updated_at:
            new Date().toISOString(),
        };

        rows[index] = updated;

        try {
          await saveRows(rows);
        } catch (error) {
          // Preserve both files until we can verify
          // whether the sheet write succeeded.
          logError(
            "REPLACE: Sheets update failed",
            error,
          );

          throw error;
        }

        /* ---------------------------------------------
           DELETE OLD IMAGE
        --------------------------------------------- */

        if (
          oldImageKey &&
          oldImageKey !== uploaded.key
        ) {
          try {
            await deleteIdlePoster(
              oldImageKey,
            );

            log("REPLACE: Old image deleted");
          } catch (error) {
            logError(
              "REPLACE: Old image cleanup failed",
              error,
            );
          }
        }

        const [result] = await attachImageUrls([
          normalizeSlide(updated),
        ]);

        log("REPLACE: Completed", {
          slideId: id,
          durationMs: Date.now() - startedAt,
        });

        return result;
      } catch (error) {
        logError("REPLACE: Failed", error);
        throw error;
      }
    },
    "REPLACE",
  );

/* =========================================================
   DELETE SLIDE

   Soft delete in Google Sheets.
   Delete physical image from AWS S3.
========================================================= */

export const deleteIdleSlide = async (slideId) =>
  withMutationLock(
    async () => {
      const startedAt = Date.now();

      log("DELETE: Started", {
        slideId,
      });

      try {
        const id = validateSlideId(slideId);

        const rows = await readFreshRows();

        const index = findSlideIndex(rows, id);

        if (index < 0) {
          throw createError(
            "Slide not found",
            404,
          );
        }

        const imageKey =
          rows[index].image_key;

        rows[index] = {
          ...rows[index],

          enabled: "FALSE",

          deleted: "TRUE",

          updated_at:
            new Date().toISOString(),
        };

        await saveRows(rows);

        log("DELETE: Google Sheets record deleted");

        /* ---------------------------------------------
           DELETE S3 IMAGE
        --------------------------------------------- */

        if (imageKey) {
          try {
            await deleteIdlePoster(imageKey);

            log("DELETE: S3 image deleted");
          } catch (error) {
            logError(
              "DELETE: S3 cleanup failed",
              error,
            );
          }
        }

        log("DELETE: Completed", {
          slideId: id,
          durationMs: Date.now() - startedAt,
        });

        return {
          id,
          deleted: true,
        };
      } catch (error) {
        logError("DELETE: Failed", error);
        throw error;
      }
    },
    "DELETE",
  );
