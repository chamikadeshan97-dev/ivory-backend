import { google } from "googleapis";

/* ========================================================
   Environment configuration
======================================================== */

const spreadsheetId = String(process.env.GOOGLE_SHEET_ID ?? "").trim();

const clientEmail = String(process.env.GOOGLE_CLIENT_EMAIL ?? "").trim();

const formatPrivateKey = (value) => {
  let privateKey = String(value ?? "").trim();

  /*
   * Remove quotation marks accidentally copied into
   * Render environment variables.
   */
  if (
    (privateKey.startsWith('"') && privateKey.endsWith('"')) ||
    (privateKey.startsWith("'") && privateKey.endsWith("'"))
  ) {
    privateKey = privateKey.slice(1, -1);
  }

  /*
   * Convert literal \n characters from environment
   * variables into real line breaks.
   */
  privateKey = privateKey.replace(/\\n/g, "\n");

  /*
   * Some copied JSON values may contain escaped quotes.
   */
  privateKey = privateKey.replace(/\\"/g, '"');

  return privateKey.trim();
};

const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

const validateGoogleConfiguration = () => {
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  if (!clientEmail) {
    throw new Error("GOOGLE_CLIENT_EMAIL is not configured");
  }

  if (!privateKey) {
    throw new Error("GOOGLE_PRIVATE_KEY is not configured");
  }

  if (
    !privateKey.includes("-----BEGIN PRIVATE KEY-----") ||
    !privateKey.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error("GOOGLE_PRIVATE_KEY has an invalid format");
  }
};

validateGoogleConfiguration();

/* ========================================================
   Google Sheets client
======================================================== */

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({
  version: "v4",
  auth,
});

/* ========================================================
   General helpers
======================================================== */

const escapeSheetName = (sheetName) => {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
};

const normalizeHeader = (header) => {
  return String(header ?? "").trim();
};

const ensureSheetName = (sheetName) => {
  const value = String(sheetName ?? "").trim();

  if (!value) {
    throw new Error("Google Sheet tab name is required");
  }

  return value;
};

/* ========================================================
   Test Google connection
======================================================== */

export const testGoogleSheetsConnection = async () => {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,properties.title,sheets.properties.title",
  });

  return {
    spreadsheet_id: response.data.spreadsheetId,

    spreadsheet_title: response.data.properties?.title ?? "",

    sheets: response.data.sheets?.map((sheet) => sheet.properties?.title) ?? [],
  };
};

/* ========================================================
   Read all records
======================================================== */

export const readSheet = async (sheetName) => {
  const validSheetName = ensureSheetName(sheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,

    range: `${escapeSheetName(validSheetName)}!A:ZZ`,
  });

  const rows = response.data.values ?? [];

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  return rows
    .slice(1)
    .filter((row) => {
      return row.some((cell) => {
        return String(cell ?? "").trim();
      });
    })
    .map((row) => {
      return headers.reduce((record, header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }

        return record;
      }, {});
    });
};

/* ========================================================
   Append one record
======================================================== */

export const appendRow = async (sheetName, data = {}) => {
  const validSheetName = ensureSheetName(sheetName);

  const escapedSheetName = escapeSheetName(validSheetName);

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedSheetName}!1:1`,
  });

  const headers = (headerResponse.data.values?.[0] ?? []).map(normalizeHeader);

  if (!headers.length) {
    throw new Error(`No headers found in sheet: ${validSheetName}`);
  }

  const rowValues = headers.map((header) => {
    return data?.[header] ?? "";
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId,

    range: `${escapedSheetName}!A:ZZ`,

    valueInputOption: "RAW",

    insertDataOption: "INSERT_ROWS",

    requestBody: {
      values: [rowValues],
    },
  });

  return data;
};

/* ========================================================
   Update a record by ID
======================================================== */

export const updateRowById = async (
  sheetName,
  id,
  updates = {},
  idColumn = "id",
) => {
  const validSheetName = ensureSheetName(sheetName);

  const escapedSheetName = escapeSheetName(validSheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedSheetName}!A:ZZ`,
  });

  const rows = response.data.values ?? [];

  if (!rows.length) {
    throw new Error(`Sheet is empty: ${validSheetName}`);
  }

  const headers = rows[0].map(normalizeHeader);

  const idColumnIndex = headers.indexOf(idColumn);

  if (idColumnIndex === -1) {
    throw new Error(
      `Column "${idColumn}" was not found in sheet "${validSheetName}"`,
    );
  }

  const dataRowIndex = rows.findIndex((row, index) => {
    return (
      index > 0 &&
      String(row[idColumnIndex] ?? "").trim() === String(id ?? "").trim()
    );
  });

  if (dataRowIndex === -1) {
    return null;
  }

  const existingRow = rows[dataRowIndex];

  const updatedRow = headers.map((header, columnIndex) => {
    if (Object.prototype.hasOwnProperty.call(updates, header)) {
      return updates[header] ?? "";
    }

    return existingRow[columnIndex] ?? "";
  });

  /*
   * Array index 1 represents Google Sheets row 2,
   * so adding 1 gives the actual sheet row.
   */
  const actualSheetRow = dataRowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,

    range: `${escapedSheetName}!A${actualSheetRow}`,

    valueInputOption: "RAW",

    requestBody: {
      values: [updatedRow],
    },
  });

  return headers.reduce((record, header, index) => {
    if (header) {
      record[header] = updatedRow[index] ?? "";
    }

    return record;
  }, {});
};

/* ========================================================
   Delete a record by ID
======================================================== */

export const deleteRowById = async (sheetName, id, idColumn = "id") => {
  const validSheetName = ensureSheetName(sheetName);

  const escapedSheetName = escapeSheetName(validSheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedSheetName}!A:ZZ`,
  });

  const rows = response.data.values ?? [];

  if (!rows.length) {
    return false;
  }

  const headers = rows[0].map(normalizeHeader);

  const idColumnIndex = headers.indexOf(idColumn);

  if (idColumnIndex === -1) {
    throw new Error(
      `Column "${idColumn}" was not found in sheet "${validSheetName}"`,
    );
  }

  const dataRowIndex = rows.findIndex((row, index) => {
    return (
      index > 0 &&
      String(row[idColumnIndex] ?? "").trim() === String(id ?? "").trim()
    );
  });

  if (dataRowIndex === -1) {
    return false;
  }

  const actualSheetRow = dataRowIndex + 1;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,

    range: `${escapedSheetName}!` + `A${actualSheetRow}:ZZ${actualSheetRow}`,
  });

  return true;
};

/* ========================================================
   Replace all records
======================================================== */

export const writeSheet = async (sheetName, data = []) => {
  const validSheetName = ensureSheetName(sheetName);

  if (!Array.isArray(data)) {
    throw new TypeError("writeSheet data must be an array");
  }

  const escapedSheetName = escapeSheetName(validSheetName);

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapedSheetName}!1:1`,
  });

  const headers = (headerResponse.data.values?.[0] ?? []).map(normalizeHeader);

  if (!headers.length) {
    throw new Error(`No headers found in sheet: ${validSheetName}`);
  }

  const values = data.map((record) => {
    return headers.map((header) => {
      return record?.[header] ?? "";
    });
  });

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapedSheetName}!A2:ZZ`,
  });

  if (!values.length) {
    return [];
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,

    range: `${escapedSheetName}!A2`,

    valueInputOption: "RAW",

    requestBody: {
      values,
    },
  });

  return data;
};

export default {
  testGoogleSheetsConnection,
  readSheet,
  appendRow,
  updateRowById,
  deleteRowById,
  writeSheet,
};
