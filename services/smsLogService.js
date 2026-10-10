
/* ============================================================
   IVORY DENTAL - DAILY SMS LOG SERVICE
   Google Sheets Storage
============================================================ */

import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

/* ============================================================
   CONFIG
============================================================ */

const SHEET_NAME = "SMSLogs";

export const SMS_TYPES = {
  DOCTOR_ARRIVAL: "DOCTOR_ARRIVAL",
  APPOINTMENT: "APPOINTMENT",
};

const VALID_TYPES = Object.values(SMS_TYPES);

const TIME_ZONE = "Asia/Colombo";

/*
  Required sheet headers:
  Date | SMS Type | Status | Total | Sent |
  Failed | Sent By | Sent At | Batch Token
*/

/* ============================================================
   HELPERS
============================================================ */

const getToday = () => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type) =>
    parts.find((part) => part.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
};

const getTimestamp = () => {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
};

const validateType = (smsType) => {
  if (!VALID_TYPES.includes(smsType)) {
    const error = new Error("Invalid SMS type");
    error.statusCode = 400;
    throw error;
  }
};

const readLogs = async () => {
  return readSheet(SHEET_NAME, {
    forceRefresh: true,
  });
};

const findTodayRecord = (records, smsType, date) => {
  return records.find(
    (record) =>
      String(record.Date).trim() === date &&
      record["SMS Type"] === smsType
  );
};

const toNumber = (value) => Number(value) || 0;

const formatRecord = (record, smsType, date) => {
  if (!record) {
    return {
      date,
      smsType,
      status: "NOT_SENT",
      alreadySent: false,
      sending: false,
      total: 0,
      successCount: 0,
      failedCount: 0,
      sentBy: null,
      sentAt: null,
    };
  }

  return {
    date,
    smsType,
    status: record.Status,
    alreadySent: record.Status === "COMPLETED",
    sending: record.Status === "SENDING",
    total: toNumber(record.Total),
    successCount: toNumber(record.Sent),
    failedCount: toNumber(record.Failed),
    sentBy: record["Sent By"] || null,
    sentAt: record["Sent At"] || null,
  };
};

/* ============================================================
   SERIALIZE WRITES WITHIN THIS NODE PROCESS

   Prevents overlapping writeSheet() operations within
   one running backend instance.
============================================================ */

let writeQueue = Promise.resolve();

const withWriteLock = (operation) => {
  const result = writeQueue.then(operation);

  writeQueue = result.catch(() => {});

  return result;
};

/* ============================================================
   GET ONE SMS STATUS
============================================================ */

export const getSMSStatus = async (smsType) => {
  validateType(smsType);

  return withWriteLock(async () => {
    const date = getToday();
    const records = await readLogs();

    const record = findTodayRecord(
      records,
      smsType,
      date
    );

    return formatRecord(record, smsType, date);
  });
};

/* ============================================================
   GET BOTH SMS STATUSES
============================================================ */

export const getTodaySMSStatuses = async () => {
  return withWriteLock(async () => {
    const date = getToday();
    const records = await readLogs();

    const doctorArrival = findTodayRecord(
      records,
      SMS_TYPES.DOCTOR_ARRIVAL,
      date
    );

    const appointment = findTodayRecord(
      records,
      SMS_TYPES.APPOINTMENT,
      date
    );

    return {
      date,

      doctorArrival: formatRecord(
        doctorArrival,
        SMS_TYPES.DOCTOR_ARRIVAL,
        date
      ),

      appointment: formatRecord(
        appointment,
        SMS_TYPES.APPOINTMENT,
        date
      ),
    };
  });
};

/* ============================================================
   CLAIM SMS BATCH

   Create one record before SMS sending begins.
============================================================ */

export const claimSMSBatch = async ({
  smsType,
  total,
  sentBy,
}) => {
  validateType(smsType);

  if (!Number.isInteger(total) || total < 1) {
    const error = new Error("Invalid total SMS count");
    error.statusCode = 400;
    throw error;
  }

  return withWriteLock(async () => {
    const date = getToday();

    const records = await readLogs();

    const existing = findTodayRecord(
      records,
      smsType,
      date
    );

    if (existing) {
      return {
        success: false,
        alreadySent:
          existing.Status === "COMPLETED",
        status: existing.Status,
        message:
          "Today's SMS batch has already been started.",
      };
    }

    const token = crypto.randomUUID();

    records.push({
      Date: date,
      "SMS Type": smsType,
      Status: "SENDING",
      Total: String(total),
      Sent: "0",
      Failed: "0",
      "Sent By": String(sentBy || "Unknown"),
      "Sent At": "",
      "Batch Token": token,
    });

    await writeSheet(SHEET_NAME, records);

    return {
      success: true,
      date,
      smsType,
      status: "SENDING",
      token,
    };
  });
};

/* ============================================================
   COMPLETE SMS BATCH

   Update the existing row.
   Does not create another row.
============================================================ */

export const completeSMSBatch = async ({
  smsType,
  token,
  successCount,
  failedCount,
}) => {
  validateType(smsType);

  if (!token || typeof token !== "string") {
    const error = new Error("Batch token is required");
    error.statusCode = 400;
    throw error;
  }

  if (
    !Number.isInteger(successCount) ||
    !Number.isInteger(failedCount) ||
    successCount < 0 ||
    failedCount < 0
  ) {
    const error = new Error("Invalid SMS counts");
    error.statusCode = 400;
    throw error;
  }

  return withWriteLock(async () => {
    const date = getToday();

    const records = await readLogs();

    // Find by token so a batch crossing midnight
    // can still complete its original record.
    const record = records.find(
      (item) =>
        item["SMS Type"] === smsType &&
        item["Batch Token"] === token
    );

    if (!record) {
      const error = new Error(
        "SMS batch not found"
      );
      error.statusCode = 404;
      throw error;
    }

    if (record.Status !== "SENDING") {
      const error = new Error(
        "SMS batch is not in sending status"
      );
      error.statusCode = 409;
      throw error;
    }

    const total = toNumber(record.Total);

    if (successCount + failedCount !== total) {
      const error = new Error(
        "SMS counts do not match batch total"
      );
      error.statusCode = 400;
      throw error;
    }

    const status =
      failedCount === 0
        ? "COMPLETED"
        : successCount > 0
          ? "PARTIAL"
          : "FAILED";

    record.Status = status;
    record.Sent = String(successCount);
    record.Failed = String(failedCount);
    record["Sent At"] = getTimestamp();

    await writeSheet(SHEET_NAME, records);

    return {
      success: true,
      date: record.Date,
      smsType,
      status,
      total,
      successCount,
      failedCount,
    };
  });
};
