import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

const PAYMENTS_SHEET = "Ortho_Payments";
const CASES_SHEET = "Ortho_Cases";

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

export const createOrthoPaymentService =
  async (caseId, payload) => {
    const amount = toNumber(payload.amount);

    if (amount <= 0) {
      throw new Error(
        "Payment amount must be greater than 0"
      );
    }

    const cases =
      (await readSheet(CASES_SHEET)) || [];

    const orthoCase = cases.find(
      (row) =>
        normalize(row.ortho_case_id) ===
        normalize(caseId)
    );

    if (!orthoCase) {
      throw new Error("Ortho case not found");
    }

    const payments =
      (await readSheet(PAYMENTS_SHEET)) || [];

    const paymentId = generateNextId(
      payments,
      "ortho_payment_id",
      "ORP"
    );

    const record = {
      ortho_payment_id: paymentId,
      ortho_case_id: caseId,

      ortho_visit_id: clean(
        payload.ortho_visit_id
      ),

      patient_id: orthoCase.patient_id,

      payment_date:
        clean(payload.payment_date) || todayISO(),

      amount,

      payment_method: clean(
        payload.payment_method
      ),

      payment_type: clean(payload.payment_type),

      receipt_no:
        clean(payload.receipt_no) ||
        `ORT-RCP-${paymentId.replace(
          "ORP_",
          ""
        )}`,

      notes: clean(payload.notes),

      recorded_by: clean(payload.recorded_by),

      created_at: nowISO(),
      updated_at: nowISO(),
    };

    payments.push(record);

    await writeSheet(PAYMENTS_SHEET, payments);

    return record;
  };

export const getOrthoPaymentsByCaseService =
  async (caseId) => {
    const payments =
      (await readSheet(PAYMENTS_SHEET)) || [];

    const results = payments.filter(
      (row) =>
        normalize(row.ortho_case_id) ===
        normalize(caseId)
    );

    const totalPaid = results.reduce(
      (sum, row) => sum + toNumber(row.amount),
      0
    );

    return {
      payments: results,
      totalPaid,
    };
  };

export const getOrthoPaymentByIdService =
  async (paymentId) => {
    const payments =
      (await readSheet(PAYMENTS_SHEET)) || [];

    return (
      payments.find(
        (row) =>
          normalize(row.ortho_payment_id) ===
          normalize(paymentId)
      ) || null
    );
  };

export const updateOrthoPaymentService =
  async (paymentId, payload) => {
    const payments =
      (await readSheet(PAYMENTS_SHEET)) || [];

    const index = payments.findIndex(
      (row) =>
        normalize(row.ortho_payment_id) ===
        normalize(paymentId)
    );

    if (index === -1) {
      return null;
    }

    const protectedFields = [
      "ortho_payment_id",
      "ortho_case_id",
      "patient_id",
      "created_at",
    ];

    Object.entries(payload).forEach(
      ([key, value]) => {
        if (!protectedFields.includes(key)) {
          payments[index][key] =
            key === "amount"
              ? toNumber(value)
              : value;
        }
      }
    );

    if (toNumber(payments[index].amount) <= 0) {
      throw new Error(
        "Payment amount must be greater than 0"
      );
    }

    payments[index].updated_at = nowISO();

    await writeSheet(PAYMENTS_SHEET, payments);

    return payments[index];
  };

export const deleteOrthoPaymentService =
  async (paymentId) => {
    const payments =
      (await readSheet(PAYMENTS_SHEET)) || [];

    const index = payments.findIndex(
      (row) =>
        normalize(row.ortho_payment_id) ===
        normalize(paymentId)
    );

    if (index === -1) {
      return null;
    }

    const [deleted] = payments.splice(index, 1);

    await writeSheet(PAYMENTS_SHEET, payments);

    return deleted;
  };