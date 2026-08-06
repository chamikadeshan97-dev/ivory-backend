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

/* --------------------------------------------------------
   Common helpers
-------------------------------------------------------- */

const normalizeId = (value) => {
  return String(value ?? "").trim();
};

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

/* --------------------------------------------------------
   Create treatment
-------------------------------------------------------- */

export async function createTreatment(data) {
  const {
    patient_id,
    appointment_id,
    dentist_id,
    treatment_date,
    next_appointment_date,
    doctor_notes,
    treatment_fee,
    prescription,
    tooth_number,
    diagnosis,
    treatment_details,
  } = data;

  const normalizedPatientId = normalizeId(patient_id);
  const normalizedAppointmentId = normalizeId(appointment_id);

  if (!normalizedPatientId || !normalizedAppointmentId) {
    throw appError(
      "Patient and appointment are required",
      400,
    );
  }

  if (
    treatment_fee === undefined ||
    treatment_fee === null ||
    treatment_fee === ""
  ) {
    throw appError("Treatment fee is required", 400);
  }

  const treatmentFee = Number(treatment_fee);

  if (Number.isNaN(treatmentFee) || treatmentFee < 0) {
    throw appError(
      "Treatment fee must be a valid non-negative number",
      400,
    );
  }

  /*
   * Read the required Google Sheets tabs in parallel.
   */
  const [
    patients,
    appointments,
    treatments,
  ] = await Promise.all([
    readSheet("Patients"),
    readSheet("Appointments"),
    readSheet("Treatments"),
  ]);

  const patientExists = patients.some((patient) => {
    const currentPatientId = normalizeId(
      patient?.id ?? patient?.patient_id,
    );

    return currentPatientId === normalizedPatientId;
  });

  if (!patientExists) {
    throw appError("Patient not found", 404);
  }

  const appointmentIndex = appointments.findIndex(
    (appointment) => {
      const currentAppointmentId = normalizeId(
        appointment?.id ?? appointment?.appointment_id,
      );

      return currentAppointmentId === normalizedAppointmentId;
    },
  );

  if (appointmentIndex === -1) {
    throw appError("Appointment not found", 404);
  }

  const appointment = appointments[appointmentIndex];

  const appointmentPatientId = normalizeId(
    appointment?.patient_id ?? appointment?.patientId,
  );

  if (
    appointmentPatientId &&
    appointmentPatientId !== normalizedPatientId
  ) {
    throw appError(
      "The appointment does not belong to this patient",
      400,
    );
  }

  const existingTreatment = treatments.some((treatment) => {
    return (
      normalizeId(treatment?.appointment_id) ===
      normalizedAppointmentId
    );
  });

  if (existingTreatment) {
    throw appError(
      "A treatment already exists for this appointment",
      409,
    );
  }

  const timestamp = now();

  const newTreatment = {
    id: createId("TRT"),

    patient_id: normalizedPatientId,
    appointment_id: normalizedAppointmentId,

    dentist_id:
      normalizeId(dentist_id) ||
      normalizeId(appointment?.dentist_id),

    treatment_date:
      normalizeText(treatment_date) || today(),

    next_appointment_date:
      normalizeText(next_appointment_date),

    doctor_notes:
      normalizeText(doctor_notes),

    treatment_fee: treatmentFee,

    prescription:
      normalizeText(prescription),

    diagnosis:
      normalizeText(diagnosis),

    tooth_number:
      normalizeText(tooth_number),

    treatment_details:
      normalizeText(treatment_details),

    created_at: timestamp,
    updated_at: timestamp,
  };

  treatments.push(newTreatment);

  await writeSheet(
    "Treatments",
    treatments,
  );

  return newTreatment;
}

/* --------------------------------------------------------
   Get treatments
-------------------------------------------------------- */

export async function getTreatments(patient_id) {
  let treatments = await readSheet("Treatments");

  const normalizedPatientId = normalizeId(patient_id);

  if (normalizedPatientId) {
    treatments = treatments.filter((treatment) => {
      return (
        normalizeId(treatment?.patient_id) ===
        normalizedPatientId
      );
    });
  }

  return treatments;
}

/* --------------------------------------------------------
   Get treatment payment summary
-------------------------------------------------------- */

export async function getTreatmentPaymentSummary(
  treatmentId,
) {
  const normalizedTreatmentId = normalizeId(treatmentId);

  if (!normalizedTreatmentId) {
    throw appError("Treatment ID is required", 400);
  }

  const treatments = await readSheet("Treatments");

  const treatment = treatments.find((item) => {
    return (
      normalizeId(item?.id ?? item?.treatment_id) ===
      normalizedTreatmentId
    );
  });

  if (!treatment) {
    throw appError("Treatment not found", 404);
  }

  const treatmentCharge = Number(
    treatment?.treatment_fee || 0,
  );

  if (
    Number.isNaN(treatmentCharge) ||
    treatmentCharge <= 0
  ) {
    throw appError(
      "A valid treatment fee is not available for this treatment",
      400,
    );
  }

  const payments = await readSheet("Payments");

  const paymentHistory = payments
    .filter((payment) => {
      return (
        normalizeId(payment?.treatment_id) ===
        normalizedTreatmentId
      );
    })
    .sort((firstPayment, secondPayment) => {
      const firstDate = new Date(
        firstPayment?.created_at ||
          firstPayment?.payment_date ||
          0,
      );

      const secondDate = new Date(
        secondPayment?.created_at ||
          secondPayment?.payment_date ||
          0,
      );

      return firstDate - secondDate;
    });

  const totalPaid = paymentHistory.reduce(
    (total, payment) => {
      const amount = Number(
        payment?.payment_amount || 0,
      );

      return total + (
        Number.isNaN(amount) ? 0 : amount
      );
    },
    0,
  );

  const remainingAmount = Math.max(
    treatmentCharge - totalPaid,
    0,
  );

  let paymentStatus = "Pending";

  if (remainingAmount <= 0) {
    paymentStatus = "Paid";
  } else if (totalPaid > 0) {
    paymentStatus = "Partial";
  }

  return {
    treatment_id:
      treatment?.id ?? treatment?.treatment_id,

    patient_id:
      treatment?.patient_id,

    treatment_charge:
      treatmentCharge,

    total_paid:
      totalPaid,

    remaining_amount:
      remainingAmount,

    payment_status:
      paymentStatus,

    installment_count:
      paymentHistory.length,

    can_make_payment:
      remainingAmount > 0,

    payments:
      paymentHistory,
  };
}

/* --------------------------------------------------------
   Follow-up helpers
-------------------------------------------------------- */

const getPatientId = (record) => {
  return normalizeId(
    record?.patient_id ??
      record?.patientId,
  );
};

const getTreatmentId = (treatment) => {
  return (
    treatment?.treatment_id ??
    treatment?.id ??
    null
  );
};

const getAppointmentId = (appointment) => {
  return (
    appointment?.appointment_id ??
    appointment?.id ??
    null
  );
};

const normalizeDate = (value) => {
  if (!value) {
    return "";
  }

  /*
   * Retained for compatibility in case a Date object
   * is supplied directly from another part of the app.
   */
  if (value instanceof Date) {
    const year = value.getFullYear();

    const month = String(
      value.getMonth() + 1,
    ).padStart(2, "0");

    const day = String(
      value.getDate(),
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  const stringValue = String(value).trim();

  /*
   * Already in YYYY-MM-DD or ISO date-time format.
   */
  const isoMatch = stringValue.match(
    /^(\d{4})-(\d{2})-(\d{2})/,
  );

  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  /*
   * Handle MM/DD/YYYY and DD/MM/YYYY.
   */
  const slashMatch = stringValue.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
  );

  if (slashMatch) {
    const firstPart = Number(slashMatch[1]);
    const secondPart = Number(slashMatch[2]);
    const year = slashMatch[3];

    let month = firstPart;
    let day = secondPart;

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

  const month = String(
    parsedDate.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    parsedDate.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateTimestamp = (value) => {
  const normalizedDate = normalizeDate(value);

  if (!normalizedDate) {
    return 0;
  }

  const timestamp = new Date(
    `${normalizedDate}T00:00:00`,
  ).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
};

const isCancelledAppointment = (appointment) => {
  return (
    normalizeText(appointment?.status)
      .toLowerCase() === "cancelled"
  );
};

/* --------------------------------------------------------
   Get follow-up patients by date
-------------------------------------------------------- */

export async function getFollowUpPatientsByDate(
  selectedDate,
) {
  const normalizedSelectedDate =
    normalizeDate(selectedDate);

  if (!normalizedSelectedDate) {
    throw appError(
      "Follow-up date is required",
      400,
    );
  }

  /*
   * Load all required tabs concurrently from Google Sheets.
   */
  const [
    patients,
    treatments,
    appointments,
  ] = await Promise.all([
    readSheet("Patients"),
    readSheet("Treatments"),
    readSheet("Appointments"),
  ]);

  /*
   * Create a fast patient lookup map.
   */
  const patientMap = new Map();

  patients.forEach((patient) => {
    const patientId = normalizeId(
      patient?.patient_id ?? patient?.id,
    );

    if (patientId) {
      patientMap.set(patientId, patient);
    }
  });

  /*
   * Get treatments matching the recommended
   * follow-up date.
   */
  const matchingTreatments = treatments
    .filter((treatment) => {
      return (
        normalizeDate(
          treatment?.next_appointment_date,
        ) === normalizedSelectedDate
      );
    })
    .sort(
      (
        firstTreatment,
        secondTreatment,
      ) => {
        const secondTimestamp =
          getDateTimestamp(
            secondTreatment?.treatment_date ??
              secondTreatment?.created_at,
          );

        const firstTimestamp =
          getDateTimestamp(
            firstTreatment?.treatment_date ??
              firstTreatment?.created_at,
          );

        return secondTimestamp - firstTimestamp;
      },
    );

  /*
   * Keep only the latest matching treatment
   * for each patient.
   */
  const latestTreatmentByPatient =
    new Map();

  matchingTreatments.forEach((treatment) => {
    const patientId =
      getPatientId(treatment);

    if (
      patientId &&
      !latestTreatmentByPatient.has(patientId)
    ) {
      latestTreatmentByPatient.set(
        patientId,
        treatment,
      );
    }
  });

  const followUps = Array.from(
    latestTreatmentByPatient.values(),
  ).map((treatment) => {
    const patientId =
      getPatientId(treatment);

    const patient =
      patientMap.get(patientId);

    /*
     * Find a non-cancelled appointment created
     * for this patient on the follow-up date.
     */
    const bookedAppointment =
      appointments.find((appointment) => {
        return (
          getPatientId(appointment) ===
            patientId &&
          normalizeDate(
            appointment?.appointment_date,
          ) === normalizedSelectedDate &&
          !isCancelledAppointment(appointment)
        );
      });

    const appointmentCreated =
      Boolean(bookedAppointment);

    return {
      treatment_id:
        getTreatmentId(treatment),

      patient_id:
        patientId,

      patient_name:
        patient?.name ??
        patient?.patient_name ??
        "Unknown Patient",

      phone:
        patient?.phone ??
        patient?.mobile ??
        "-",

      age:
        patient?.age ?? null,

      gender:
        patient?.gender ?? null,

      has_allergies:
        patient?.has_allergies ??
        patient?.is_allergies ??
        false,

      allergy_details:
        patient?.allergy_details ??
        patient?.allergies ??
        "",

      previous_treatment_date:
        normalizeDate(
          treatment?.treatment_date ??
            treatment?.created_at,
        ),

      diagnosis:
        treatment?.diagnosis ?? "",

      /*
       * Supports both the old treatment_performed
       * field and the newer treatment_details field.
       */
      treatment_performed:
        treatment?.treatment_performed ??
        treatment?.treatment_details ??
        "",

      prescription:
        treatment?.prescription ?? "",

      doctor_notes:
        treatment?.doctor_notes ?? "",

      next_appointment_date:
        normalizeDate(
          treatment?.next_appointment_date,
        ),

      appointment_created:
        appointmentCreated,

      appointment_id:
        bookedAppointment
          ? getAppointmentId(bookedAppointment)
          : null,

      appointment_time:
        bookedAppointment?.appointment_time ??
        null,

      appointment_status:
        bookedAppointment?.status ??
        "Not Booked",

      follow_up_status:
        appointmentCreated
          ? "Appointment Booked"
          : "Pending Contact",
    };
  });

  const bookedCount = followUps.filter(
    (item) => item.appointment_created,
  ).length;

  return {
    date:
      normalizedSelectedDate,

    summary: {
      expected_patients:
        followUps.length,

      appointments_booked:
        bookedCount,

      pending_booking:
        followUps.length - bookedCount,
    },

    follow_ups:
      followUps,
  };
}