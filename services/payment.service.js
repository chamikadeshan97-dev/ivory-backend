import { readSheet, writeSheet } from "../utils/excelDb.js";
import { createId, now, today } from "../utils/helpers.js";
import appError from "../utils/appError.js";
import { getTreatmentPaymentSummary } from "./treatment.service.js";

const VALID_PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Online"];

export function createPayment(data) {
  const {
    patient_id,
    treatment_id,
    payment_amount,
    payment_method,
    payment_date,
    receipt_number,
  } = data;

  if (
    !patient_id ||
    !treatment_id ||
    payment_amount === undefined ||
    payment_amount === null ||
    payment_amount === "" ||
    !payment_method
  ) {
    throw appError(
      "Patient, treatment, payment amount, and method are required",
      400,
    );
  }

  const patients = readSheet("Patients");

  const patientExists = patients.some(
    (patient) => String(patient.id).trim() === String(patient_id).trim(),
  );

  if (!patientExists) {
    throw appError("Patient not found", 404);
  }

  const treatments = readSheet("Treatments");

  const treatment = treatments.find(
    (item) => String(item.id).trim() === String(treatment_id).trim(),
  );

  if (!treatment) {
    throw appError("Treatment not found", 404);
  }

  if (String(treatment.patient_id).trim() !== String(patient_id).trim()) {
    throw appError("The treatment does not belong to this patient", 400);
  }

  const amount = Number(payment_amount);

  if (Number.isNaN(amount) || amount <= 0) {
    throw appError("Payment amount must be a valid number greater than 0", 400);
  }

  if (!VALID_PAYMENT_METHODS.includes(payment_method)) {
    throw appError(
      `Invalid payment method. Use ${VALID_PAYMENT_METHODS.join(", ")}`,
      400,
    );
  }

  /*
   * Search all previous installments using treatment_id.
   */
  const paymentSummary = getTreatmentPaymentSummary(treatment_id);

  const {
    treatment_charge: treatmentCharge,
    total_paid: previouslyPaid,
    remaining_amount: remainingAmount,
  } = paymentSummary;

  if (remainingAmount <= 0) {
    throw appError("This treatment has already been fully paid", 409);
  }

  if (amount > remainingAmount) {
    throw appError(
      `Payment amount cannot exceed the remaining amount of Rs. ${remainingAmount.toFixed(2)}`,
      400,
    );
  }

  const totalPaid = previouslyPaid + amount;

  const newRemainingAmount = Math.max(treatmentCharge - totalPaid, 0);

  const status = newRemainingAmount <= 0 ? "Paid" : "Partial";

  const payments = readSheet("Payments");

  const newPayment = {
    id: createId("PAY"),
    patient_id: treatment.patient_id,
    treatment_id: treatment.id,

    treatment_charge: treatmentCharge,

    /*
     * This installment only.
     */
    payment_amount: amount,

    /*
     * Payment totals at the time this installment was made.
     */
    previously_paid: previouslyPaid,
    total_paid: totalPaid,
    remaining_amount: newRemainingAmount,

    installment_number: paymentSummary.installment_count + 1,

    payment_method,
    payment_date: payment_date || today(),

    receipt_number: receipt_number || `REC-${Date.now()}`,

    status,
    created_at: now(),
    updated_at: now(),
  };

  /*
   * Never replace an existing payment.
   * Add this installment as a new row.
   */
  payments.push(newPayment);

  writeSheet("Payments", payments);

  return {
    payment: newPayment,

    summary: {
      treatment_id: treatment.id,
      treatment_charge: treatmentCharge,
      previously_paid: previouslyPaid,
      current_payment: amount,
      total_paid: totalPaid,
      remaining_amount: newRemainingAmount,
      payment_status: status,
      installment_count: paymentSummary.installment_count + 1,
    },
  };
}

export function getPayments(filters = {}) {
  const { patient_id, treatment_id, date, status } = filters;

  let payments = readSheet("Payments");

  if (patient_id) {
    payments = payments.filter((payment) => payment.patient_id === patient_id);
  }

  if (treatment_id) {
    payments = payments.filter(
      (payment) => payment.treatment_id === treatment_id,
    );
  }

  if (date) {
    payments = payments.filter((payment) => payment.payment_date === date);
  }

  if (status) {
    payments = payments.filter((payment) => payment.status === status);
  }

  return payments;
}
