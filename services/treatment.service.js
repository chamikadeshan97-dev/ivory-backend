import { readSheet, writeSheet } from "../utils/excelDb.js";
import { createId, now, today } from "../utils/helpers.js";
import appError from "../utils/appError.js";

export function createTreatment(data) {
  const {
    patient_id,
    appointment_id,
    dentist_id,
    treatment_date,
    next_appointment_date,
    doctor_notes,
    treatment_fee,
    prescription,
  } = data;

  if (!patient_id || !appointment_id) {
    throw appError("Patient and appointment are required", 400);
  }

  const treatmentFee = Number(treatment_fee);

  if (
    treatment_fee === undefined ||
    treatment_fee === null ||
    treatment_fee === ""
  ) {
    throw appError("Treatment fee is required", 400);
  }

  if (Number.isNaN(treatmentFee) || treatmentFee < 0) {
    throw appError("Treatment fee must be a valid positive number", 400);
  }

  const patients = readSheet("Patients");

  const patientExists = patients.some((patient) => patient.id === patient_id);

  if (!patientExists) {
    throw appError("Patient not found", 404);
  }

  const appointments = readSheet("Appointments");

  const appointmentIndex = appointments.findIndex(
    (appointment) => appointment.id === appointment_id,
  );

  if (appointmentIndex === -1) {
    throw appError("Appointment not found", 404);
  }

  const appointment = appointments[appointmentIndex];

  if (appointment.patient_id && appointment.patient_id !== patient_id) {
    throw appError("The appointment does not belong to this patient", 400);
  }

  const treatments = readSheet("Treatments");

  const existingTreatment = treatments.some(
    (treatment) => treatment.appointment_id === appointment_id,
  );

  if (existingTreatment) {
    throw appError("A treatment already exists for this appointment", 409);
  }

  const newTreatment = {
    id: createId("TRT"),
    patient_id,
    appointment_id,
    dentist_id: dentist_id || appointment.dentist_id || "",

    treatment_date: treatment_date || today(),
    next_appointment_date: next_appointment_date || "",

    doctor_notes: doctor_notes?.trim() || "",
    treatment_fee: treatmentFee,
    prescription: prescription?.trim() || "",

    created_at: now(),
    updated_at: now(),
  };

  treatments.push(newTreatment);
  writeSheet("Treatments", treatments);

  return newTreatment;
}

export function getTreatments(patient_id) {
  let treatments = readSheet("Treatments");

  if (patient_id) {
    treatments = treatments.filter(
      (treatment) => treatment.patient_id === patient_id,
    );
  }

  return treatments;
}

export function getTreatmentPaymentSummary(treatmentId) {
  if (!treatmentId) {
    throw appError("Treatment ID is required", 400);
  }

  const treatments = readSheet("Treatments");

  const treatment = treatments.find(
    (item) => String(item.id).trim() === String(treatmentId).trim(),
  );

  if (!treatment) {
    throw appError("Treatment not found", 404);
  }

  const treatmentCharge = Number(treatment.treatment_fee || 0);

  if (Number.isNaN(treatmentCharge) || treatmentCharge <= 0) {
    throw appError(
      "A valid treatment fee is not available for this treatment",
      400,
    );
  }

  const payments = readSheet("Payments");

  const paymentHistory = payments
    .filter(
      (payment) =>
        String(payment.treatment_id).trim() === String(treatmentId).trim(),
    )
    .sort((a, b) => {
      const dateA = new Date(a.created_at || a.payment_date || 0);

      const dateB = new Date(b.created_at || b.payment_date || 0);

      return dateA - dateB;
    });

  const totalPaid = paymentHistory.reduce((total, payment) => {
    const amount = Number(payment.payment_amount || 0);

    return total + (Number.isNaN(amount) ? 0 : amount);
  }, 0);

  const remainingAmount = Math.max(treatmentCharge - totalPaid, 0);

  return {
    treatment_id: treatment.id,
    patient_id: treatment.patient_id,
    treatment_charge: treatmentCharge,
    total_paid: totalPaid,
    remaining_amount: remainingAmount,
    payment_status:
      remainingAmount <= 0 ? "Paid" : totalPaid > 0 ? "Partial" : "Pending",
    installment_count: paymentHistory.length,
    can_make_payment: remainingAmount > 0,
    payments: paymentHistory,
  };
}

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */

const getPatientId = (record) => {
  return String(record?.patient_id ?? record?.patientId ?? "").trim();
};

const getTreatmentId = (treatment) => {
  return treatment?.treatment_id ?? treatment?.id ?? null;
};

const getAppointmentId = (appointment) => {
  return appointment?.appointment_id ?? appointment?.id ?? null;
};

const normalizeDate = (value) => {
  if (!value) {
    return "";
  }

  /*
   * Excel libraries may return an actual Date object.
   */
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const stringValue = String(value).trim();

  /*
   * Already in YYYY-MM-DD format.
   */
  const isoMatch = stringValue.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  /*
   * Handle formats such as MM/DD/YYYY or DD/MM/YYYY.
   * Adjust this section if your Excel file uses one fixed format.
   */
  const slashMatch = stringValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const firstPart = Number(slashMatch[1]);
    const secondPart = Number(slashMatch[2]);
    const year = slashMatch[3];

    let month = firstPart;
    let day = secondPart;

    /*
     * If the first value is greater than 12,
     * it must be the day.
     */
    if (firstPart > 12) {
      day = firstPart;
      month = secondPart;
    }

    return `${year}-${String(month).padStart(
      2,
      "0",
    )}-${String(day).padStart(2, "0")}`;
  }

  const parsedDate = new Date(stringValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return stringValue;
  }

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateTimestamp = (value) => {
  const normalizedDate = normalizeDate(value);

  if (!normalizedDate) {
    return 0;
  }

  const timestamp = new Date(`${normalizedDate}T00:00:00`).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const isCancelledAppointment = (appointment) => {
  return (
    String(appointment?.status ?? "")
      .trim()
      .toLowerCase() === "cancelled"
  );
};

/* --------------------------------------------------------
   Get follow-up patients by date
-------------------------------------------------------- */

export function getFollowUpPatientsByDate(selectedDate) {
  const normalizedSelectedDate = normalizeDate(selectedDate);

  const patients = readSheet("Patients");
  const treatments = readSheet("Treatments");
  const appointments = readSheet("Appointments");

  /*
   * Create fast patient lookup map.
   */
  const patientMap = new Map();

  patients.forEach((patient) => {
    const patientId = String(patient?.patient_id ?? patient?.id ?? "").trim();

    if (patientId) {
      patientMap.set(patientId, patient);
    }
  });

  /*
   * Get treatments matching the recommended follow-up date.
   */
  const matchingTreatments = treatments
    .filter((treatment) => {
      return (
        normalizeDate(treatment?.next_appointment_date) ===
        normalizedSelectedDate
      );
    })
    .sort((firstTreatment, secondTreatment) => {
      return (
        getDateTimestamp(
          secondTreatment?.treatment_date ?? secondTreatment?.created_at,
        ) -
        getDateTimestamp(
          firstTreatment?.treatment_date ?? firstTreatment?.created_at,
        )
      );
    });

  /*
   * Keep only the latest matching treatment per patient.
   */
  const latestTreatmentByPatient = new Map();

  matchingTreatments.forEach((treatment) => {
    const patientId = getPatientId(treatment);

    if (patientId && !latestTreatmentByPatient.has(patientId)) {
      latestTreatmentByPatient.set(patientId, treatment);
    }
  });

  const followUps = Array.from(latestTreatmentByPatient.values()).map(
    (treatment) => {
      const patientId = getPatientId(treatment);
      const patient = patientMap.get(patientId);

      /*
       * Find an actual appointment created for this
       * patient on the recommended date.
       */
      const bookedAppointment = appointments.find((appointment) => {
        return (
          getPatientId(appointment) === patientId &&
          normalizeDate(appointment?.appointment_date) ===
            normalizedSelectedDate &&
          !isCancelledAppointment(appointment)
        );
      });

      const appointmentCreated = Boolean(bookedAppointment);

      return {
        treatment_id: getTreatmentId(treatment),

        patient_id: patientId,

        patient_name:
          patient?.name ?? patient?.patient_name ?? "Unknown Patient",

        phone: patient?.phone ?? patient?.mobile ?? "-",

        age: patient?.age ?? null,
        gender: patient?.gender ?? null,

        has_allergies: patient?.has_allergies ?? patient?.is_allergies ?? false,

        allergy_details: patient?.allergy_details ?? patient?.allergies ?? "",

        previous_treatment_date: normalizeDate(
          treatment?.treatment_date ?? treatment?.created_at,
        ),

        diagnosis: treatment?.diagnosis ?? "",

        treatment_performed: treatment?.treatment_performed ?? "",

        prescription: treatment?.prescription ?? "",

        doctor_notes: treatment?.doctor_notes ?? "",

        next_appointment_date: normalizeDate(treatment?.next_appointment_date),

        appointment_created: appointmentCreated,

        appointment_id: bookedAppointment
          ? getAppointmentId(bookedAppointment)
          : null,

        appointment_time: bookedAppointment?.appointment_time ?? null,

        appointment_status: bookedAppointment?.status ?? "Not Booked",

        follow_up_status: appointmentCreated
          ? "Appointment Booked"
          : "Pending Contact",
      };
    },
  );

  const bookedCount = followUps.filter(
    (item) => item.appointment_created,
  ).length;

  return {
    date: normalizedSelectedDate,

    summary: {
      expected_patients: followUps.length,
      appointments_booked: bookedCount,
      pending_booking: followUps.length - bookedCount,
    },

    follow_ups: followUps,
  };
}
