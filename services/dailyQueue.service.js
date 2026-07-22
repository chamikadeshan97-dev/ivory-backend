import { readSheet, readSheets, writeSheet } from "../utils/excelDb.js";

const QUEUE_STATUSES = [
  "Waiting",
  "In Treatment",
  "Treatment Done",
  "Payment Pending",
  "Paid",
  "Completed",
  "Cancelled",
];

const APPOINTMENT_STATUS_BY_QUEUE_STATUS = {
  Waiting: "Checked In",
  "In Treatment": "In Treatment",
  "Treatment Done": "Treatment Done",
  "Payment Pending": "Payment Pending",
  Paid: "Paid",
  Completed: "Completed",
  Cancelled: "Cancelled",
};

const getTodayDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
};

const getNow = () => new Date().toISOString();

const generateId = (rows, prefix) => {
  const maxNumber = rows.reduce((max, row) => {
    const id = String(row.id || "");
    const number = Number(id.replace(`${prefix}_`, ""));

    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);

  return `${prefix}_${String(maxNumber + 1).padStart(4, "0")}`;
};

const getNextQueueNo = (queueRows, queueDate) => {
  const maxQueueNo = queueRows
    .filter((row) => row.queue_date === queueDate)
    .reduce((max, row) => {
      const queueNo = Number(row.queue_no || 0);
      return Number.isFinite(queueNo) ? Math.max(max, queueNo) : max;
    }, 0);

  return maxQueueNo + 1;
};

export const getQueueByDateService = (date = getTodayDate()) => {
  const queueRows = readSheet("DailyQueue");

  return queueRows
    .filter((row) => row.queue_date === date)
    .sort((a, b) => Number(a.queue_no || 0) - Number(b.queue_no || 0));
};

export const getQueueItemByIdService = (id) => {
  const queueRows = readSheet("DailyQueue");

  const queueItem = queueRows.find((row) => row.id === id);

  if (!queueItem) {
    throw new Error("Queue item not found");
  }

  return queueItem;
};

export const checkInAppointmentService = ({ appointment_id, queue_date }) => {
  if (!appointment_id) {
    throw new Error("appointment_id is required");
  }

  const queueDate = queue_date || getTodayDate();
  const now = getNow();

  const { Appointments, Patients, Dentists, DailyQueue } = readSheets([
    "Appointments",
    "Patients",
    "Dentists",
    "DailyQueue",
  ]);

  const appointment = Appointments.find((item) => item.id === appointment_id);

  if (!appointment) {
    throw new Error("Appointment not found");
  }

  if (appointment.status === "Cancelled") {
    throw new Error("Cancelled appointment cannot be added to queue");
  }

  const alreadyInQueue = DailyQueue.find(
    (item) =>
      item.appointment_id === appointment_id &&
      item.queue_date === queueDate &&
      item.status !== "Cancelled"
  );

  if (alreadyInQueue) {
    throw new Error("This appointment is already added to today's queue");
  }

  const patient = Patients.find((item) => item.id === appointment.patient_id);
  const dentist = Dentists.find((item) => item.id === appointment.dentist_id);

  const newQueueItem = {
    id: generateId(DailyQueue, "QUE"),
    queue_date: queueDate,
    queue_no: getNextQueueNo(DailyQueue, queueDate),
    appointment_id: appointment.id,
    patient_id: appointment.patient_id,
    dentist_id: appointment.dentist_id,
    patient_name: patient?.name || "",
    phone: patient?.phone || "",
    reason_for_visit: appointment.reason_for_visit || "",
    source: "Appointment",
    status: "Waiting",
    arrived_at: now,
    called_at: "",
    completed_at: "",
    created_at: now,
    updated_at: now,
  };

  const updatedAppointments = Appointments.map((item) =>
    item.id === appointment_id
      ? {
          ...item,
          status: "Checked In",
          updated_at: now,
        }
      : item
  );

  writeSheet("DailyQueue", [...DailyQueue, newQueueItem]);
  writeSheet("Appointments", updatedAppointments);

  return newQueueItem;
};

export const addWalkInToQueueService = ({
  patient_id,
  dentist_id,
  reason_for_visit,
  queue_date,
}) => {
  if (!patient_id) {
    throw new Error("patient_id is required");
  }

  const queueDate = queue_date || getTodayDate();
  const now = getNow();

  const { Patients, Dentists, DailyQueue } = readSheets([
    "Patients",
    "Dentists",
    "DailyQueue",
  ]);

  const patient = Patients.find((item) => item.id === patient_id);

  if (!patient) {
    throw new Error("Patient not found");
  }

  const dentist = Dentists.find((item) => item.id === dentist_id);

  const newQueueItem = {
    id: generateId(DailyQueue, "QUE"),
    queue_date: queueDate,
    queue_no: getNextQueueNo(DailyQueue, queueDate),
    appointment_id: "",
    patient_id,
    dentist_id: dentist_id || "",
    patient_name: patient.name || "",
    phone: patient.phone || "",
    reason_for_visit: reason_for_visit || "",
    source: "Walk In",
    status: "Waiting",
    arrived_at: now,
    called_at: "",
    completed_at: "",
    created_at: now,
    updated_at: now,
  };

  writeSheet("DailyQueue", [...DailyQueue, newQueueItem]);

  return newQueueItem;
};

export const updateQueueStatusService = ({ id, status }) => {
  if (!id) {
    throw new Error("Queue id is required");
  }

  if (!status) {
    throw new Error("status is required");
  }

  if (!QUEUE_STATUSES.includes(status)) {
    throw new Error("Invalid queue status");
  }

  const now = getNow();

  const { DailyQueue, Appointments } = readSheets([
    "DailyQueue",
    "Appointments",
  ]);

  const queueItem = DailyQueue.find((item) => item.id === id);

  if (!queueItem) {
    throw new Error("Queue item not found");
  }

  const updatedQueueRows = DailyQueue.map((item) => {
    if (item.id !== id) return item;

    return {
      ...item,
      status,
      called_at:
        status === "In Treatment" && !item.called_at ? now : item.called_at,
      completed_at:
        ["Completed", "Cancelled"].includes(status) && !item.completed_at
          ? now
          : item.completed_at,
      updated_at: now,
    };
  });

  writeSheet("DailyQueue", updatedQueueRows);

  if (queueItem.appointment_id) {
    const appointmentStatus = APPOINTMENT_STATUS_BY_QUEUE_STATUS[status];

    const updatedAppointments = Appointments.map((item) =>
      item.id === queueItem.appointment_id
        ? {
            ...item,
            status: appointmentStatus,
            updated_at: now,
          }
        : item
    );

    writeSheet("Appointments", updatedAppointments);
  }

  return updatedQueueRows.find((item) => item.id === id);
};

export const getNextQueuePatientService = (date = getTodayDate()) => {
  const queueRows = getQueueByDateService(date);

  return (
    queueRows.find((item) => item.status === "Waiting") || null
  );
};

export const getCurrentQueuePatientService = (date = getTodayDate()) => {
  const queueRows = getQueueByDateService(date);

  return (
    queueRows.find((item) => item.status === "In Treatment") || null
  );
};

export const getPreviousQueuePatientService = (date = getTodayDate()) => {
  const completedStatuses = [
    "Treatment Done",
    "Payment Pending",
    "Paid",
    "Completed",
  ];

  const queueRows = getQueueByDateService(date);

  return (
    queueRows
      .filter((item) => completedStatuses.includes(item.status))
      .sort((a, b) => Number(b.queue_no || 0) - Number(a.queue_no || 0))[0] ||
    null
  );
};

export const deleteQueueItemService = (id) => {
  if (!id) {
    throw new Error("Queue id is required");
  }

  const queueRows = readSheet("DailyQueue");

  const exists = queueRows.some((item) => item.id === id);

  if (!exists) {
    throw new Error("Queue item not found");
  }

  const updatedRows = queueRows.filter((item) => item.id !== id);

  writeSheet("DailyQueue", updatedRows);

  return true;
};