import { google } from "googleapis";

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

const SPREADSHEET_ID =
  process.env.GOOGLE_LOGS_SHEET_ID ||
  "1tuqO1aiOskaQhmV4G5EN-Em-B-pp9hFdQcmh5eoBzUI";

function getSriLankaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getSriLankaTime() {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

async function ensureDailySheet(sheetName) {
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });

  const exists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetName,
  );

  if (exists) {
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
              gridProperties: {
                frozenRowCount: 1,
              },
            },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${sheetName}'!A1:H1`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          "Time",
          "User",
          "Method",
          "Module",
          "Action",
          "Details",
          "IP Address",
          "Status",
        ],
      ],
    },
  });
}

export async function writeActivityLog({
  user = "Unknown",
  method,
  module,
  action,
  details,
  ipAddress = "",
  status = "SUCCESS",
}) {
  try {
    const date = getSriLankaDate();
    const time = getSriLankaTime();

    await ensureDailySheet(date);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${date}'!A:H`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [
          [
            time,
            user,
            method,
            module,
            action,
            details,
            ipAddress,
            status,
          ],
        ],
      },
    });
  } catch (error) {
    console.error(
      "Google Sheets activity logging failed:",
      error.message,
    );
  }
}