import { readSheet, writeSheet } from "../utils/googleSheets.js";

const SHEET = "Ortho_Cases";
const PATIENTS_SHEET = "Patients";
const ORTHO_PAYMENTS_SHEET = "Ortho_Payments";
const protectedFields = ["ortho_case_id", "patient_id", "created_at"];

const clean = (value) => String(value ?? "").trim();

const normalize = (value) => clean(value).toLowerCase();

const nowISO = () => new Date().toISOString();

const todayISO = () => new Date().toISOString().split("T")[0];

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const generateNextId = (rows, fieldName, prefix) => {
  let max = 0;

  rows.forEach((row) => {
    const id = clean(row?.[fieldName]);

    if (!id.startsWith(`${prefix}_`)) {
      return;
    }

    const number = Number(id.replace(`${prefix}_`, ""));

    if (Number.isFinite(number) && number > max) {
      max = number;
    }
  });

  return `${prefix}_${String(max + 1).padStart(4, "0")}`;
};

export const createOrthoCaseService = async (payload) => {
  const cases = (await readSheet(SHEET)) || [];

  const record = {
    ortho_case_id: generateNextId(cases, "ortho_case_id", "ORT"),

    patient_id: clean(payload.patient_id),
    dentist_id: clean(payload.dentist_id),

    start_date: clean(payload.start_date) || todayISO(),

    treatment_type: clean(payload.treatment_type),

    treatment_area: clean(payload.treatment_area),

    diagnosis: clean(payload.diagnosis),

    estimated_duration: clean(payload.estimated_duration),

    total_treatment_fee: toNumber(payload.total_treatment_fee),

    payment_plan: clean(payload.payment_plan),

    monthly_payment: toNumber(payload.monthly_payment),

    next_visit_date: clean(payload.next_visit_date),

    status: "Active",

    notes: clean(payload.notes),

    completed_date: "",

    created_at: nowISO(),
    updated_at: nowISO(),
  };

  cases.push(record);

  await writeSheet(SHEET, cases);

  return record;
};

/* ========================================================
   GET ALL ORTHO CASES WITH PATIENT DETAILS
======================================================== */

/* ========================================================
   SHEET CONFIGURATION
======================================================== */

/* ========================================================
   PAYMENT HELPERS
======================================================== */

const getPaymentAmount = (payment) => {
  return toNumber(
    payment.payment_amount ?? payment.amount ?? payment.paid_amount ?? 0,
  );
};

/* ========================================================
   GET ALL ORTHO CASES WITH PATIENTS AND PAYMENTS
======================================================== */

export const getAllOrthoCasesService = async (filters = {}) => {
  /* ======================================================
     LOAD ALL THREE SHEETS
  ====================================================== */

  const [caseData, patientData, paymentData] = await Promise.all([
    readSheet(SHEET),
    readSheet(PATIENTS_SHEET),
    readSheet(ORTHO_PAYMENTS_SHEET),
  ]);

  let cases = Array.isArray(caseData) ? caseData : [];

  const patients = Array.isArray(patientData) ? patientData : [];

  const payments = Array.isArray(paymentData) ? paymentData : [];

  /* ======================================================
     CREATE PATIENT LOOKUP
  ====================================================== */

  const patientMap = new Map();

  patients.forEach((patient) => {
    const patientId = normalize(patient.patient_id || patient.id);

    if (patientId) {
      patientMap.set(patientId, patient);
    }
  });

  /* ======================================================
     CALCULATE TOTAL PAID FOR EACH ORTHO CASE
  ====================================================== */

  const paymentsMap = new Map();

  payments.forEach((payment) => {
    const caseId = normalize(payment.ortho_case_id);

    if (!caseId) {
      return;
    }

    const amount = getPaymentAmount(payment);

    const previousTotal = paymentsMap.get(caseId) || 0;

    paymentsMap.set(caseId, previousTotal + amount);
  });

  /* ======================================================
     COMBINE CASE + PATIENT + PAYMENT DATA
  ====================================================== */

  cases = cases.map((item) => {
    const caseId = normalize(item.ortho_case_id);

    const patientId = normalize(item.patient_id);

    const patient = patientMap.get(patientId);

    const totalFee = toNumber(item.total_treatment_fee);

    const totalPaid = paymentsMap.get(caseId) || 0;

    const balance = Math.max(totalFee - totalPaid, 0);

    return {
      ...item,

      patient_name: patient ? clean(patient.name || patient.patient_name) : "",

      patient_mobile: patient
        ? clean(patient.phone || patient.mobile || patient.mobile_number)
        : "",

      total_treatment_fee: totalFee,

      total_paid: totalPaid,

      balance: balance,
    };
  });

  /* ======================================================
     STATUS FILTER
  ====================================================== */

  if (clean(filters.status)) {
    cases = cases.filter(
      (item) => normalize(item.status) === normalize(filters.status),
    );
  }

  /* ======================================================
     DENTIST FILTER
  ====================================================== */

  if (clean(filters.dentist_id)) {
    cases = cases.filter(
      (item) => normalize(item.dentist_id) === normalize(filters.dentist_id),
    );
  }

  /* ======================================================
     SEARCH FILTER
  ====================================================== */

  if (clean(filters.search)) {
    const keyword = normalize(filters.search);

    cases = cases.filter((item) =>
      Object.values(item).some((value) => normalize(value).includes(keyword)),
    );
  }

  /* ======================================================
     SORT BY LATEST UPDATED
  ====================================================== */

  cases.sort((a, b) => {
    const dateA = Date.parse(a.updated_at);
    const dateB = Date.parse(b.updated_at);

    const timeA = Number.isFinite(dateA) ? dateA : 0;
    const timeB = Number.isFinite(dateB) ? dateB : 0;

    return timeB - timeA;
  });

  return cases;
};

export const getOrthoCaseByIdService = async (caseId) => {
  const cases = (await readSheet(SHEET)) || [];

  return (
    cases.find((row) => normalize(row.ortho_case_id) === normalize(caseId)) ||
    null
  );
};

export const getOrthoCasesByPatientService = async (patientId) => {
  const cases = (await readSheet(SHEET)) || [];

  return cases.filter(
    (row) => normalize(row.patient_id) === normalize(patientId),
  );
};
//ortho_case_id	patient_id	dentist_id	start_date	treatment_type	treatment_area	diagnosis	estimated_duration	total_treatment_fee	payment_plan	monthly_payment	next_visit_date	status	notes	completed_date	created_at	updated_at
export const updateOrthoCaseService = async (caseId, payload) => {
  const cases = (await readSheet(SHEET)) || [];

  const index = cases.findIndex(
    (row) => normalize(row.ortho_case_id) === normalize(caseId),
  );

  if (index === -1) {
    return null;
  }

  const protectedFields = ["ortho_case_id", "patient_id", "created_at"];

  Object.entries(payload).forEach(([key, value]) => {
    if (!protectedFields.includes(key)) {
      cases[index][key] = value;
    }
  });

  cases[index].updated_at = nowISO();

  await writeSheet(SHEET, cases);

  return cases[index];
};

export const updateOrthoCaseStatusService = async (caseId, status) => {
  const allowed = ["Active", "On Hold", "Completed", "Cancelled"];

  const matched = allowed.find((item) => normalize(item) === normalize(status));

  if (!matched) {
    throw new Error("Invalid Ortho status");
  }

  const cases = (await readSheet(SHEET)) || [];

  const index = cases.findIndex(
    (row) => normalize(row.ortho_case_id) === normalize(caseId),
  );

  if (index === -1) {
    return null;
  }

  cases[index] = {
    ...cases[index],
    status: matched,
    completed_date: matched === "Completed" ? todayISO() : "",
    updated_at: nowISO(),
  };

  await writeSheet(SHEET, cases);

  return cases[index];
};

/* ========================================================
   PERMANENTLY DELETE ORTHO CASE RECORD
======================================================== */

export const deleteOrthoCaseRecordService = async (caseId) => {
  const normalizedCaseId = normalize(caseId);

  /* ----------------------------------------------------
     VALIDATE CASE ID
  ---------------------------------------------------- */

  if (!normalizedCaseId) {
    throw new Error("Ortho case ID is required");
  }

  /* ----------------------------------------------------
     READ ORTHO CASES
  ---------------------------------------------------- */

  const cases = (await readSheet(SHEET)) || [];

  /* ----------------------------------------------------
     FIND CASE
  ---------------------------------------------------- */

  const caseIndex = cases.findIndex(
    (row) => normalize(row.ortho_case_id) === normalizedCaseId,
  );

  if (caseIndex === -1) {
    return null;
  }

  /* ----------------------------------------------------
     PRESERVE CASE DETAILS
  ---------------------------------------------------- */

  const deletedCase = { ...cases[caseIndex] };

  /* ----------------------------------------------------
     REMOVE CASE
  ---------------------------------------------------- */

  const updatedCases = cases.filter(
    (row) => normalize(row.ortho_case_id) !== normalizedCaseId,
  );

  /* ----------------------------------------------------
     UPDATE GOOGLE SHEET
  ---------------------------------------------------- */

  await writeSheet(SHEET, updatedCases);

  /* ----------------------------------------------------
     RESULT
  ---------------------------------------------------- */

  return {
    case_id: deletedCase.ortho_case_id,

    patient_id: deletedCase.patient_id,

    dentist_id: deletedCase.dentist_id,

    deleted: true,

    deleted_at: nowISO(),
  };
};
