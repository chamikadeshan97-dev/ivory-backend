import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "dental_clinic_database.xlsx");

export const EXCEL_FILE_PATH =
  process.env.EXCEL_FILE_PATH ||
  path.resolve(
    process.cwd(),
    "data",
    "dental_clinic_database.xlsx",
  );

const SHEETS = {
  Users: [
    "id",
    "name",
    "username",
    "password_hash",
    "role",
    "status",
    "created_at",
    "updated_at",
  ],
  Patients: [
    "id",
    "name",
    "phone",
    "age",
    "gender",
    "address",
    "is_allergies",
    "allergies",
    "location",
    "distance",
    "created_at",
    "updated_at",
  ],
  DailyQueue: [
    "id",
    "queue_date",
    "queue_no",
    "appointment_id",
    "patient_id",
    "dentist_id",
    "patient_name",
    "phone",
    "reason_for_visit",
    "source",
    "status",
    "arrived_at",
    "called_at",
    "completed_at",
    "created_at",
    "updated_at",
  ],
  Dentists: [
    "id",
    "name",
    "phone",
    "specialization",
    "created_at",
    "updated_at",
  ],
  InWaiting: [
    "id", //appoinment id
    "start_time",
    "end_time",
  ],
  Appointments: [
    "id",
    "patient_id",
    "dentist_id",
    "appointment_number",
    "appointment_date",
    "appointment_time",
    "reason_for_visit",
    "status",
    "created_at",
    "updated_at",
    "checked_in_time",
  ],

  Common_Treatments: [
    "id",
    "treatment_name",
    "fee",
    "created_at",
    "updated_at",
  ],
  Treatments: [
    "id",
    "patient_id",
    "appointment_id",
    "dentist_id",
    "doctor_notes",
    "diagnosis",
    "tooth_number",
    "treatment_details",
    "treatment_fee",
    "prescription",
    "next_appointment_date",
    "treatment_date",
    "created_at",
    "updated_at",
  ],
  Payments: [
    "id",
    "patient_id",
    "treatment_id",
    "treatment_charge",
    "payment_amount",
    "previously_paid",
    "total_paid",
    "remaining_amount",
    "payment_method",
    "payment_date",
    "receipt_number",
    "status",
    "created_at",
    "updated_at",
  ],
  Drugs: ["id", "name"],
  Locations: ["id", "location", "distance_km"],
};

export function ensureDatabase() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let workbook;

  if (fs.existsSync(DB_FILE)) {
    workbook = XLSX.readFile(DB_FILE);
  } else {
    workbook = XLSX.utils.book_new();
  }

  let changed = false;

  Object.keys(SHEETS).forEach((sheetName) => {
    if (!workbook.SheetNames.includes(sheetName)) {
      const worksheet = XLSX.utils.json_to_sheet([], {
        header: SHEETS[sheetName],
      });

      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      changed = true;
    }
  });

  if (changed || !fs.existsSync(DB_FILE)) {
    XLSX.writeFile(workbook, DB_FILE);
  }
}

function getWorkbook() {
  ensureDatabase();
  return XLSX.readFile(DB_FILE);
}

export function readSheet(sheetName) {
  const workbook = getWorkbook();
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json(worksheet, {
    defval: "",
  });
}

export function readSheets(sheetNames = []) {
  const workbook = getWorkbook();
  const result = {};

  sheetNames.forEach((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];

    result[sheetName] = worksheet
      ? XLSX.utils.sheet_to_json(worksheet, { defval: "" })
      : [];
  });

  return result;
}

export function writeSheet(sheetName, rows) {
  const workbook = getWorkbook();

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: SHEETS[sheetName],
  });

  workbook.Sheets[sheetName] = worksheet;

  if (!workbook.SheetNames.includes(sheetName)) {
    workbook.SheetNames.push(sheetName);
  }

  XLSX.writeFile(workbook, DB_FILE);
}
