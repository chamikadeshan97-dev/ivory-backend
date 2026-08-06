import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import appError from "../utils/appError.js";

/* ========================================================
   Constants
======================================================== */

const APPOINTMENT_STATUSES = [
  "Pending",
  "Confirmed",
  "Checked In",
  "Waiting",
  "In Treatment",
  "Treatment Done",
  "Payment Pending",
  "Paid",
  "Completed",
  "Cancelled",
];

const ALLOWED_STATUS_TRANSITIONS = {
  Pending: [
    "Confirmed",
    "Checked In",
    "Cancelled",
  ],

  Confirmed: [
    "Checked In",
    "Cancelled",
  ],

  "Checked In": [
    "Waiting",
    "In Treatment",
    "Cancelled",
  ],

  Waiting: [
    "In Treatment",
    "Cancelled",
  ],

  "In Treatment": [
    "Treatment Done",
  ],

  "Treatment Done": [
    "Payment Pending",
    "Paid",
  ],

  "Payment Pending": [
    "Paid",
    "Completed",
  ],

  Paid: [
    "Completed",
  ],

  Completed: [],
  Cancelled: [],
};

/* ========================================================
   General helpers
======================================================== */

function getNow() {
  return new Date().toISOString();
}

function normalizeId(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
}

function getAppointmentId(appointment) {
  return normalizeId(
    appointment?.id ??
      appointment?.appointment_id,
  );
}

function getPatientId(patient) {
  return normalizeId(
    patient?.id ??
      patient?.patient_id,
  );
}

function getDentistId(dentist) {
  return normalizeId(
    dentist?.id ??
      dentist?.dentist_id,
  );
}

function getTreatmentId(treatment) {
  return normalizeId(
    treatment?.id ??
      treatment?.treatment_id,
  );
}

function getTreatmentAppointmentId(treatment) {
  return normalizeId(
    treatment?.appointment_id ??
      treatment?.appointmentId ??
      treatment?.appointmentID,
  );
}

function isCancelledAppointment(appointment) {
  return (
    normalizeText(appointment?.status)
      .toLowerCase() === "cancelled"
  );
}

function compareAppointments(first, second) {
  const firstDate = normalizeText(
    first?.appointment_date ??
      first?.date,
  );

  const secondDate = normalizeText(
    second?.appointment_date ??
      second?.date,
  );

  const dateComparison =
    firstDate.localeCompare(secondDate);

  if (dateComparison !== 0) {
    return dateComparison;
  }

  const firstTime = normalizeText(
    first?.appointment_time,
  );

  const secondTime = normalizeText(
    second?.appointment_time,
  );

  return firstTime.localeCompare(secondTime);
}

function filterByDateRange(
  records,
  dateField,
  startDate,
  endDate,
) {
  return records.filter((record) => {
    const recordDate = normalizeText(
      record?.[dateField],
    ).slice(0, 10);

    return (
      recordDate &&
      recordDate >= startDate &&
      recordDate <= endDate
    );
  });
}

/* ========================================================
   Appointment ID generator
======================================================== */

function generateAppointmentId(
  appointments,
  appointmentDate,
) {
  const formattedDate = appointmentDate.replaceAll(
    "-",
    "",
  );

  const idPrefix = `APP_${formattedDate}_`;

  let highestNumber = 0;

  appointments.forEach((appointment) => {
    const appointmentId =
      getAppointmentId(appointment);

    if (!appointmentId.startsWith(idPrefix)) {
      return;
    }

    const numberPart = appointmentId.slice(
      idPrefix.length,
    );

    const appointmentNumber =
      Number(numberPart);

    if (
      Number.isInteger(appointmentNumber) &&
      appointmentNumber > highestNumber
    ) {
      highestNumber = appointmentNumber;
    }
  });

  return `${idPrefix}${String(
    highestNumber + 1,
  ).padStart(4, "0")}`;
}

/* ========================================================
   Payment summary helper
======================================================== */

function createTreatmentPaymentData({
  treatment,
  payments,
}) {
  if (!treatment) {
    return {
      treatmentId: "",
      treatmentFee: 0,
      treatmentPayments: [],
      totalPaid: 0,
      remainingAmount: 0,
      paymentStatus: "Not Paid",
    };
  }

  const treatmentId =
    getTreatmentId(treatment);

  const treatmentFee = toNumber(
    treatment?.treatment_fee ??
      treatment?.treatment_charge,
  );

  const treatmentPayments = treatmentId
    ? payments.filter((payment) => {
        return (
          normalizeId(
            payment?.treatment_id,
          ) === treatmentId
        );
      })
    : [];

  const totalPaid =
    treatmentPayments.reduce(
      (total, payment) => {
        return (
          total +
          toNumber(
            payment?.payment_amount ??
              payment?.amount,
          )
        );
      },
      0,
    );

  const remainingAmount = Math.max(
    treatmentFee - totalPaid,
    0,
  );

  let paymentStatus = "Not Paid";

  if (
    treatmentFee > 0 &&
    totalPaid >= treatmentFee
  ) {
    paymentStatus = "Paid";
  } else if (totalPaid > 0) {
    paymentStatus = "Partial";
  }

  return {
    treatmentId,
    treatmentFee,
    treatmentPayments,
    totalPaid,
    remainingAmount,
    paymentStatus,
  };
}

/* ========================================================
   Create appointment
======================================================== */

export async function createAppointment(data) {
  if (!data?.patient_id) {
    throw appError(
      "Patient is required",
      400,
    );
  }

  if (!data?.dentist_id) {
    throw appError(
      "Dentist is required",
      400,
    );
  }

  if (!data?.appointment_date) {
    throw appError(
      "Appointment date is required",
      400,
    );
  }

  if (!data?.appointment_time) {
    throw appError(
      "Appointment time is required",
      400,
    );
  }

  const requestedStatus =
    normalizeText(data.status) ||
    "Pending";

  if (
    !APPOINTMENT_STATUSES.includes(
      requestedStatus,
    )
  ) {
    throw appError(
      `Invalid appointment status: ${requestedStatus}`,
      400,
    );
  }

  const appointments =
    await readSheet("Appointments");

  const appointmentDate =
    normalizeText(data.appointment_date);

  const appointmentTime =
    normalizeText(data.appointment_time);

  /*
   * Prevent an exact duplicate booking.
   */
  const duplicateAppointment =
    appointments.find((appointment) => {
      return (
        normalizeId(
          appointment?.patient_id,
        ) ===
          normalizeId(data.patient_id) &&
        normalizeText(
          appointment?.appointment_date,
        ) === appointmentDate &&
        normalizeText(
          appointment?.appointment_time,
        ) === appointmentTime &&
        !isCancelledAppointment(appointment)
      );
    });

  if (duplicateAppointment) {
    throw appError(
      "This patient already has an appointment at the selected date and time",
      409,
    );
  }

  const sameDayAppointments =
    appointments.filter((appointment) => {
      return (
        normalizeText(
          appointment?.appointment_date,
        ) === appointmentDate &&
        !isCancelledAppointment(appointment)
      );
    });

  const timestamp = getNow();

  const appointment = {
    id: generateAppointmentId(
      appointments,
      appointmentDate,
    ),

    patient_id:
      normalizeId(data.patient_id),

    dentist_id:
      normalizeId(data.dentist_id),

    appointment_number:
      data.appointment_number ??
      sameDayAppointments.length + 1,

    appointment_date:
      appointmentDate,

    appointment_time:
      appointmentTime,

    reason_for_visit:
      normalizeText(
        data.reason_for_visit,
      ),

    status:
      requestedStatus,

    checked_in_time: "",

    treatment_started_at: "",

    treatment_completed_at: "",

    completed_at: "",

    created_at:
      timestamp,

    updated_at:
      timestamp,
  };

  appointments.push(appointment);

  await writeSheet(
    "Appointments",
    appointments,
  );

  return appointment;
}

/* ========================================================
   Get all appointments
======================================================== */

export async function getAllAppointments() {
  const [
    appointments,
    patients,
    dentists,
  ] = await Promise.all([
    readSheet("Appointments"),
    readSheet("Patients"),
    readSheet("Dentists"),
  ]);

  const sortedAppointments = [
    ...appointments,
  ].sort(compareAppointments);

  const patientMap = new Map(
    patients.map((patient) => [
      getPatientId(patient),
      patient,
    ]),
  );

  const dentistMap = new Map(
    dentists.map((dentist) => [
      getDentistId(dentist),
      dentist,
    ]),
  );

  const queueMap = {};

  return sortedAppointments.map(
    (appointment) => {
      const appointmentDate =
        normalizeText(
          appointment?.appointment_date,
        );

      const patient = patientMap.get(
        normalizeId(
          appointment?.patient_id,
        ),
      );

      const dentist = dentistMap.get(
        normalizeId(
          appointment?.dentist_id,
        ),
      );

      let queueNumber = null;

      /*
       * Cancelled appointments do not receive
       * a queue number.
       */
      if (!isCancelledAppointment(appointment)) {
        if (!queueMap[appointmentDate]) {
          queueMap[appointmentDate] = 1;
        }

        queueNumber =
          queueMap[appointmentDate];

        queueMap[appointmentDate] += 1;
      }

      return {
        ...appointment,

        queue_number:
          queueNumber,

        patient_name:
          patient?.name ??
          patient?.patient_name ??
          "",

        phone:
          patient?.phone ??
          patient?.mobile ??
          "",

        dentist_name:
          dentist?.name ??
          dentist?.dentist_name ??
          "",
      };
    },
  );
}

/* ========================================================
   Update appointment status
======================================================== */

export async function updateAppointmentStatus(
  id,
  status,
) {
  const normalizedAppointmentId =
    normalizeId(id);

  const normalizedStatus =
    normalizeText(status);

  if (!normalizedAppointmentId) {
    throw appError(
      "Appointment ID is required",
      400,
    );
  }

  if (!normalizedStatus) {
    throw appError(
      "Status is required",
      400,
    );
  }

  if (
    !APPOINTMENT_STATUSES.includes(
      normalizedStatus,
    )
  ) {
    throw appError(
      `Invalid status. Use ${APPOINTMENT_STATUSES.join(
        ", ",
      )}`,
      400,
    );
  }

  const appointments =
    await readSheet("Appointments");

  const index = appointments.findIndex(
    (appointment) => {
      return (
        getAppointmentId(appointment) ===
        normalizedAppointmentId
      );
    },
  );

  if (index === -1) {
    throw appError(
      "Appointment not found",
      404,
    );
  }

  const currentAppointment =
    appointments[index];

  const currentAppointmentDate =
    normalizeText(
      currentAppointment?.appointment_date ??
        currentAppointment?.date,
    );

  if (!currentAppointmentDate) {
    throw appError(
      "Appointment date is required",
      400,
    );
  }

  const currentStatus =
    normalizeText(
      currentAppointment?.status,
    ) || "Pending";

  const allowedStatuses =
    ALLOWED_STATUS_TRANSITIONS[
      currentStatus
    ];

  if (
    currentStatus !== normalizedStatus &&
    Array.isArray(allowedStatuses) &&
    !allowedStatuses.includes(
      normalizedStatus,
    )
  ) {
    throw appError(
      `Cannot change appointment status from ${currentStatus} to ${normalizedStatus}`,
      400,
    );
  }

  /*
   * Only one patient may be in treatment
   * for the selected date.
   */
  if (
    normalizedStatus ===
    "In Treatment"
  ) {
    const alreadyInTreatment =
      appointments.find((appointment) => {
        const appointmentDate =
          normalizeText(
            appointment?.appointment_date ??
              appointment?.date,
          );

        return (
          getAppointmentId(appointment) !==
            normalizedAppointmentId &&
          appointmentDate ===
            currentAppointmentDate &&
          normalizeText(
            appointment?.status,
          ) === "In Treatment"
        );
      });

    if (alreadyInTreatment) {
      throw appError(
        `Another appointment is already in treatment for ${currentAppointmentDate}`,
        400,
      );
    }
  }

  const timestamp = getNow();

  const updatedAppointment = {
    ...currentAppointment,

    status:
      normalizedStatus,

    updated_at:
      timestamp,
  };

  /*
   * Store each status timestamp only once.
   */
  if (
    normalizedStatus ===
      "Checked In" &&
    !currentAppointment.checked_in_time
  ) {
    updatedAppointment.checked_in_time =
      timestamp;
  }

  if (
    normalizedStatus ===
      "In Treatment" &&
    !currentAppointment
      .treatment_started_at
  ) {
    updatedAppointment.treatment_started_at =
      timestamp;
  }

  if (
    normalizedStatus ===
      "Treatment Done" &&
    !currentAppointment
      .treatment_completed_at
  ) {
    updatedAppointment.treatment_completed_at =
      timestamp;
  }

  if (
    normalizedStatus ===
      "Completed" &&
    !currentAppointment.completed_at
  ) {
    updatedAppointment.completed_at =
      timestamp;
  }

  appointments[index] =
    updatedAppointment;

  await writeSheet(
    "Appointments",
    appointments,
  );

  /*
   * Waiting queue includes only patients who
   * are currently in Checked In status.
   */
  const waitingQueue = appointments
    .filter((appointment) => {
      const appointmentDate =
        normalizeText(
          appointment?.appointment_date ??
            appointment?.date,
        );

      return (
        appointmentDate ===
          currentAppointmentDate &&
        normalizeText(
          appointment?.status,
        ) === "Checked In" &&
        appointment?.checked_in_time
      );
    })
    .sort((first, second) => {
      const firstTime = new Date(
        first.checked_in_time,
      ).getTime();

      const secondTime = new Date(
        second.checked_in_time,
      ).getTime();

      return firstTime - secondTime;
    })
    .map(
      (
        appointment,
        queueIndex,
      ) => ({
        ...appointment,

        current_queue_no:
          queueIndex + 1,
      }),
    );

  const queuePosition =
    waitingQueue.find(
      (appointment) => {
        return (
          getAppointmentId(
            appointment,
          ) === normalizedAppointmentId
        );
      },
    );

  return {
    appointment:
      updatedAppointment,

    queue_position:
      queuePosition?.current_queue_no ??
      null,

    waiting_queue:
      waitingQueue,
  };
}

/* ========================================================
   Update appointment
======================================================== */

export async function updateAppointment(
  id,
  data,
) {
  const normalizedAppointmentId =
    normalizeId(id);

  if (!normalizedAppointmentId) {
    throw appError(
      "Appointment ID is required",
      400,
    );
  }

  const appointments =
    await readSheet("Appointments");

  const index = appointments.findIndex(
    (appointment) => {
      return (
        getAppointmentId(appointment) ===
        normalizedAppointmentId
      );
    },
  );

  if (index === -1) {
    throw appError(
      "Appointment not found",
      404,
    );
  }

  if (
    data?.status &&
    !APPOINTMENT_STATUSES.includes(
      normalizeText(data.status),
    )
  ) {
    throw appError(
      `Invalid status. Use ${APPOINTMENT_STATUSES.join(
        ", ",
      )}`,
      400,
    );
  }

  const currentAppointment =
    appointments[index];

  appointments[index] = {
    ...currentAppointment,

    patient_id:
      data?.patient_id ??
      currentAppointment.patient_id,

    dentist_id:
      data?.dentist_id ??
      currentAppointment.dentist_id,

    appointment_number:
      data?.appointment_number ??
      currentAppointment.appointment_number,

    appointment_date:
      data?.appointment_date ??
      currentAppointment.appointment_date,

    appointment_time:
      data?.appointment_time ??
      currentAppointment.appointment_time,

    reason_for_visit:
      data?.reason_for_visit ??
      currentAppointment.reason_for_visit,

    status:
      data?.status ??
      currentAppointment.status,

    updated_at:
      getNow(),
  };

  await writeSheet(
    "Appointments",
    appointments,
  );

  return appointments[index];
}

/* ========================================================
   Get appointments
======================================================== */

export async function getAppointments(date) {
  const [
    appointments,
    patients,
    dentists,
    treatments,
    payments,
  ] = await Promise.all([
    readSheet("Appointments"),
    readSheet("Patients"),
    readSheet("Dentists"),
    readSheet("Treatments"),
    readSheet("Payments"),
  ]);

  const normalizedDate =
    normalizeText(date);

  let filteredAppointments =
    appointments;

  if (normalizedDate) {
    filteredAppointments =
      appointments.filter(
        (appointment) => {
          return (
            normalizeText(
              appointment
                ?.appointment_date,
            ) === normalizedDate
          );
        },
      );
  }

  filteredAppointments = [
    ...filteredAppointments,
  ].sort(compareAppointments);

  const patientMap = new Map(
    patients.map((patient) => [
      getPatientId(patient),
      patient,
    ]),
  );

  const dentistMap = new Map(
    dentists.map((dentist) => [
      getDentistId(dentist),
      dentist,
    ]),
  );

  const treatmentMap = new Map();

  treatments.forEach((treatment) => {
    const appointmentId =
      getTreatmentAppointmentId(
        treatment,
      );

    /*
     * Keep the first treatment associated
     * with an appointment.
     */
    if (
      appointmentId &&
      !treatmentMap.has(appointmentId)
    ) {
      treatmentMap.set(
        appointmentId,
        treatment,
      );
    }
  });

  const queueMap = {};

  return filteredAppointments.map(
    (appointment) => {
      const appointmentId =
        getAppointmentId(appointment);

      const appointmentDate =
        normalizeText(
          appointment?.appointment_date,
        );

      const patient = patientMap.get(
        normalizeId(
          appointment?.patient_id,
        ),
      );

      const dentist = dentistMap.get(
        normalizeId(
          appointment?.dentist_id,
        ),
      );

      const treatment =
        treatmentMap.get(
          appointmentId,
        );

      const {
        treatmentId,
        treatmentFee,
        treatmentPayments,
        totalPaid,
        remainingAmount,
        paymentStatus,
      } = createTreatmentPaymentData({
        treatment,
        payments,
      });

      let queueNumber = null;

      if (!isCancelledAppointment(appointment)) {
        if (!queueMap[appointmentDate]) {
          queueMap[appointmentDate] = 1;
        }

        queueNumber =
          queueMap[appointmentDate];

        queueMap[appointmentDate] += 1;
      }

      return {
        queue_no:
          queueNumber,

        appointment_id:
          appointmentId,

        id:
          appointmentId,

        patient_id:
          appointment?.patient_id,

        patient_name:
          patient?.name ??
          patient?.patient_name ??
          "",

        phone:
          patient?.phone ??
          patient?.mobile ??
          "",

        age:
          patient?.age ?? "",

        gender:
          patient?.gender ?? "",

        address:
          patient?.address ?? "",

        dentist_id:
          appointment?.dentist_id,

        dentist_name:
          dentist?.name ??
          dentist?.dentist_name ??
          "",

        appointment_date:
          appointment?.appointment_date,

        appointment_time:
          appointment?.appointment_time,

        appointment_number:
          appointment?.appointment_number,

        checked_in_time:
          appointment?.checked_in_time ??
          "",

        treatment_started_at:
          appointment
            ?.treatment_started_at ??
          "",

        treatment_completed_at:
          appointment
            ?.treatment_completed_at ??
          "",

        reason_for_visit:
          appointment?.reason_for_visit ??
          "",

        status:
          appointment?.status ?? "",

        treatment_id:
          treatmentId,

        treatment_date:
          treatment?.treatment_date ??
          "",

        next_appointment_date:
          treatment
            ?.next_appointment_date ??
          "",

        diagnosis:
          treatment?.diagnosis ?? "",

        tooth_number:
          treatment?.tooth_number ?? "",

        treatment_details:
          treatment
            ?.treatment_details ??
          treatment
            ?.treatment_performed ??
          "",

        doctor_notes:
          treatment?.doctor_notes ?? "",

        prescription:
          treatment?.prescription ?? "",

        treatment_fee:
          treatmentFee,

        treatment_charge:
          treatmentFee,

        total_paid:
          totalPaid,

        remaining_amount:
          remainingAmount,

        payment_status:
          paymentStatus,

        payment_count:
          treatmentPayments.length,

        created_at:
          appointment?.created_at,

        updated_at:
          appointment?.updated_at,
      };
    },
  );
}

/* ========================================================
   Get appointment by ID
======================================================== */

export async function getAppointmentById(id) {
  const normalizedAppointmentId =
    normalizeId(id);

  if (!normalizedAppointmentId) {
    throw appError(
      "Appointment ID is required",
      400,
    );
  }

  const [
    appointments,
    patients,
    dentists,
    treatments,
    payments,
  ] = await Promise.all([
    readSheet("Appointments"),
    readSheet("Patients"),
    readSheet("Dentists"),
    readSheet("Treatments"),
    readSheet("Payments"),
  ]);

  const appointment =
    appointments.find((item) => {
      return (
        getAppointmentId(item) ===
        normalizedAppointmentId
      );
    });

  if (!appointment) {
    throw appError(
      "Appointment not found",
      404,
    );
  }

  const patient = patients.find(
    (item) => {
      return (
        getPatientId(item) ===
        normalizeId(
          appointment?.patient_id,
        )
      );
    },
  );

  const dentist = dentists.find(
    (item) => {
      return (
        getDentistId(item) ===
        normalizeId(
          appointment?.dentist_id,
        )
      );
    },
  );

  const treatment = treatments.find(
    (item) => {
      return (
        getTreatmentAppointmentId(
          item,
        ) === normalizedAppointmentId
      );
    },
  );

  const {
    treatmentId,
    treatmentFee,
    treatmentPayments,
    totalPaid,
    remainingAmount,
    paymentStatus,
  } = createTreatmentPaymentData({
    treatment,
    payments,
  });

  const sameDayAppointments =
    appointments
      .filter((item) => {
        return (
          normalizeText(
            item?.appointment_date,
          ) ===
            normalizeText(
              appointment
                ?.appointment_date,
            ) &&
          !isCancelledAppointment(item)
        );
      })
      .sort(compareAppointments);

  const queueIndex =
    sameDayAppointments.findIndex(
      (item) => {
        return (
          getAppointmentId(item) ===
          normalizedAppointmentId
        );
      },
    );

  return {
    appointment_id:
      normalizedAppointmentId,

    id:
      normalizedAppointmentId,

    queue_no:
      isCancelledAppointment(appointment)
        ? null
        : queueIndex >= 0
          ? queueIndex + 1
          : null,

    patient_id:
      appointment?.patient_id,

    patient_name:
      patient?.name ??
      patient?.patient_name ??
      "",

    phone:
      patient?.phone ??
      patient?.mobile ??
      "",

    age:
      patient?.age ?? "",

    gender:
      patient?.gender ?? "",

    address:
      patient?.address ?? "",

    dentist_id:
      appointment?.dentist_id,

    dentist_name:
      dentist?.name ??
      dentist?.dentist_name ??
      "",

    appointment_date:
      appointment?.appointment_date,

    appointment_time:
      appointment?.appointment_time,

    appointment_number:
      appointment?.appointment_number,

    checked_in_time:
      appointment?.checked_in_time ??
      "",

    treatment_started_at:
      appointment
        ?.treatment_started_at ??
      "",

    treatment_completed_at:
      appointment
        ?.treatment_completed_at ??
      "",

    completed_at:
      appointment?.completed_at ??
      "",

    reason_for_visit:
      appointment?.reason_for_visit ??
      "",

    status:
      appointment?.status ?? "",

    treatment_id:
      treatmentId,

    treatment_date:
      treatment?.treatment_date ??
      "",

    next_appointment_date:
      treatment
        ?.next_appointment_date ??
      "",

    diagnosis:
      treatment?.diagnosis ?? "",

    tooth_number:
      treatment?.tooth_number ?? "",

    treatment_details:
      treatment?.treatment_details ??
      treatment?.treatment_performed ??
      "",

    doctor_notes:
      treatment?.doctor_notes ?? "",

    prescription:
      treatment?.prescription ?? "",

    treatment_fee:
      treatmentFee,

    treatment_charge:
      treatmentFee,

    total_paid:
      totalPaid,

    remaining_amount:
      remainingAmount,

    payment_status:
      paymentStatus,

    payment_count:
      treatmentPayments.length,

    payments:
      treatmentPayments,

    created_at:
      appointment?.created_at,

    updated_at:
      appointment?.updated_at,
  };
}

/* ========================================================
   Get appointments by date range
======================================================== */

export async function getAppointmentsByDateRange(
  startDate,
  endDate,
) {
  if (!startDate || !endDate) {
    throw appError(
      "Start date and end date are required",
      400,
    );
  }

  const appointments =
    await readSheet("Appointments");

  return filterByDateRange(
    appointments,
    "appointment_date",
    startDate,
    endDate,
  ).sort(compareAppointments);
}

/* ========================================================
   Get full appointment details
======================================================== */

export async function getAppointmentFullDetailsService(
  appointmentId,
) {
  const normalizedAppointmentId =
    normalizeId(appointmentId);

  if (!normalizedAppointmentId) {
    throw appError(
      "Appointment ID is required",
      400,
    );
  }

  const [
    appointments,
    patients,
    dentists,
    treatments,
    payments,
  ] = await Promise.all([
    readSheet("Appointments"),
    readSheet("Patients"),
    readSheet("Dentists"),
    readSheet("Treatments"),
    readSheet("Payments"),
  ]);

  const appointment =
    appointments.find((item) => {
      return (
        getAppointmentId(item) ===
        normalizedAppointmentId
      );
    });

  if (!appointment) {
    throw appError(
      "Appointment not found",
      404,
    );
  }

  const patient =
    patients.find((item) => {
      return (
        getPatientId(item) ===
        normalizeId(
          appointment?.patient_id,
        )
      );
    }) ?? null;

  const dentist =
    dentists.find((item) => {
      return (
        getDentistId(item) ===
        normalizeId(
          appointment?.dentist_id,
        )
      );
    }) ?? null;

  const appointmentTreatments =
    treatments.filter((item) => {
      return (
        getTreatmentAppointmentId(
          item,
        ) === normalizedAppointmentId
      );
    });

  const treatmentIds =
    appointmentTreatments
      .map(getTreatmentId)
      .filter(Boolean);

  const appointmentPayments =
    payments.filter((payment) => {
      const paymentAppointmentId =
        normalizeId(
          payment?.appointment_id,
        );

      const paymentTreatmentId =
        normalizeId(
          payment?.treatment_id,
        );

      return (
        paymentAppointmentId ===
          normalizedAppointmentId ||
        treatmentIds.includes(
          paymentTreatmentId,
        )
      );
    });

  /*
   * Calculate treatment charge from Treatments.
   * This prevents duplicate treatment charges when
   * one treatment has multiple payment installments.
   */
  const totalTreatmentCharge =
    appointmentTreatments.reduce(
      (total, treatment) => {
        return (
          total +
          toNumber(
            treatment?.treatment_fee ??
              treatment
                ?.treatment_charge,
          )
        );
      },
      0,
    );

  const totalPaid =
    appointmentPayments.reduce(
      (total, payment) => {
        return (
          total +
          toNumber(
            payment?.payment_amount ??
              payment?.amount,
          )
        );
      },
      0,
    );

  const balance = Math.max(
    totalTreatmentCharge - totalPaid,
    0,
  );

  let paymentStatus = "Unpaid";

  if (
    totalTreatmentCharge > 0 &&
    totalPaid >= totalTreatmentCharge
  ) {
    paymentStatus = "Paid";
  } else if (totalPaid > 0) {
    paymentStatus = "Partial";
  }

  return {
    appointment,
    patient,
    dentist,

    treatments:
      appointmentTreatments,

    payments:
      appointmentPayments,

    payment_summary: {
      total_treatment_charge:
        totalTreatmentCharge,

      total_paid:
        totalPaid,

      balance,

      payment_status:
        paymentStatus,
    },
  };
}

/* ========================================================
   Get appointment using treatment ID
======================================================== */

export async function getAppointmentByTreatmentId({
  treatmentId,
}) {
  const normalizedTreatmentId =
    normalizeId(treatmentId);

  if (normalizedTreatmentId) {
    const [
      appointments,
      treatments,
    ] = await Promise.all([
      readSheet("Appointments"),
      readSheet("Treatments"),
    ]);

    const treatment =
      treatments.find((item) => {
        return (
          getTreatmentId(item) ===
          normalizedTreatmentId
        );
      });

    if (!treatment) {
      throw appError(
        "Treatment not found",
        404,
      );
    }

    const appointmentId =
      getTreatmentAppointmentId(
        treatment,
      );

    if (!appointmentId) {
      throw appError(
        "Appointment ID is not available for this treatment",
        404,
      );
    }

    const appointment =
      appointments.find((item) => {
        return (
          getAppointmentId(item) ===
          appointmentId
        );
      });

    if (!appointment) {
      throw appError(
        "Appointment not found for this treatment",
        404,
      );
    }

    return {
      type: "single",
      data: appointment,
    };
  }

  const appointments =
    await readSheet("Appointments");

  const sortedAppointments = [
    ...appointments,
  ].sort(compareAppointments);

  return {
    type: "list",
    data: sortedAppointments,
    total: sortedAppointments.length,
  };
}