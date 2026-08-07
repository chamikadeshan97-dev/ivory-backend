import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

/* -------------------------------------------------------
   Cache configuration
------------------------------------------------------- */

const CACHE_DURATION_MS = 10_000;

const sheetCache = new Map();

const escapeSheetName = (sheetName) => {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
};

const normalizeHeader = (header) => {
  return String(header || "").trim();
};

const sleep = (milliseconds) => {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

/* -------------------------------------------------------
   Google API retry helper
------------------------------------------------------- */

const executeWithRetry = async (operation, maxRetries = 4) => {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const status =
        error?.response?.status ||
        error?.code;

      const isRetryable =
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }

      const randomDelay = Math.floor(Math.random() * 1000);
      const retryDelay = Math.min(
        2 ** attempt * 1000 + randomDelay,
        32_000,
      );

      console.warn(
        `Google Sheets request failed with ${status}. ` +
          `Retrying after ${retryDelay}ms...`,
      );

      await sleep(retryDelay);
    }
  }

  throw lastError;
};

/* -------------------------------------------------------
   Cache helpers
------------------------------------------------------- */

export const clearSheetCache = (sheetName) => {
  if (sheetName) {
    sheetCache.delete(sheetName);
    return;
  }

  sheetCache.clear();
};

const getCachedSheet = (sheetName) => {
  const cached = sheetCache.get(sheetName);

  if (!cached) {
    return null;
  }

  const isExpired =
    Date.now() - cached.createdAt > CACHE_DURATION_MS;

  if (isExpired) {
    sheetCache.delete(sheetName);
    return null;
  }

  return structuredClone(cached.data);
};

const setCachedSheet = (sheetName, data) => {
  sheetCache.set(sheetName, {
    data: structuredClone(data),
    createdAt: Date.now(),
  });
};

/* -------------------------------------------------------
   Read one sheet
------------------------------------------------------- */

export const readSheet = async (
  sheetName,
  { forceRefresh = false } = {},
) => {
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  if (!forceRefresh) {
    const cachedData = getCachedSheet(sheetName);

    if (cachedData) {
      return cachedData;
    }
  }

  const response = await executeWithRetry(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapeSheetName(sheetName)}!A:ZZ`,
    }),
  );

  const rows = response.data.values || [];

  if (rows.length === 0) {
    setCachedSheet(sheetName, []);
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  const records = rows.slice(1).map((row) => {
    const record = {};

    headers.forEach((header, index) => {
      if (header) {
        record[header] = row[index] ?? "";
      }
    });

    return record;
  });

  setCachedSheet(sheetName, records);

  return structuredClone(records);
};

/* -------------------------------------------------------
   Read multiple sheets in one API request
------------------------------------------------------- */

export const readSheets = async (
  sheetNames,
  { forceRefresh = false } = {},
) => {
  if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
    return {};
  }

  const result = {};
  const missingSheetNames = [];

  for (const sheetName of sheetNames) {
    if (!forceRefresh) {
      const cachedData = getCachedSheet(sheetName);

      if (cachedData) {
        result[sheetName] = cachedData;
        continue;
      }
    }

    missingSheetNames.push(sheetName);
  }

  if (missingSheetNames.length === 0) {
    return result;
  }

  const response = await executeWithRetry(() =>
    sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: missingSheetNames.map(
        (sheetName) =>
          `${escapeSheetName(sheetName)}!A:ZZ`,
      ),
    }),
  );

  const valueRanges = response.data.valueRanges || [];

  missingSheetNames.forEach((sheetName, sheetIndex) => {
    const rows = valueRanges[sheetIndex]?.values || [];

    if (rows.length === 0) {
      result[sheetName] = [];
      setCachedSheet(sheetName, []);
      return;
    }

    const headers = rows[0].map(normalizeHeader);

    const records = rows.slice(1).map((row) => {
      const record = {};

      headers.forEach((header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }
      });

      return record;
    });

    result[sheetName] = records;
    setCachedSheet(sheetName, records);
  });

  return result;
};

/* -------------------------------------------------------
   Write complete sheet
------------------------------------------------------- */

export const writeSheet = async (sheetName, records) => {
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  if (!Array.isArray(records)) {
    throw new Error("Records must be an array");
  }

  const escapedSheetName = escapeSheetName(sheetName);

  if (records.length === 0) {
    await executeWithRetry(() =>
      sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${escapedSheetName}!A2:ZZ`,
      }),
    );

    clearSheetCache(sheetName);
    return [];
  }

  const headers = Object.keys(records[0]);

  const values = [
    headers,
    ...records.map((record) =>
      headers.map((header) => record[header] ?? ""),
    ),
  ];

  await executeWithRetry(() =>
    sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${escapedSheetName}!A:ZZ`,
    }),
  );

  await executeWithRetry(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${escapedSheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values,
      },
    }),
  );

  clearSheetCache(sheetName);

  return records;
};