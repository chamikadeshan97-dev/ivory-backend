import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import {
  createId,
  now,
  today,
} from "../utils/helpers.js";

import appError from "../utils/appError.js";

import {
  getTreatmentPaymentSummary,
} from "./treatment.service.js";

const PAYMENTS_SHEET = "Payments";
const PATIENTS_SHEET = "Patients";
const TREATMENTS_SHEET = "Treatments";

const VALID_PAYMENT_METHODS = [
  "Cash",
  "Card",
  "Bank Transfer",
  "Online",
];

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeId = (value) => {
  return normalizeText(value).toLowerCase();
};

const ensureArray = (value) => {
  return Array.isArray(value)
    ? value
    : [];
};

const normalizeNumber = (
  value,
  fallback = 0,
) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
};

const normalizePayment = (payment) => {
  return {
    id: normalizeText(payment?.id),
    patient_id: normalizeText(
      payment?.patient_id,
    ),
    treatment_id: normalizeText(
      payment?.treatment_id,
    ),
    treatment_charge:
      normalizeNumber(
        payment?.treatment_charge,
      ),
    payment_amount:
      normalizeNumber(
        payment?.payment_amount,
      ),
    previously_paid:
      normalizeNumber(
        payment?.previously_paid,
      ),
    total_paid:
      normalizeNumber(
        payment?.total_paid,
      ),
    remaining_amount:
      normalizeNumber(
        payment?.remaining_amount,
      ),
    installment_number:
      normalizeNumber(
        payment?.installment_number,
      ),
    payment_method: normalizeText(
      payment?.payment_method,
    ),
    payment_date: normalizeText(
      payment?.payment_date,
    ),
    receipt_number: normalizeText(
      payment?.receipt_number,
    ),
    status: normalizeText(
      payment?.status,
    ),
    created_at: normalizeText(
      payment?.created_at,
    ),
    updated_at: normalizeText(
      payment?.updated_at,
    ),
  };
};

const normalizeTreatment = (
  treatment,
) => {
  return {
    ...treatment,
    id: normalizeText(
      treatment?.id,
    ),
    patient_id: normalizeText(
      treatment?.patient_id,
    ),
  };
};

const normalizePaymentMethod = (
  value,
) => {
  const method =
    normalizeText(value);

  return (
    VALID_PAYMENT_METHODS.find(
      (validMethod) =>
        validMethod.toLowerCase() ===
        method.toLowerCase(),
    ) || ""
  );
};

/*
|--------------------------------------------------------------------------
| Create Payment
|--------------------------------------------------------------------------
*/

export async function createPayment(
  data = {},
) {
  const {
    patient_id,
    treatment_id,
    payment_amount,
    payment_method,
    payment_date,
    receipt_number,
  } = data;

  const patientId =
    normalizeText(patient_id);

  const treatmentId =
    normalizeText(treatment_id);

  const paymentMethod =
    normalizePaymentMethod(
      payment_method,
    );

  if (
    !patientId ||
    !treatmentId ||
    payment_amount === undefined ||
    payment_amount === null ||
    payment_amount === "" ||
    !normalizeText(payment_method)
  ) {
    throw appError(
      "Patient, treatment, payment amount, and method are required",
      400,
    );
  }

  const patientRows =
    await readSheet(
      PATIENTS_SHEET,
    );

  const patients =
    ensureArray(patientRows);

  const patientExists =
    patients.some((patient) => {
      return (
        normalizeId(patient?.id) ===
        normalizeId(patientId)
      );
    });

  if (!patientExists) {
    throw appError(
      "Patient not found",
      404,
    );
  }

  const treatmentRows =
    await readSheet(
      TREATMENTS_SHEET,
    );

  const treatments =
    ensureArray(treatmentRows)
      .map(normalizeTreatment);

  const treatment =
    treatments.find((item) => {
      return (
        normalizeId(item.id) ===
        normalizeId(treatmentId)
      );
    });

  if (!treatment) {
    throw appError(
      "Treatment not found",
      404,
    );
  }

  if (
    normalizeId(
      treatment.patient_id,
    ) !== normalizeId(patientId)
  ) {
    throw appError(
      "The treatment does not belong to this patient",
      400,
    );
  }

  const amount =
    Number(payment_amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw appError(
      "Payment amount must be a valid number greater than 0",
      400,
    );
  }

  if (!paymentMethod) {
    throw appError(
      `Invalid payment method. Use ${VALID_PAYMENT_METHODS.join(
        ", ",
      )}`,
      400,
    );
  }

  /*
   * Search all previous installments
   * using treatment_id.
   */
  const paymentSummary =
    await getTreatmentPaymentSummary(
      treatment.id,
    );

  const treatmentCharge =
    normalizeNumber(
      paymentSummary?.treatment_charge,
    );

  const previouslyPaid =
    normalizeNumber(
      paymentSummary?.total_paid,
    );

  const remainingAmount =
    normalizeNumber(
      paymentSummary?.remaining_amount,
      Math.max(
        treatmentCharge -
          previouslyPaid,
        0,
      ),
    );

  const installmentCount =
    normalizeNumber(
      paymentSummary?.installment_count,
    );

  if (treatmentCharge <= 0) {
    throw appError(
      "Treatment charge must be greater than 0 before recording a payment",
      400,
    );
  }

  if (remainingAmount <= 0) {
    throw appError(
      "This treatment has already been fully paid",
      409,
    );
  }

  if (amount > remainingAmount) {
    throw appError(
      `Payment amount cannot exceed the remaining amount of Rs. ${remainingAmount.toFixed(
        2,
      )}`,
      400,
    );
  }

  const totalPaid =
    previouslyPaid + amount;

  const newRemainingAmount =
    Math.max(
      treatmentCharge -
        totalPaid,
      0,
    );

  const status =
    newRemainingAmount <= 0
      ? "Paid"
      : "Partial";

  const paymentRows =
    await readSheet(
      PAYMENTS_SHEET,
    );

  const payments =
    ensureArray(paymentRows)
      .map(normalizePayment);

  const newPayment = {
    id: createId("PAY"),
    patient_id:
      treatment.patient_id,
    treatment_id:
      treatment.id,
    treatment_charge:
      treatmentCharge,

    /*
     * This installment only.
     */
    payment_amount:
      amount,

    /*
     * Payment totals at the time
     * this installment was made.
     */
    previously_paid:
      previouslyPaid,
    total_paid:
      totalPaid,
    remaining_amount:
      newRemainingAmount,

    installment_number:
      installmentCount + 1,

    payment_method:
      paymentMethod,

    payment_date:
      normalizeText(
        payment_date,
      ) || today(),

    receipt_number:
      normalizeText(
        receipt_number,
      ) ||
      `REC-${Date.now()}`,

    status,
    created_at: now(),
    updated_at: now(),
  };

  /*
   * Never replace an existing payment.
   * Add this installment as a new row.
   */
  payments.push(newPayment);

  await writeSheet(
    PAYMENTS_SHEET,
    payments,
  );

  return {
    payment: newPayment,

    summary: {
      treatment_id:
        treatment.id,
      treatment_charge:
        treatmentCharge,
      previously_paid:
        previouslyPaid,
      current_payment:
        amount,
      total_paid:
        totalPaid,
      remaining_amount:
        newRemainingAmount,
      payment_status:
        status,
      installment_count:
        installmentCount + 1,
    },
  };
}

/*
|--------------------------------------------------------------------------
| Get Payments
|--------------------------------------------------------------------------
*/

export async function getPayments(
  filters = {},
) {
  const patientId =
    normalizeText(
      filters.patient_id,
    );

  const treatmentId =
    normalizeText(
      filters.treatment_id,
    );

  const date =
    normalizeText(
      filters.date,
    );

  const status =
    normalizeText(
      filters.status,
    );

  const paymentRows =
    await readSheet(
      PAYMENTS_SHEET,
    );

  let payments =
    ensureArray(paymentRows)
      .map(normalizePayment)
      .filter(
        (payment) =>
          payment.id &&
          payment.patient_id &&
          payment.treatment_id,
      );

  if (patientId) {
    payments = payments.filter(
      (payment) => {
        return (
          normalizeId(
            payment.patient_id,
          ) ===
          normalizeId(patientId)
        );
      },
    );
  }

  if (treatmentId) {
    payments = payments.filter(
      (payment) => {
        return (
          normalizeId(
            payment.treatment_id,
          ) ===
          normalizeId(treatmentId)
        );
      },
    );
  }

  if (date) {
    payments = payments.filter(
      (payment) => {
        return (
          normalizeText(
            payment.payment_date,
          ) === date
        );
      },
    );
  }

  if (status) {
    payments = payments.filter(
      (payment) => {
        return (
          normalizeText(
            payment.status,
          ).toLowerCase() ===
          status.toLowerCase()
        );
      },
    );
  }

  payments.sort(
    (firstPayment, secondPayment) => {
      const firstDate = String(
        firstPayment.created_at ||
          firstPayment.payment_date ||
          "",
      );

      const secondDate = String(
        secondPayment.created_at ||
          secondPayment.payment_date ||
          "",
      );

      return secondDate.localeCompare(
        firstDate,
      );
    },
  );

  return payments;
}