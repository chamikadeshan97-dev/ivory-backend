import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

const VISITS_SHEET = "Ortho_Visits";
const CASES_SHEET = "Ortho_Cases";

const clean = (value) => String(value ?? "").trim();
const normalize = (value) =>
  clean(value).toLowerCase();

const nowISO = () => new Date().toISOString();

const todayISO = () =>
  new Date().toISOString().split("T")[0];

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

export const createOrthoVisitService = async (
  caseId,
  payload
) => {
  const cases = (await readSheet(CASES_SHEET)) || [];

  const caseIndex = cases.findIndex(
    (row) =>
      normalize(row.ortho_case_id) ===
      normalize(caseId)
  );

  if (caseIndex === -1) {
    throw new Error("Ortho case not found");
  }

  const orthoCase = cases[caseIndex];

  const visits =
    (await readSheet(VISITS_SHEET)) || [];

  const caseVisits = visits.filter(
    (row) =>
      normalize(row.ortho_case_id) ===
      normalize(caseId)
  );

  const record = {
    ortho_visit_id: generateNextId(
      visits,
      "ortho_visit_id",
      "ORV"
    ),

    ortho_case_id: caseId,
    patient_id: orthoCase.patient_id,

    appointment_id: clean(
      payload.appointment_id
    ),

    dentist_id:
      clean(payload.dentist_id) ||
      clean(orthoCase.dentist_id),

    visit_number: caseVisits.length + 1,

    visit_date:
      clean(payload.visit_date) || todayISO(),

    procedure: clean(payload.procedure),

    clinical_notes: clean(
      payload.clinical_notes
    ),

    appliance_changes: clean(
      payload.appliance_changes
    ),

    elastics: clean(payload.elastics),

    next_visit_date: clean(
      payload.next_visit_date
    ),

    next_visit_plan: clean(
      payload.next_visit_plan
    ),

    created_at: nowISO(),
    updated_at: nowISO(),
  };

  visits.push(record);

  await writeSheet(VISITS_SHEET, visits);

  if (record.next_visit_date) {
    cases[caseIndex].next_visit_date =
      record.next_visit_date;

    cases[caseIndex].updated_at = nowISO();

    await writeSheet(CASES_SHEET, cases);
  }

  return record;
};

export const getOrthoVisitsByCaseService =
  async (caseId) => {
    const visits =
      (await readSheet(VISITS_SHEET)) || [];

    return visits
      .filter(
        (row) =>
          normalize(row.ortho_case_id) ===
          normalize(caseId)
      )
      .sort(
        (a, b) =>
          Number(a.visit_number || 0) -
          Number(b.visit_number || 0)
      );
  };

export const getOrthoVisitByIdService = async (
  visitId
) => {
  const visits =
    (await readSheet(VISITS_SHEET)) || [];

  return (
    visits.find(
      (row) =>
        normalize(row.ortho_visit_id) ===
        normalize(visitId)
    ) || null
  );
};

export const updateOrthoVisitService = async (
  visitId,
  payload
) => {
  const visits =
    (await readSheet(VISITS_SHEET)) || [];

  const index = visits.findIndex(
    (row) =>
      normalize(row.ortho_visit_id) ===
      normalize(visitId)
  );

  if (index === -1) {
    return null;
  }

  const protectedFields = [
    "ortho_visit_id",
    "ortho_case_id",
    "patient_id",
    "visit_number",
    "created_at",
  ];

  Object.entries(payload).forEach(
    ([key, value]) => {
      if (!protectedFields.includes(key)) {
        visits[index][key] = value;
      }
    }
  );

  visits[index].updated_at = nowISO();

  await writeSheet(VISITS_SHEET, visits);

  return visits[index];
};

export const deleteOrthoVisitService = async (
  visitId
) => {
  const visits =
    (await readSheet(VISITS_SHEET)) || [];

  const index = visits.findIndex(
    (row) =>
      normalize(row.ortho_visit_id) ===
      normalize(visitId)
  );

  if (index === -1) {
    return null;
  }

  const [deleted] = visits.splice(index, 1);

  await writeSheet(VISITS_SHEET, visits);

  return deleted;
};