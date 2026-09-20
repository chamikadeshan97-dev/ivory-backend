import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

const SHEET = "Ortho_Cases";

const clean = (value) => String(value ?? "").trim();

const normalize = (value) =>
  clean(value).toLowerCase();

const nowISO = () => new Date().toISOString();

const todayISO = () =>
  new Date().toISOString().split("T")[0];

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const generateNextId = (
  rows,
  fieldName,
  prefix
) => {
  let max = 0;

  rows.forEach((row) => {
    const id = clean(row?.[fieldName]);

    if (!id.startsWith(`${prefix}_`)) {
      return;
    }

    const number = Number(
      id.replace(`${prefix}_`, "")
    );

    if (Number.isFinite(number) && number > max) {
      max = number;
    }
  });

  return `${prefix}_${String(max + 1).padStart(
    4,
    "0"
  )}`;
};

export const createOrthoCaseService = async (
  payload
) => {
  const cases = (await readSheet(SHEET)) || [];

  const existing = cases.find(
    (row) =>
      normalize(row.patient_id) ===
        normalize(payload.patient_id) &&
      normalize(row.status) === "active"
  );

  if (existing) {
    throw new Error(
      "This patient already has an active Ortho case"
    );
  }

  const record = {
    ortho_case_id: generateNextId(
      cases,
      "ortho_case_id",
      "ORT"
    ),

    patient_id: clean(payload.patient_id),
    dentist_id: clean(payload.dentist_id),

    start_date:
      clean(payload.start_date) || todayISO(),

    treatment_type: clean(
      payload.treatment_type
    ),

    treatment_area: clean(
      payload.treatment_area
    ),

    diagnosis: clean(payload.diagnosis),

    estimated_duration: clean(
      payload.estimated_duration
    ),

    total_treatment_fee: toNumber(
      payload.total_treatment_fee
    ),

    payment_plan: clean(payload.payment_plan),

    monthly_payment: toNumber(
      payload.monthly_payment
    ),

    next_visit_date: clean(
      payload.next_visit_date
    ),

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

export const getAllOrthoCasesService = async (
  filters = {}
) => {
  let cases = (await readSheet(SHEET)) || [];

  if (clean(filters.status)) {
    cases = cases.filter(
      (row) =>
        normalize(row.status) ===
        normalize(filters.status)
    );
  }

  if (clean(filters.dentist_id)) {
    cases = cases.filter(
      (row) =>
        normalize(row.dentist_id) ===
        normalize(filters.dentist_id)
    );
  }

  if (clean(filters.search)) {
    const keyword = normalize(filters.search);

    cases = cases.filter((row) =>
      Object.values(row).some((value) =>
        normalize(value).includes(keyword)
      )
    );
  }

  return cases;
};

export const getOrthoCaseByIdService = async (
  caseId
) => {
  const cases = (await readSheet(SHEET)) || [];

  return (
    cases.find(
      (row) =>
        normalize(row.ortho_case_id) ===
        normalize(caseId)
    ) || null
  );
};

export const getOrthoCasesByPatientService =
  async (patientId) => {
    const cases = (await readSheet(SHEET)) || [];

    return cases.filter(
      (row) =>
        normalize(row.patient_id) ===
        normalize(patientId)
    );
  };

export const updateOrthoCaseService = async (
  caseId,
  payload
) => {
  const cases = (await readSheet(SHEET)) || [];

  const index = cases.findIndex(
    (row) =>
      normalize(row.ortho_case_id) ===
      normalize(caseId)
  );

  if (index === -1) {
    return null;
  }

  const protectedFields = [
    "ortho_case_id",
    "patient_id",
    "created_at",
  ];

  Object.entries(payload).forEach(
    ([key, value]) => {
      if (!protectedFields.includes(key)) {
        cases[index][key] = value;
      }
    }
  );

  cases[index].updated_at = nowISO();

  await writeSheet(SHEET, cases);

  return cases[index];
};

export const updateOrthoCaseStatusService =
  async (caseId, status) => {
    const allowed = [
      "Active",
      "On Hold",
      "Completed",
      "Cancelled",
    ];

    const matched = allowed.find(
      (item) =>
        normalize(item) === normalize(status)
    );

    if (!matched) {
      throw new Error("Invalid Ortho status");
    }

    const cases = (await readSheet(SHEET)) || [];

    const index = cases.findIndex(
      (row) =>
        normalize(row.ortho_case_id) ===
        normalize(caseId)
    );

    if (index === -1) {
      return null;
    }

    cases[index] = {
      ...cases[index],
      status: matched,
      completed_date:
        matched === "Completed" ? todayISO() : "",
      updated_at: nowISO(),
    };

    await writeSheet(SHEET, cases);

    return cases[index];
  };