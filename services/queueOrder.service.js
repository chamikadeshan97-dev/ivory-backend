import * as googleSheets from "../utils/googleSheets.js";

const SHEET_NAME = "QueueOrder";

/* ========================================================
   Helpers
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

const nowIso = () =>
  new Date().toISOString();

/* ========================================================
   Parse saved queue array safely
======================================================== */

const parseQueueOrder = (value) => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => normalize(item))
      .filter(Boolean);
  } catch (error) {
    console.error(
      "Failed to parse queue_order:",
      error
    );

    return [];
  }
};

/* ========================================================
   Get Queue By Date
======================================================== */

export const getQueueByDate = async (
  date
) => {
  if (!date) {
    throw new Error("Date is required");
  }

  const rows =
    await googleSheets.readSheet(
      SHEET_NAME
    );

  const record = rows.find(
    (row) =>
      normalize(row.date) ===
      normalize(date)
  );

  if (!record) {
    return {
      date: normalize(date),
      queue_order: [],
      updated_at: null,
    };
  }

  return {
    date: normalize(record.date),

    queue_order: parseQueueOrder(
      record.queue_order
    ),

    updated_at:
      record.updated_at || null,
  };
};

/* ========================================================
   Save Daily Queue
======================================================== */

export const saveQueue = async ({
  date,
  queue_order,
}) => {
  if (!date) {
    throw new Error("Date is required");
  }

  if (!Array.isArray(queue_order)) {
    throw new Error(
      "queue_order must be an array"
    );
  }

  /*
   * Clean appointment IDs
   */

  const cleanedQueue =
    queue_order
      .map((item) =>
        normalize(item)
      )
      .filter(Boolean);

  /*
   * Prevent duplicates
   */

  const uniqueQueue = [
    ...new Set(cleanedQueue),
  ];

  if (
    uniqueQueue.length !==
    cleanedQueue.length
  ) {
    throw new Error(
      "Duplicate appointments are not allowed in the queue"
    );
  }

  const rows =
    await googleSheets.readSheet(
      SHEET_NAME
    );

  const timestamp = nowIso();

  let found = false;

  const updatedRows = rows.map(
    (row) => {
      if (
        normalize(row.date) ===
        normalize(date)
      ) {
        found = true;

        return {
          date: normalize(date),

          queue_order:
            JSON.stringify(
              uniqueQueue
            ),

          updated_at: timestamp,
        };
      }

      return row;
    }
  );

  /*
   * No queue exists for this day yet
   */

  if (!found) {
    updatedRows.push({
      date: normalize(date),

      queue_order:
        JSON.stringify(
          uniqueQueue
        ),

      updated_at: timestamp,
    });
  }

  await googleSheets.writeSheet(
    SHEET_NAME,
    updatedRows
  );

  return {
    date: normalize(date),
    queue_order: uniqueQueue,
    updated_at: timestamp,
  };
};

/* ========================================================
   Clear Queue
======================================================== */

export const clearQueue = async (
  date
) => {
  return saveQueue({
    date,
    queue_order: [],
  });
};