import { readSheet, writeSheet } from "../utils/excelDb.js";

const IN_WAITING_SHEET = "InWaiting";
const APPOINTMENTS_SHEET = "Appointments";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeValue = (value) => {
  return String(value ?? "").trim();
};

const createServiceError = (message, code) => {
  const error = new Error(message);
  error.code = code;

  return error;
};

const getCurrentDateTime = () => {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(now);

  const values = parts.reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }

    return result;
  }, {});

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
};

const findAppointment = async (appointmentId) => {
  const appointments = await readSheet(APPOINTMENTS_SHEET);

  return appointments.find(
    (appointment) =>
      normalizeValue(appointment.id) === normalizeValue(appointmentId),
  );
};

/*
|--------------------------------------------------------------------------
| Get all waiting records
|--------------------------------------------------------------------------
*/

export const getAllInWaitingRecords = async () => {
  const records = await readSheet(IN_WAITING_SHEET);

  return records;
};

/*
|--------------------------------------------------------------------------
| Get active waiting records
|--------------------------------------------------------------------------
*/

export const getActiveInWaitingRecords = async () => {
  const records = await readSheet(IN_WAITING_SHEET);

  return records.filter((record) => {
    const startTime = normalizeValue(record.start_time);
    const endTime = normalizeValue(record.end_time);

    return Boolean(startTime) && !endTime;
  });
};

/*
|--------------------------------------------------------------------------
| Get record by appointment ID
|--------------------------------------------------------------------------
*/

export const getInWaitingByAppointmentId = async (appointmentId) => {
  if (!normalizeValue(appointmentId)) {
    throw new Error("Appointment ID is required.");
  }

  const records = await readSheet(IN_WAITING_SHEET);

  return (
    records.find(
      (record) =>
        normalizeValue(record.id) === normalizeValue(appointmentId),
    ) || null
  );
};

/*
|--------------------------------------------------------------------------
| Start appointment waiting
|--------------------------------------------------------------------------
*/

export const startAppointmentWaiting = async (
  appointmentId,
) => {
  const normalizedAppointmentId = String(
    appointmentId || "",
  ).trim();

  if (!normalizedAppointmentId) {
    const error = new Error(
      "Appointment ID is required.",
    );

    error.code = "APPOINTMENT_ID_REQUIRED";

    throw error;
  }

  const appointments = readSheet(
    "Appointments",
  );

  const appointmentExists =
    appointments.some((appointment) => {
      return (
        String(
          appointment?.id ||
            appointment?.appointment_id ||
            "",
        ).trim() === normalizedAppointmentId
      );
    });

  if (!appointmentExists) {
    const error = new Error(
      "Appointment not found.",
    );

    error.code =
      "APPOINTMENT_NOT_FOUND";

    throw error;
  }

  const waitingRecords = readSheet(
    "InWaiting",
  );

  const currentTime =
    new Date().toISOString();

  const existingRecordIndex =
    waitingRecords.findIndex((record) => {
      return (
        String(record?.id || "").trim() ===
        normalizedAppointmentId
      );
    });

  if (existingRecordIndex !== -1) {
    const existingRecord =
      waitingRecords[existingRecordIndex];

    const updatedRecord = {
      ...existingRecord,
      id: normalizedAppointmentId,
      start_time: currentTime,
      end_time: "",
    };

    waitingRecords[existingRecordIndex] =
      updatedRecord;

    writeSheet(
      "InWaiting",
      waitingRecords,
    );

    return {
      isUpdated: true,
      record: updatedRecord,
    };
  }

  const newRecord = {
    id: normalizedAppointmentId,
    start_time: currentTime,
    end_time: "",
  };

  waitingRecords.push(newRecord);

  writeSheet(
    "InWaiting",
    waitingRecords,
  );

  return {
    isUpdated: false,
    record: newRecord,
  };
};
/*
|--------------------------------------------------------------------------
| End appointment waiting
|--------------------------------------------------------------------------
*/

export const endAppointmentWaiting = async (appointmentId) => {
  const normalizedAppointmentId = normalizeValue(appointmentId);

  if (!normalizedAppointmentId) {
    throw new Error("Appointment ID is required.");
  }

  const waitingRecords = await readSheet(IN_WAITING_SHEET);

  const recordIndex = waitingRecords.findIndex(
    (record) =>
      normalizeValue(record.id) === normalizedAppointmentId,
  );

  if (recordIndex === -1) {
    throw createServiceError(
      "No waiting record was found for this appointment.",
      "WAITING_NOT_FOUND",
    );
  }

  const waitingRecord = waitingRecords[recordIndex];

  if (normalizeValue(waitingRecord.end_time)) {
    throw createServiceError(
      "This waiting period has already been completed.",
      "WAITING_ALREADY_COMPLETED",
    );
  }

  const updatedRecord = {
    ...waitingRecord,
    end_time: getCurrentDateTime(),
  };

  waitingRecords[recordIndex] = updatedRecord;

  await writeSheet(IN_WAITING_SHEET, waitingRecords);

  return updatedRecord;
};