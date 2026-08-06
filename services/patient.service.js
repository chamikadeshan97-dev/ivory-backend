import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import {
  createId,
  now,
} from "../utils/helpers.js";

import appError from "../utils/appError.js";

/* ========================================================
   Helper functions
======================================================== */

const normalizeValue = (value) => {
  return String(value ?? "").trim();
};

const normalizeLower = (value) => {
  return normalizeValue(value).toLowerCase();
};

const toNumber = (value) => {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
};

const convertToBoolean = (value) => {
  if (
    value === true ||
    value === 1
  ) {
    return true;
  }

  return [
    "true",
    "yes",
    "1",
  ].includes(
    normalizeLower(value),
  );
};

const getPaymentStatus = ({
  savedStatus,
  paymentAmount,
  treatmentCharge,
}) => {
  const status =
    normalizeLower(savedStatus);

  if (
    status === "paid" ||
    status === "full"
  ) {
    return "Full";
  }

  if (status === "partial") {
    return "Partial";
  }

  if (
    treatmentCharge > 0 &&
    paymentAmount >= treatmentCharge
  ) {
    return "Full";
  }

  if (paymentAmount > 0) {
    return "Partial";
  }

  return "Pending";
};

/* ========================================================
   Create patient
======================================================== */

export async function createPatient(data) {
  const {
    name,
    phone,
    age,
    distance,
    location,
    gender,
    address,
    allergy_details,
    has_allergies,
  } = data;

  if (
    !normalizeValue(name) ||
    !normalizeValue(phone)
  ) {
    throw appError(
      "Patient name and phone number are required",
      400,
    );
  }

  const patients =
    await readSheet("Patients");

  const createdAt = now();

  const newPatient = {
    id: createId("PAT"),

    name: normalizeValue(name),
    phone: normalizeValue(phone),

    location:
      normalizeValue(location),

    distance:
      distance ?? "",

    age:
      age ?? "",

    gender:
      normalizeValue(gender),

    address:
      normalizeValue(address),

    is_allergies:
      convertToBoolean(
        has_allergies,
      ),

    allergies:
      normalizeValue(
        allergy_details,
      ),

    created_at: createdAt,
    updated_at: createdAt,
  };

  /*
   * Clear allergy description when
   * the patient has no allergies.
   */
  if (!newPatient.is_allergies) {
    newPatient.allergies = "";
  }

  patients.push(newPatient);

  await writeSheet(
    "Patients",
    patients,
  );

  return newPatient;
}

/* ========================================================
   Get all patients
======================================================== */

export async function getAllPatients() {
  return await readSheet("Patients");
}

/* ========================================================
   Search patients
======================================================== */

export async function searchPatients(q) {
  const patients =
    await readSheet("Patients");

  const keyword =
    normalizeLower(q);

  if (!keyword) {
    return patients;
  }

  return patients.filter(
    (patient) => {
      return (
        normalizeLower(
          patient.name,
        ).includes(keyword) ||
        normalizeLower(
          patient.phone,
        ).includes(keyword) ||
        normalizeLower(
          patient.id,
        ).includes(keyword) ||
        normalizeLower(
          patient.location,
        ).includes(keyword)
      );
    },
  );
}

/* ========================================================
   Get patient by ID
======================================================== */

export async function getPatientById(id) {
  const requestedPatientId =
    normalizeValue(id);

  if (!requestedPatientId) {
    throw appError(
      "Patient ID is required",
      400,
    );
  }

  const patients =
    await readSheet("Patients");

  const patient = patients.find(
    (item) =>
      normalizeValue(item.id) ===
      requestedPatientId,
  );

  if (!patient) {
    throw appError(
      "Patient not found",
      404,
    );
  }

  return patient;
}

/* ========================================================
   Get patient history
======================================================== */

export async function getPatientHistory(
  patientId,
) {
  const requestedPatientId =
    normalizeValue(patientId);

  if (!requestedPatientId) {
    throw appError(
      "Patient ID is required",
      400,
    );
  }

  const [
    patients,
    appointments,
    treatments,
    payments,
  ] = await Promise.all([
    readSheet("Patients"),
    readSheet("Appointments"),
    readSheet("Treatments"),
    readSheet("Payments"),
  ]);

  const patient = patients.find(
    (item) =>
      normalizeValue(item.id) ===
      requestedPatientId,
  );

  if (!patient) {
    throw appError(
      "Patient not found",
      404,
    );
  }

  const patientAppointments =
    appointments.filter(
      (appointment) =>
        normalizeValue(
          appointment.patient_id,
        ) === requestedPatientId,
    );

  const appointmentIds = new Set(
    patientAppointments.map(
      (appointment) =>
        normalizeValue(
          appointment.id,
        ),
    ),
  );

  const patientTreatments =
    treatments.filter(
      (treatment) => {
        const treatmentPatientId =
          normalizeValue(
            treatment.patient_id,
          );

        const treatmentAppointmentId =
          normalizeValue(
            treatment.appointment_id,
          );

        return (
          treatmentPatientId ===
            requestedPatientId ||
          appointmentIds.has(
            treatmentAppointmentId,
          )
        );
      },
    );

  const treatmentIds = new Set(
    patientTreatments.map(
      (treatment) =>
        normalizeValue(
          treatment.id,
        ),
    ),
  );

  const patientPayments =
    payments.filter(
      (payment) => {
        const paymentPatientId =
          normalizeValue(
            payment.patient_id,
          );

        const paymentTreatmentId =
          normalizeValue(
            payment.treatment_id,
          );

        return (
          paymentPatientId ===
            requestedPatientId ||
          treatmentIds.has(
            paymentTreatmentId,
          )
        );
      },
    );

  return {
    personal_information:
      patient,

    appointment_history:
      patientAppointments,

    treatment_history:
      patientTreatments,

    prescription_history:
      patientTreatments.map(
        (treatment) => ({
          treatment_id:
            treatment.id,

          prescription:
            treatment.prescription ||
            "",

          treatment_date:
            treatment.treatment_date ||
            "",
        }),
      ),

    payment_history:
      patientPayments,

    doctor_notes:
      patientTreatments.map(
        (treatment) => ({
          treatment_id:
            treatment.id,

          doctor_notes:
            treatment.doctor_notes ||
            "",

          treatment_date:
            treatment.treatment_date ||
            "",
        }),
      ),
  };
}

/* ========================================================
   Update patient
======================================================== */

export async function updatePatient(
  id,
  data,
) {
  const requestedPatientId =
    normalizeValue(id);

  if (!requestedPatientId) {
    throw appError(
      "Patient ID is required",
      400,
    );
  }

  const patients =
    await readSheet("Patients");

  const index = patients.findIndex(
    (patient) =>
      normalizeValue(patient.id) ===
      requestedPatientId,
  );

  if (index === -1) {
    throw appError(
      "Patient not found",
      404,
    );
  }

  const existingPatient =
    patients[index];

  const updatedPatient = {
    ...existingPatient,

    name:
      data.name !== undefined
        ? normalizeValue(
            data.name,
          )
        : existingPatient.name,

    phone:
      data.phone !== undefined
        ? normalizeValue(
            data.phone,
          )
        : existingPatient.phone,

    location:
      data.location !== undefined
        ? normalizeValue(
            data.location,
          )
        : existingPatient.location,

    distance:
      data.distance !== undefined
        ? data.distance
        : existingPatient.distance,

    age:
      data.age !== undefined
        ? data.age
        : existingPatient.age,

    gender:
      data.gender !== undefined
        ? normalizeValue(
            data.gender,
          )
        : existingPatient.gender,

    address:
      data.address !== undefined
        ? normalizeValue(
            data.address,
          )
        : existingPatient.address,

    is_allergies:
      data.has_allergies !==
      undefined
        ? convertToBoolean(
            data.has_allergies,
          )
        : data.is_allergies !==
            undefined
          ? convertToBoolean(
              data.is_allergies,
            )
          : convertToBoolean(
              existingPatient.is_allergies,
            ),

    allergies:
      data.allergy_details !==
      undefined
        ? normalizeValue(
            data.allergy_details,
          )
        : data.allergies !==
            undefined
          ? normalizeValue(
              data.allergies,
            )
          : existingPatient.allergies,

    updated_at: now(),
  };

  if (
    !normalizeValue(
      updatedPatient.name,
    ) ||
    !normalizeValue(
      updatedPatient.phone,
    )
  ) {
    throw appError(
      "Patient name and phone number are required",
      400,
    );
  }

  if (
    !convertToBoolean(
      updatedPatient.is_allergies,
    )
  ) {
    updatedPatient.allergies = "";
  }

  patients[index] =
    updatedPatient;

  await writeSheet(
    "Patients",
    patients,
  );

  return updatedPatient;
}

/* ========================================================
   Delete patient
======================================================== */

export async function deletePatient(id) {
  const requestedPatientId =
    normalizeValue(id);

  if (!requestedPatientId) {
    throw appError(
      "Patient ID is required",
      400,
    );
  }

  const patients =
    await readSheet("Patients");

  const index = patients.findIndex(
    (patient) =>
      normalizeValue(patient.id) ===
      requestedPatientId,
  );

  if (index === -1) {
    throw appError(
      "Patient not found",
      404,
    );
  }

  const deletedPatient =
    patients[index];

  patients.splice(index, 1);

  await writeSheet(
    "Patients",
    patients,
  );

  return deletedPatient;
}

/* ========================================================
   Patient statistics
======================================================== */

export async function getPatientStatistics() {
  const patients =
    await readSheet("Patients");

  const totalPatients =
    patients.length;

  const malePatients =
    patients.filter(
      (patient) =>
        normalizeLower(
          patient.gender,
        ) === "male",
    ).length;

  const femalePatients =
    patients.filter(
      (patient) =>
        normalizeLower(
          patient.gender,
        ) === "female",
    ).length;

  const totalAge = patients.reduce(
    (sum, patient) => {
      return (
        sum +
        toNumber(patient.age)
      );
    },
    0,
  );

  const averageAge =
    totalPatients > 0
      ? Number(
          (
            totalAge /
            totalPatients
          ).toFixed(1),
        )
      : 0;

  return {
    total_patients:
      totalPatients,

    male_patients:
      malePatients,

    female_patients:
      femalePatients,

    average_age:
      averageAge,
  };
}

/* ========================================================
   Recent patients
======================================================== */

export async function getRecentPatients() {
  const patients =
    await readSheet("Patients");

  return [...patients]
    .sort((first, second) => {
      const firstDate =
        new Date(
          first.created_at || 0,
        ).getTime();

      const secondDate =
        new Date(
          second.created_at || 0,
        ).getTime();

      if (
        Number.isFinite(firstDate) &&
        Number.isFinite(secondDate)
      ) {
        return (
          secondDate -
          firstDate
        );
      }

      return normalizeValue(
        second.created_at,
      ).localeCompare(
        normalizeValue(
          first.created_at,
        ),
      );
    })
    .slice(0, 5);
}

/* ========================================================
   Get patient full details
======================================================== */

export async function getPatientFullDetails(
  patientId,
) {
  if (!patientId) {
    throw appError(
      "Patient ID is required",
      400,
    );
  }

  const requestedPatientId =
    normalizeValue(patientId);

  const [
    patients,
    appointments,
    dentists,
    treatments,
    payments,
  ] = await Promise.all([
    readSheet("Patients"),
    readSheet("Appointments"),
    readSheet("Dentists"),
    readSheet("Treatments"),
    readSheet("Payments"),
  ]);

  /* --------------------------------------------------------
     Find patient
  -------------------------------------------------------- */

  const patient = patients.find(
    (item) =>
      normalizeValue(item.id) ===
      requestedPatientId,
  );

  if (!patient) {
    throw appError(
      `Patient ${requestedPatientId} was not found`,
      404,
    );
  }

  /* --------------------------------------------------------
     Patient appointments
  -------------------------------------------------------- */

  const patientAppointments =
    appointments
      .filter(
        (appointment) =>
          normalizeValue(
            appointment.patient_id,
          ) ===
          requestedPatientId,
      )
      .map((appointment) => {
        const dentist =
          dentists.find(
            (item) =>
              normalizeValue(
                item.id,
              ) ===
              normalizeValue(
                appointment.dentist_id,
              ),
          );

        return {
          appointment_id:
            appointment.id,

          patient_id:
            appointment.patient_id,

          dentist_id:
            appointment.dentist_id,

          dentist_name:
            dentist?.name ||
            dentist?.dentist_name ||
            "",

          appointment_date:
            appointment.appointment_date ||
            "",

          appointment_time:
            appointment.appointment_time ||
            "",

          reason_for_visit:
            appointment.reason_for_visit ||
            "",

          status:
            appointment.status ||
            "Pending",

          created_at:
            appointment.created_at ||
            "",

          updated_at:
            appointment.updated_at ||
            "",
        };
      })
      .sort((first, second) => {
        const firstValue =
          `${first.appointment_date} ${first.appointment_time}`;

        const secondValue =
          `${second.appointment_date} ${second.appointment_time}`;

        return secondValue.localeCompare(
          firstValue,
        );
      });

  const appointmentIds = new Set(
    patientAppointments.map(
      (appointment) =>
        normalizeValue(
          appointment.appointment_id,
        ),
    ),
  );

  /* --------------------------------------------------------
     Patient treatments
  -------------------------------------------------------- */

  const patientTreatments =
    treatments
      .filter((treatment) => {
        const treatmentPatientId =
          normalizeValue(
            treatment.patient_id,
          );

        const treatmentAppointmentId =
          normalizeValue(
            treatment.appointment_id,
          );

        return (
          treatmentPatientId ===
            requestedPatientId ||
          appointmentIds.has(
            treatmentAppointmentId,
          )
        );
      })
      .map((treatment) => {
        const appointment =
          patientAppointments.find(
            (item) =>
              normalizeValue(
                item.appointment_id,
              ) ===
              normalizeValue(
                treatment.appointment_id,
              ),
          );

        return {
          treatment_id:
            treatment.id,

          patient_id:
            treatment.patient_id ||
            requestedPatientId,

          appointment_id:
            treatment.appointment_id ||
            "",

          diagnosis:
            treatment.diagnosis ||
            "",

          treatment_performed:
            treatment.treatment_performed ||
            treatment.treatment_name ||
            treatment.procedure_name ||
            "",

          prescription:
            treatment.prescription ||
            "",

          doctor_notes:
            treatment.doctor_notes ||
            "",

          treatment_fee:
            toNumber(
              treatment.treatment_fee ??
                treatment.treatment_charge,
            ),

          treatment_date:
            treatment.treatment_date ||
            appointment?.appointment_date ||
            treatment.created_at ||
            "",

          notes:
            treatment.notes ||
            treatment.treatment_notes ||
            treatment.description ||
            "",

          next_appointment_date:
            treatment.next_appointment_date ||
            "",

          created_at:
            treatment.created_at ||
            "",

          updated_at:
            treatment.updated_at ||
            "",
        };
      })
      .sort((first, second) =>
        normalizeValue(
          second.treatment_date,
        ).localeCompare(
          normalizeValue(
            first.treatment_date,
          ),
        ),
      );

  const treatmentIds = new Set(
    patientTreatments.map(
      (treatment) =>
        normalizeValue(
          treatment.treatment_id,
        ),
    ),
  );

  /* --------------------------------------------------------
     Patient payments
  -------------------------------------------------------- */

  const patientPayments =
    payments
      .filter((payment) => {
        const paymentPatientId =
          normalizeValue(
            payment.patient_id,
          );

        const paymentTreatmentId =
          normalizeValue(
            payment.treatment_id,
          );

        return (
          paymentPatientId ===
            requestedPatientId ||
          treatmentIds.has(
            paymentTreatmentId,
          )
        );
      })
      .map((payment) => {
        const treatment =
          patientTreatments.find(
            (item) =>
              normalizeValue(
                item.treatment_id,
              ) ===
              normalizeValue(
                payment.treatment_id,
              ),
          );

        const treatmentCharge =
          toNumber(
            payment.treatment_charge ??
              treatment?.treatment_fee,
          );

        const paymentAmount =
          toNumber(
            payment.payment_amount ??
              payment.amount,
          );

        const status =
          getPaymentStatus({
            savedStatus:
              payment.status ??
              payment.payment_status,

            paymentAmount,
            treatmentCharge,
          });

        return {
          payment_id:
            payment.id,

          patient_id:
            payment.patient_id ||
            requestedPatientId,

          treatment_id:
            payment.treatment_id ||
            "",

          treatment_name:
            treatment
              ?.treatment_performed ||
            "",

          receipt_number:
            payment.receipt_number ||
            "",

          treatment_charge:
            treatmentCharge,

          payment_amount:
            paymentAmount,

          balance:
            Math.max(
              treatmentCharge -
                paymentAmount,
              0,
            ),

          payment_method:
            payment.payment_method ||
            "",

          payment_date:
            payment.payment_date ||
            "",

          status,

          created_at:
            payment.created_at ||
            "",

          updated_at:
            payment.updated_at ||
            "",
        };
      })
      .sort((first, second) =>
        normalizeValue(
          second.payment_date,
        ).localeCompare(
          normalizeValue(
            first.payment_date,
          ),
        ),
      );

  /* --------------------------------------------------------
     Financial summary
  -------------------------------------------------------- */

  const totalTreatmentCharges =
    patientTreatments.reduce(
      (total, treatment) =>
        total +
        toNumber(
          treatment.treatment_fee,
        ),
      0,
    );

  const totalPaid =
    patientPayments.reduce(
      (total, payment) =>
        total +
        toNumber(
          payment.payment_amount,
        ),
      0,
    );

  const fullPaymentCount =
    patientPayments.filter(
      (payment) =>
        payment.status === "Full",
    ).length;

  const partialPaymentCount =
    patientPayments.filter(
      (payment) =>
        payment.status ===
        "Partial",
    ).length;

  const totalCash =
    patientPayments
      .filter(
        (payment) =>
          normalizeLower(
            payment.payment_method,
          ) === "cash",
      )
      .reduce(
        (total, payment) =>
          total +
          toNumber(
            payment.payment_amount,
          ),
        0,
      );

  const totalCard =
    patientPayments
      .filter(
        (payment) =>
          normalizeLower(
            payment.payment_method,
          ) === "card",
      )
      .reduce(
        (total, payment) =>
          total +
          toNumber(
            payment.payment_amount,
          ),
        0,
      );

  const totalTransfer =
    patientPayments
      .filter((payment) => {
        const method =
          normalizeLower(
            payment.payment_method,
          );

        return [
          "transfer",
          "bank transfer",
          "bank_transfer",
          "online",
        ].includes(method);
      })
      .reduce(
        (total, payment) =>
          total +
          toNumber(
            payment.payment_amount,
          ),
        0,
      );

  /* --------------------------------------------------------
     Appointment summary
  -------------------------------------------------------- */

  const today =
    new Date()
      .toISOString()
      .slice(0, 10);

  const upcomingAppointments =
    patientAppointments
      .filter((appointment) => {
        const status =
          normalizeLower(
            appointment.status,
          );

        return (
          normalizeValue(
            appointment.appointment_date,
          ) >= today &&
          ![
            "cancelled",
            "canceled",
            "completed",
          ].includes(status)
        );
      })
      .sort((first, second) =>
        `${first.appointment_date} ${first.appointment_time}`.localeCompare(
          `${second.appointment_date} ${second.appointment_time}`,
        ),
      );

  const completedAppointments =
    patientAppointments.filter(
      (appointment) =>
        [
          "completed",
          "paid",
        ].includes(
          normalizeLower(
            appointment.status,
          ),
        ),
    );

  const cancelledAppointments =
    patientAppointments.filter(
      (appointment) =>
        [
          "cancelled",
          "canceled",
        ].includes(
          normalizeLower(
            appointment.status,
          ),
        ),
    );

  /* --------------------------------------------------------
     Final response
  -------------------------------------------------------- */

  return {
    patient: {
      ...patient,

      id:
        patient.id ||
        requestedPatientId,

      name:
        patient.name ||
        patient.patient_name ||
        "",

      phone:
        patient.phone ||
        patient.phone_number ||
        "",

      location:
        patient.location ||
        "",

      distance:
        patient.distance ||
        "",

      has_allergies:
        convertToBoolean(
          patient.has_allergies ??
            patient.is_allergies,
        ),

      allergy_details:
        patient.allergy_details ??
        patient.allergies ??
        "",
    },

    summary: {
      total_appointments:
        patientAppointments.length,

      completed_appointments:
        completedAppointments.length,

      cancelled_appointments:
        cancelledAppointments.length,

      upcoming_appointments:
        upcomingAppointments.length,

      total_treatments:
        patientTreatments.length,

      total_payments:
        patientPayments.length,

      full_payments:
        fullPaymentCount,

      partial_payments:
        partialPaymentCount,

      total_treatment_charges:
        totalTreatmentCharges,

      total_paid:
        totalPaid,

      outstanding_balance:
        Math.max(
          totalTreatmentCharges -
            totalPaid,
          0,
        ),

      total_cash:
        totalCash,

      total_card:
        totalCard,

      total_transfer:
        totalTransfer,
    },

    next_appointment:
      upcomingAppointments[0] ||
      null,

    last_appointment:
      patientAppointments[0] ||
      null,

    appointments:
      patientAppointments,

    treatments:
      patientTreatments,

    payments:
      patientPayments,
  };
}