import { google } from "googleapis";

const spreadsheetId = process.env.GOOGLE_SHEET_ID ;

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

const escapeSheetName = (sheetName) => {
  return `'${String(sheetName).replace(/'/g, "''")}'`;
};

const normalizeHeader = (header) => String(header || "").trim();

/**
 * Read a Google Sheet tab and return objects.
 *
 * Example:
 * [
 *   { id: "PAT_0001", name: "Nimal", phone: "071..." }
 * ]
 */
export const readSheet = async (sheetName) => {
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A:ZZ`,
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);

  return rows
    .slice(1)
    .filter((row) => String(row[0] || "").trim())
    .map((row) => {
      const record = {};

      headers.forEach((header, index) => {
        if (header) {
          record[header] = row[index] ?? "";
        }
      });

      return record;
    });
};

/**
 * Add one new object to the end of a Sheet.
 */
export const appendRow = async (sheetName, data) => {
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!1:1`,
  });

  const headers = (headerResponse.data.values?.[0] || []).map(normalizeHeader);

  if (!headers.length) {
    throw new Error(`No headers found in sheet: ${sheetName}`);
  }

  const rowValues = headers.map((header) => data[header] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A:ZZ`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [rowValues],
    },
  });

  return data;
};

/**
 * Update an existing record by its ID.
 */
export const updateRowById = async (
  sheetName,
  id,
  updates,
  idColumn = "id",
) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A:ZZ`,
  });

  const rows = response.data.values || [];

  if (rows.length === 0) {
    throw new Error(`Sheet is empty: ${sheetName}`);
  }

  const headers = rows[0].map(normalizeHeader);
  const idColumnIndex = headers.indexOf(idColumn);

  if (idColumnIndex === -1) {
    throw new Error(
      `Column "${idColumn}" was not found in sheet "${sheetName}"`,
    );
  }

  const dataRowIndex = rows.findIndex(
    (row, index) =>
      index > 0 && String(row[idColumnIndex] || "") === String(id),
  );

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

  // Google Sheet rows start from 1.
  const actualSheetRow = dataRowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A${actualSheetRow}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [updatedRow],
    },
  });

  return headers.reduce((record, header, index) => {
    record[header] = updatedRow[index] ?? "";
    return record;
  }, {});
};

/**
 * Clear a record by ID.
 *
 * This leaves an empty row in the Sheet, but readSheet()
 * automatically ignores it.
 */
export const deleteRowById = async (
  sheetName,
  id,
  idColumn = "id",
) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A:ZZ`,
  });

  const rows = response.data.values || [];

  if (!rows.length) {
    return false;
  }

  const headers = rows[0].map(normalizeHeader);
  const idColumnIndex = headers.indexOf(idColumn);

  if (idColumnIndex === -1) {
    throw new Error(
      `Column "${idColumn}" was not found in sheet "${sheetName}"`,
    );
  }

  const dataRowIndex = rows.findIndex(
    (row, index) =>
      index > 0 && String(row[idColumnIndex] || "") === String(id),
  );

  if (dataRowIndex === -1) {
    return false;
  }

  const actualSheetRow = dataRowIndex + 1;

  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapeSheetName(sheetName)}!A${actualSheetRow}:ZZ${actualSheetRow}`,
  });

  return true;
};


/**
 * Replace all data rows in a Google Sheet tab.
 *
 * Row 1 remains as the header row.
 */
export const writeSheet = async (sheetName, data = []) => {
  if (!spreadsheetId) {
    throw new Error("GOOGLE_SHEET_ID is not configured");
  }

  if (!Array.isArray(data)) {
    throw new TypeError("writeSheet data must be an array");
  }

  const escapedSheetName = escapeSheetName(sheetName);

  const headerResponse =
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${escapedSheetName}!1:1`,
    });

  const headers = (
    headerResponse.data.values?.[0] || []
  ).map(normalizeHeader);

  if (!headers.length) {
    throw new Error(
      `No headers found in sheet: ${sheetName}`,
    );
  }

  const values = data.map((record) =>
    headers.map((header) => record?.[header] ?? ""),
  );

  /*
   * Remove all old data but keep row 1 headers.
   */
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${escapedSheetName}!A2:ZZ`,
  });

  /*
   * When the array is empty, clearing the old rows is enough.
   */
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