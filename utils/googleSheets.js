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


/* -------------------------------------------------------
   Write complete sheet
   - Preserve existing headers
   - Include fields from every record
   - Update before clearing leftover rows
   - Invalidate cache after changes
------------------------------------------------------- */


/* -------------------------------------------------------
   Write complete sheet

   - Preserve existing column positions
   - Include fields from every record
   - Write and clear in one batchUpdate
   - Automatically expand sheet dimensions
   - Keep existing function signature
   - Clear cache after successful writes

   IMPORTANT:
   This does not provide concurrent-write
   protection across separate processes.
------------------------------------------------------- */

export const writeSheet = async (sheetName, records) => {
  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_SHEET_ID is not configured",
    );
  }

  if (!Array.isArray(records)) {
    throw new Error(
      "Records must be an array",
    );
  }

  const escapedSheetName =
    escapeSheetName(sheetName);

  /*
   * Get worksheet identity and grid dimensions.
   */
  const spreadsheetResponse =
    await executeWithRetry(() =>
      sheets.spreadsheets.get({
        spreadsheetId,
        fields:
          "sheets(properties(sheetId,title,gridProperties))",
      }),
    );

  const sheetInfo =
    spreadsheetResponse.data.sheets?.find(
      (sheet) =>
        sheet.properties?.title === sheetName,
    );

  if (!sheetInfo) {
    throw new Error(
      `Worksheet "${sheetName}" not found`,
    );
  }

  const sheetId =
    sheetInfo.properties.sheetId;

  const gridProperties =
    sheetInfo.properties.gridProperties || {};

  /*
   * Fetch current worksheet values.
   * Do not use cached records for this step.
   */
  const existingResponse =
    await executeWithRetry(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${escapedSheetName}!A1:ZZ`,
      }),
    );

  const existingValues =
    existingResponse.data.values || [];

  /*
   * Preserve column positions, including
   * any empty columns between headers.
   */
  const headers = (
    existingValues[0] || []
  ).map(normalizeHeader);

  const knownHeaders = new Set(
    headers.filter(Boolean),
  );

  /*
   * Append new headers discovered in
   * any record.
   */
  for (const record of records) {
    if (
      !record ||
      typeof record !== "object" ||
      Array.isArray(record)
    ) {
      throw new Error(
        "Each record must be an object",
      );
    }

    for (const key of Object.keys(record)) {
      const header = normalizeHeader(key);

      if (
        header &&
        !knownHeaders.has(header)
      ) {
        headers.push(header);
        knownHeaders.add(header);
      }
    }
  }

  if (!knownHeaders.size) {
    throw new Error(
      `No headers available for "${sheetName}"`,
    );
  }

  /*
   * Prevent duplicate column names.
   */
  if (
    knownHeaders.size !==
    headers.filter(Boolean).length
  ) {
    throw new Error(
      "Duplicate worksheet headers detected",
    );
  }

  /*
   * Build complete table.
   */
  const values = [
    headers,
    ...records.map((record) =>
      headers.map((header) =>
        header
          ? String(record[header] ?? "")
          : "",
      ),
    ),
  ];

  const previousRowCount =
    existingValues.length;

  const newRowCount =
    values.length;

  const requiredRowCount = Math.max(
    previousRowCount,
    newRowCount,
    1,
  );

  const previousColumnCount = Math.max(
    0,
    ...existingValues.map(
      (row) => row.length,
    ),
  );

  const requiredColumnCount = Math.max(
    previousColumnCount,
    headers.length,
    1,
  );

  /*
   * Convert values to Google Sheets
   * CellData objects.
   *
   * Empty objects clear previous cell values
   * when userEnteredValue is updated.
   */
  const toCell = (value) => {
    const text = String(value ?? "");

    return text === ""
      ? {}
      : {
          userEnteredValue: {
            stringValue: text,
          },
        };
  };

  const rowData = values.map((row) => ({
    values: Array.from(
      {
        length: requiredColumnCount,
      },
      (_, index) =>
        toCell(row[index] ?? ""),
    ),
  }));

  /*
   * Include blank rows to remove records
   * that no longer exist.
   */
  while (
    rowData.length < requiredRowCount
  ) {
    rowData.push({
      values: Array.from(
        {
          length: requiredColumnCount,
        },
        () => ({}),
      ),
    });
  }

  const requests = [];

  /*
   * Expand worksheet if necessary.
   */
  const currentRows =
    gridProperties.rowCount || 0;

  const currentColumns =
    gridProperties.columnCount || 0;

  if (requiredRowCount > currentRows) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "ROWS",
        length:
          requiredRowCount - currentRows,
      },
    });
  }

  if (
    requiredColumnCount > currentColumns
  ) {
    requests.push({
      appendDimension: {
        sheetId,
        dimension: "COLUMNS",
        length:
          requiredColumnCount - currentColumns,
      },
    });
  }

  /*
   * Write all records and clear obsolete
   * values in one batch request.
   *
   * Formatting is preserved because only
   * userEnteredValue is modified.
   */
  requests.push({
    updateCells: {
      range: {
        sheetId,
        startRowIndex: 0,
        endRowIndex:
          requiredRowCount,
        startColumnIndex: 0,
        endColumnIndex:
          requiredColumnCount,
      },

      rows: rowData,

      fields: "userEnteredValue",
    },
  });

  /*
   * Submit as one batch.
   */
  try {
    await executeWithRetry(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,

        requestBody: {
          requests,
        },
      }),
    );
  } finally {
    /*
     * Invalidate even if the result is
     * uncertain after network failure.
     */
    clearSheetCache(sheetName);
  }

  return records;
};
