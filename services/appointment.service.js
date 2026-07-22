import { readSheet, writeSheet } from "../utils/excelDb.js";

import appError from "../utils/appError.js";
const APPOINTMENT_STATUSES = [
  "Pending",
  "Confirmed",
  "Checked In",
  "In Treatment",
  "Treatment Done",
  "Payment Pending",
  "Paid",
  "Completed",
  "Cancelled",
];
function getNow() {
  return new Date().toISOString();
}

export function createAppointment(data) {
  const appointments = readSheet("Appointments");

  if (!data.patient_id) {
    throw appError("Patient is required", 400);
  }

  if (!data.dentist_id) {
    throw appError("Dentist is required", 400);
  }

  if (!data.appointment_date) {
    throw appError("Appointment date is required", 400);
  }

  if (!data.appointment_time) {
    throw appError("Appointment time is required", 400);
  }

  const formattedDate = data.appointment_date.replaceAll("-", "");

  const newId = `APP_${formattedDate}_${String(
    appointments.length + 1,
  ).padStart(4, "0")}`;

  const appointment = {
    id: newId,
    patient_id: data.patient_id,
    dentist_id: data.dentist_id,
    appointment_date: data.appointment_date,
    appointment_time: data.appointment_time,
    reason_for_visit: data.reason_for_visit || "",
    status: data.status || "Pending",
    created_at: getNow(),
    updated_at: getNow(),
  };

  appointments.push(appointment);
  writeSheet("Appointments", appointments);

  return appointment;
}
export function getAllAppointments() {
  const appointments = readSheet("Appointments");
  const patients = readSheet("Patients");
  const dentists = readSheet("Dentists");

  // Sort by date then time
  appointments.sort((a, b) => {
    if (a.appointment_date !== b.appointment_date) {
      return a.appointment_date.localeCompare(b.appointment_date);
    }

    return a.appointment_time.localeCompare(b.appointment_time);
  });

  // Queue counter for each day
  const queueMap = {};

  return appointments.map((appointment) => {
    const patient = patients.find((p) => p.id === appointment.patient_id);
    const dentist = dentists.find((d) => d.id === appointment.dentist_id);

    if (!queueMap[appointment.appointment_date]) {
      queueMap[appointment.appointment_date] = 1;
    }

    const queue_number = queueMap[appointment.appointment_date]++;

    return {
      ...appointment,
      queue_number,
      patient_name: patient?.name || "",
      phone: patient?.phone || "",
      dentist_name: dentist?.name || "",
    };
  });
}
export function updateAppointmentStatus(id, status) {
  const appointments = readSheet("Appointments");

  if (!id) {
    throw appError("Appointment ID is required", 400);
  }

  if (!status) {
    throw appError("Status is required", 400);
  }

  if (!APPOINTMENT_STATUSES.includes(status)) {
    throw appError(
      "Invalid status. Use Pending, Confirmed, Checked In, In Treatment, Treatment Done, Payment Pending, Paid, Completed, or Cancelled",
      400,
    );
  }

  const index = appointments.findIndex((appointment) => appointment.id === id);

  if (index === -1) {
    throw appError("Appointment not found", 404);
  }

  const currentAppointment = appointments[index];

  const currentAppointmentDate =
    currentAppointment.appointment_date || currentAppointment.date;

  if (!currentAppointmentDate) {
    throw appError("Appointment date is required", 400);
  }

  /*
   * Validate status workflow
   */
  const allowedTransitions = {
    Pending: ["Confirmed", "Checked In", "Cancelled"],
    Confirmed: ["Checked In", "Cancelled"],
    "Checked In": ["In Treatment", "Cancelled"],
    "In Treatment": ["Treatment Done"],
    "Treatment Done": ["Payment Pending", "Paid"],
    "Payment Pending": ["Paid", "Completed"],
    Paid: ["Completed"],
    Completed: [],
    Cancelled: [],
  };

  const currentStatus = currentAppointment.status;

  if (
    currentStatus &&
    allowedTransitions[currentStatus] &&
    !allowedTransitions[currentStatus].includes(status) &&
    currentStatus !== status
  ) {
    throw appError(
      `Cannot change appointment status from ${currentStatus} to ${status}`,
      400,
    );
  }

  /*
   * Only one appointment can be in treatment
   * for the same appointment date.
   */
  if (status === "In Treatment") {
    const alreadyInTreatment = appointments.find((appointment) => {
      const appointmentDate = appointment.appointment_date || appointment.date;

      return (
        appointment.id !== id &&
        appointmentDate === currentAppointmentDate &&
        appointment.status === "In Treatment"
      );
    });

    if (alreadyInTreatment) {
      throw appError(
        `Another appointment is already in treatment for ${currentAppointmentDate}`,
        400,
      );
    }
  }

  const updatedAppointment = {
    ...currentAppointment,
    status,
    updated_at: getNow(),
  };

  /*
   * Save the check-in time only once.
   *
   * Updating the appointment later will not overwrite
   * the original check-in time.
   */
  if (status === "Checked In" && !currentAppointment.checked_in_time) {
    updatedAppointment.checked_in_time = getNow();
  }

  /*
   * Save when treatment begins.
   */
  if (status === "In Treatment" && !currentAppointment.treatment_started_at) {
    updatedAppointment.treatment_started_at = getNow();
  }

  /*
   * Save when treatment finishes.
   */
  if (
    status === "Treatment Done" &&
    !currentAppointment.treatment_completed_at
  ) {
    updatedAppointment.treatment_completed_at = getNow();
  }

  /*
   * Save when appointment is completed.
   */
  if (status === "Completed" && !currentAppointment.completed_at) {
    updatedAppointment.completed_at = getNow();
  }

  appointments[index] = updatedAppointment;

  writeSheet("Appointments", appointments);

  /*
   * Create current waiting queue using check-in time.
   *
   * Only checked-in patients from the same date
   * are included.
   */
  const waitingQueue = appointments
    .filter((appointment) => {
      const appointmentDate = appointment.appointment_date || appointment.date;

      return (
        appointmentDate === currentAppointmentDate &&
        appointment.status === "Checked In" &&
        appointment.checked_in_time
      );
    })
    .sort(
      (a, b) =>
        new Date(a.checked_in_time).getTime() -
        new Date(b.checked_in_time).getTime(),
    )
    .map((appointment, queueIndex) => ({
      ...appointment,
      current_queue_no: queueIndex + 1,
    }));

  const queuePosition = waitingQueue.find(
    (appointment) => appointment.id === id,
  );

  return {
    appointment: appointments[index],
    queue_position: queuePosition?.current_queue_no || null,
    waiting_queue: waitingQueue,
  };
}

export function updateAppointment(id, data) {
  const appointments = readSheet("Appointments");

  if (!id) {
    throw appError("Appointment ID is required", 400);
  }

  const index = appointments.findIndex((appointment) => appointment.id === id);

  if (index === -1) {
    throw appError("Appointment not found", 404);
  }

  if (data.status && !APPOINTMENT_STATUSES.includes(data.status)) {
    throw appError(
      "Invalid status. Use Pending, Confirmed, Completed, or Cancelled",
      400,
    );
  }

  appointments[index] = {
    ...appointments[index],

    patient_id: data.patient_id ?? appointments[index].patient_id,
    dentist_id: data.dentist_id ?? appointments[index].dentist_id,
    appointment_date:
      data.appointment_date ?? appointments[index].appointment_date,
    appointment_time:
      data.appointment_time ?? appointments[index].appointment_time,
    reason_for_visit:
      data.reason_for_visit ?? appointments[index].reason_for_visit,
    status: data.status ?? appointments[index].status,

    updated_at: getNow(),
  };

  writeSheet("Appointments", appointments);

  return appointments[index];
}
export function getAppointments(date) {
  const appointments = readSheet("Appointments");
  const patients = readSheet("Patients");
  const dentists = readSheet("Dentists");
  const treatments = readSheet("Treatments");
  const payments = readSheet("Payments");

  let filteredAppointments = appointments;

  if (date) {
    filteredAppointments = appointments.filter(
      (appointment) =>
        String(appointment.appointment_date).trim() === String(date).trim(),
    );
  }

  /*
   * Sort by appointment date and appointment time before
   * generating the queue number.
   */
  filteredAppointments = [...filteredAppointments].sort((a, b) => {
    const dateA = String(a.appointment_date || "");
    const dateB = String(b.appointment_date || "");

    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }

    const timeA = String(a.appointment_time || "");
    const timeB = String(b.appointment_time || "");

    return timeA.localeCompare(timeB);
  });

  return filteredAppointments.map((appointment, index) => {
    const patient = patients.find(
      (item) =>
        String(item.id).trim() === String(appointment.patient_id).trim(),
    );

    const dentist = dentists.find(
      (item) =>
        String(item.id).trim() === String(appointment.dentist_id).trim(),
    );

    const treatment = treatments.find((item) => {
      const treatmentAppointmentId =
        item.appointment_id || item.appointmentId || item.appointmentID || "";

      return (
        String(treatmentAppointmentId).trim() === String(appointment.id).trim()
      );
    });

    const treatmentId = treatment?.id || "";

    const treatmentFee = Number(
      treatment?.treatment_fee ?? treatment?.treatment_fee ?? 0,
    );

    const treatmentPayments = treatmentId
      ? payments.filter(
          (payment) =>
            String(payment.treatment_id).trim() === String(treatmentId).trim(),
        )
      : [];

    const totalPaid = treatmentPayments.reduce(
      (total, payment) => total + Number(payment.payment_amount || 0),
      0,
    );

    const remainingAmount = Math.max(treatmentFee - totalPaid, 0);

    let paymentStatus = "Not Paid";

    if (treatmentFee > 0 && totalPaid >= treatmentFee) {
      paymentStatus = "Paid";
    } else if (totalPaid > 0) {
      paymentStatus = "Partial";
    }

    return {
      queue_no: index + 1,

      appointment_id: appointment.id,
      id: appointment.id,

      patient_id: appointment.patient_id,
      patient_name: patient?.name || "",
      phone: patient?.phone || "",
      age: patient?.age || "",
      gender: patient?.gender || "",
      address: patient?.address || "",

      dentist_id: appointment.dentist_id,
      dentist_name: dentist?.name || "",

      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      checked_in_time: appointment.checked_in_time || "",
      reason_for_visit: appointment.reason_for_visit || "",
      status: appointment.status || "",

      treatment_id: treatmentId,
      treatment_date: treatment?.treatment_date || "",
      next_appointment_date: treatment?.next_appointment_date || "",
      doctor_notes: treatment?.doctor_notes || "",
      prescription: treatment?.prescription || "",

      // Current Excel column spelling
      treatment_fee: treatmentFee,

      // Compatibility aliases
      treatment_fee: treatmentFee,
      treatment_charge: treatmentFee,

      total_paid: totalPaid,
      remaining_amount: remainingAmount,
      payment_status: paymentStatus,
      payment_count: treatmentPayments.length,

      created_at: appointment.created_at,
      updated_at: appointment.updated_at,
    };
  });
}
export function getAppointmentById(id) {
  const appointments = readSheet("Appointments");
  const patients = readSheet("Patients");
  const dentists = readSheet("Dentists");
  const treatments = readSheet("Treatments");
  const payments = readSheet("Payments");

  const appointment = appointments.find(
    (item) => String(item.id).trim() === String(id).trim(),
  );

  if (!appointment) {
    throw appError("Appointment not found", 404);
  }

  const patient = patients.find((item) => item.id === appointment.patient_id);

  const dentist = dentists.find((item) => item.id === appointment.dentist_id);

  const treatment = treatments.find((item) => {
    const treatmentAppointmentId =
      item.appointment_id || item.appointmentId || item.appointmentID || "";

    return (
      String(treatmentAppointmentId).trim() === String(appointment.id).trim()
    );
  });

  const treatmentId = treatment?.id || "";

  const treatmentFee = Number(
    treatment?.treatment_fee ?? treatment?.treatment_fee ?? 0,
  );

  const treatmentPayments = treatmentId
    ? payments.filter(
        (payment) =>
          String(payment.treatment_id).trim() === String(treatmentId).trim(),
      )
    : [];

  const totalPaid = treatmentPayments.reduce(
    (total, payment) => total + Number(payment.payment_amount || 0),
    0,
  );

  const remainingAmount = Math.max(treatmentFee - totalPaid, 0);

  let paymentStatus = "Not Paid";

  if (treatmentFee > 0 && totalPaid >= treatmentFee) {
    paymentStatus = "Paid";
  } else if (totalPaid > 0) {
    paymentStatus = "Partial";
  }

  const sameDayAppointments = appointments
    .filter((item) => item.appointment_date === appointment.appointment_date)
    .sort((a, b) => {
      const timeA = a.appointment_time || "";
      const timeB = b.appointment_time || "";

      return timeA.localeCompare(timeB);
    });

  const queueIndex = sameDayAppointments.findIndex(
    (item) => item.id === appointment.id,
  );

  return {
    appointment_id: appointment.id,
    id: appointment.id,
    queue_no: queueIndex >= 0 ? queueIndex + 1 : 0,

    patient_id: appointment.patient_id,
    patient_name: patient?.name || "",
    phone: patient?.phone || "",
    age: patient?.age || "",
    gender: patient?.gender || "",
    address: patient?.address || "",

    dentist_id: appointment.dentist_id,
    dentist_name: dentist?.name || "",

    appointment_date: appointment.appointment_date,
    appointment_time: appointment.appointment_time,
    reason_for_visit: appointment.reason_for_visit || "",
    status: appointment.status || "",

    treatment_id: treatmentId,
    treatment_date: treatment?.treatment_date || "",
    next_appointment_date: treatment?.next_appointment_date || "",
    doctor_notes: treatment?.doctor_notes || "",
    prescription: treatment?.prescription || "",

    // Keep the current Excel spelling
    treatment_fee: treatmentFee,

    // Aliases for frontend compatibility
    treatment_fee: treatmentFee,
    treatment_charge: treatmentFee,

    total_paid: totalPaid,
    remaining_amount: remainingAmount,
    payment_status: paymentStatus,
    payment_count: treatmentPayments.length,

    created_at: appointment.created_at,
    updated_at: appointment.updated_at,
  };
}

const filterByDateRange = (records, dateField, startDate, endDate) => {
  return records.filter((record) => {
    const recordDate = String(record?.[dateField] || "")
      .trim()
      .slice(0, 10);

    return recordDate && recordDate >= startDate && recordDate <= endDate;
  });
};

export function getAppointmentsByDateRange(startDate, endDate) {
  const appointments = readSheet("Appointments");
  return filterByDateRange(
    appointments,
    "appointment_date",
    startDate,
    endDate,
  ).sort((a, b) => {
    const dateCompare = String(a.appointment_date || "").localeCompare(
      String(b.appointment_date || ""),
    );

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return String(a.appointment_time || "").localeCompare(
      String(b.appointment_time || ""),
    );
  });
}

export function getAppointmentFullDetailsService(appointmentId) {
  const appointments = readSheet("Appointments");
  const patients = readSheet("Patients");
  const dentists = readSheet("Dentists");
  const treatments = readSheet("Treatments");
  const payments = readSheet("Payments");

  const appointment = appointments.find(
    (item) => String(item.id || item.id) === String(appointmentId),
  );

  if (!appointment) {
    const error = new Error("Appointment not found");
    error.statusCode = 404;
    throw error;
  }

  const appointmentPatientId = appointment.patient_id;

  const appointmentDentistId = appointment.dentist_id;

  const patient =
    patients.find(
      (item) =>
        String(item.id || item.patient_id) === String(appointmentPatientId),
    ) || null;

  const dentist =
    dentists.find(
      (item) =>
        String(item.id || item.dentist_id) === String(appointmentDentistId),
    ) || null;

  const appointmentTreatments = treatments.filter(
    (item) => String(item.appointment_id) === String(appointmentId),
  );

  const treatmentIds = appointmentTreatments.map((item) =>
    String(item.id || item.treatment_id),
  );

  const appointmentPayments = payments.filter((payment) => {
    const paymentAppointmentId = payment.appointment_id;

    const paymentTreatmentId = String(payment.treatment_id || "");

    return (
      String(paymentAppointmentId || "") === String(appointmentId) ||
      treatmentIds.includes(paymentTreatmentId)
    );
  });

  const totalTreatmentCharge = appointmentPayments.reduce(
    (total, payment) =>
      total +
      Number(
        payment.treatment_charge ??
          payment.treatment_fee ??
          payment.charge ??
          0,
      ),
    0,
  );

  const totalPaid = appointmentPayments.reduce(
    (total, payment) =>
      total + Number(payment.payment_amount ?? payment.amount ?? 0),
    0,
  );

  return {
    appointment,
    patient,
    dentist,
    treatments: appointmentTreatments,
    payments: appointmentPayments,
    payment_summary: {
      total_treatment_charge: totalTreatmentCharge,
      total_paid: totalPaid,
      balance: Math.max(totalTreatmentCharge - totalPaid, 0),
      payment_status:
        totalPaid <= 0
          ? "Unpaid"
          : totalPaid < totalTreatmentCharge
            ? "Partial"
            : "Paid",
    },
  };
}

export function getAppointmentByTreatmentId({ treatmentId }) {
  const appointments = readSheet("Appointments");
  /* -----------------------------------------------------
     Get appointment using treatment ID
  ----------------------------------------------------- */
  if (treatmentId) {
    const treatments = readSheet("Treatments");

    const treatment = treatments.find(
      (item) =>
        String(item.id || item.treatment_id).trim() ===
        String(treatmentId).trim(),
    );

    if (!treatment) {
      const error = new Error("Treatment not found");

      error.statusCode = 404;
      throw error;
    }

    const appointmentId = treatment.appointment_id || treatment.appointmentId;

    if (!appointmentId) {
      const error = new Error(
        "Appointment ID is not available for this treatment",
      );

      error.statusCode = 404;
      throw error;
    }

    const appointment = appointments.find(
      (item) =>
        String(item.id || item.appointment_id).trim() ===
        String(appointmentId).trim(),
    );

    if (!appointment) {
      const error = new Error("Appointment not found for this treatment");

      error.statusCode = 404;
      throw error;
    }

    return {
      type: "single",
      data: appointment,
    };
  }

  /* -----------------------------------------------------
     Filter appointments using date
  ----------------------------------------------------- */
  let filteredAppointments = appointments;

  return {
    type: "list",
    data: filteredAppointments,
    total: filteredAppointments.length,
  };
}
