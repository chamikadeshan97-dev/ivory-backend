import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

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

const normalizeId = (value) => {
  return normalizeValue(value).toLowerCase();
};

const createServiceError = (
  message,
  code,
  statusCode = 500,
) => {
  const error = new Error(message);

  error.code = code;
  error.statusCode = statusCode;

  return error;
};

const ensureArray = (value) => {
  return Array.isArray(value)
    ? value
    : [];
};

const formatWaitingRecord = (record) => {
  return {
    id: normalizeValue(record?.id),
    start_time: normalizeValue(
      record?.start_time,
    ),
    end_time: normalizeValue(
      record?.end_time,
    ),
  };
};

const getCurrentDateTime = () => {
  const now = new Date();

  const formatter =
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Colombo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });

  const parts =
    formatter.formatToParts(now);

  const values = parts.reduce(
    (result, part) => {
      if (part.type !== "literal") {
        result[part.type] =
          part.value;
      }

      return result;
    },
    {},
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
};

const getAppointmentId = (
  appointment,
) => {
  return normalizeValue(
    appointment?.id ??
      appointment?.appointment_id,
  );
};

const findAppointment = async (
  appointmentId,
) => {
  const appointmentRows =
    await readSheet(
      APPOINTMENTS_SHEET,
    );

  const appointments =
    ensureArray(appointmentRows);

  const normalizedAppointmentId =
    normalizeId(appointmentId);

  return (
    appointments.find(
      (appointment) => {
        return (
          normalizeId(
            getAppointmentId(
              appointment,
            ),
          ) ===
          normalizedAppointmentId
        );
      },
    ) || null
  );
};

/*
|--------------------------------------------------------------------------
| Get All Waiting Records
|--------------------------------------------------------------------------
*/

export const getAllInWaitingRecords =
  async () => {
    const waitingRows =
      await readSheet(
        IN_WAITING_SHEET,
      );

    return ensureArray(waitingRows)
      .map(formatWaitingRecord)
      .filter((record) => record.id);
  };

/*
|--------------------------------------------------------------------------
| Get Active Waiting Records
|--------------------------------------------------------------------------
*/

export const getActiveInWaitingRecords =
  async () => {
    const waitingRows =
      await readSheet(
        IN_WAITING_SHEET,
      );

    return ensureArray(waitingRows)
      .map(formatWaitingRecord)
      .filter((record) => {
        const startTime =
          normalizeValue(
            record.start_time,
          );

        const endTime =
          normalizeValue(
            record.end_time,
          );

        return Boolean(startTime) &&
          !endTime;
      });
  };

/*
|--------------------------------------------------------------------------
| Get Waiting Record by Appointment ID
|--------------------------------------------------------------------------
*/

export const getInWaitingByAppointmentId =
  async (appointmentId) => {
    const normalizedAppointmentId =
      normalizeId(appointmentId);

    if (!normalizedAppointmentId) {
      throw createServiceError(
        "Appointment ID is required.",
        "APPOINTMENT_ID_REQUIRED",
        400,
      );
    }

    const waitingRows =
      await readSheet(
        IN_WAITING_SHEET,
      );

    const waitingRecords =
      ensureArray(waitingRows)
        .map(formatWaitingRecord);

    return (
      waitingRecords.find(
        (record) => {
          return (
            normalizeId(record.id) ===
            normalizedAppointmentId
          );
        },
      ) || null
    );
  };

/*
|--------------------------------------------------------------------------
| Start Appointment Waiting
|--------------------------------------------------------------------------
*/

export const startAppointmentWaiting =
  async (appointmentId) => {
    const normalizedAppointmentId =
      normalizeValue(
        appointmentId,
      );

    if (!normalizedAppointmentId) {
      throw createServiceError(
        "Appointment ID is required.",
        "APPOINTMENT_ID_REQUIRED",
        400,
      );
    }

    const appointment =
      await findAppointment(
        normalizedAppointmentId,
      );

    if (!appointment) {
      throw createServiceError(
        "Appointment not found.",
        "APPOINTMENT_NOT_FOUND",
        404,
      );
    }

    const waitingRows =
      await readSheet(
        IN_WAITING_SHEET,
      );

    const waitingRecords =
      ensureArray(waitingRows)
        .map(formatWaitingRecord);

    const normalizedId =
      normalizeId(
        normalizedAppointmentId,
      );

    const existingRecordIndex =
      waitingRecords.findIndex(
        (record) => {
          return (
            normalizeId(record.id) ===
            normalizedId
          );
        },
      );

    const currentTime =
      getCurrentDateTime();

    if (
      existingRecordIndex !== -1
    ) {
      const existingRecord =
        waitingRecords[
          existingRecordIndex
        ];

      if (
        normalizeValue(
          existingRecord.start_time,
        ) &&
        !normalizeValue(
          existingRecord.end_time,
        )
      ) {
        throw createServiceError(
          "This appointment is already waiting.",
          "ALREADY_WAITING",
          409,
        );
      }

      const updatedRecord = {
        id: normalizeValue(
          existingRecord.id,
        ),
        start_time: currentTime,
        end_time: "",
      };

      waitingRecords[
        existingRecordIndex
      ] = updatedRecord;

      await writeSheet(
        IN_WAITING_SHEET,
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

    waitingRecords.push(
      newRecord,
    );

    await writeSheet(
      IN_WAITING_SHEET,
      waitingRecords,
    );

    return {
      isUpdated: false,
      record: newRecord,
    };
  };

/*
|--------------------------------------------------------------------------
| End Appointment Waiting
|--------------------------------------------------------------------------
*/

export const endAppointmentWaiting =
  async (appointmentId) => {
    const normalizedAppointmentId =
      normalizeValue(
        appointmentId,
      );

    if (!normalizedAppointmentId) {
      throw createServiceError(
        "Appointment ID is required.",
        "APPOINTMENT_ID_REQUIRED",
        400,
      );
    }

    const waitingRows =
      await readSheet(
        IN_WAITING_SHEET,
      );

    const waitingRecords =
      ensureArray(waitingRows)
        .map(formatWaitingRecord);

    const normalizedId =
      normalizeId(
        normalizedAppointmentId,
      );

    const recordIndex =
      waitingRecords.findIndex(
        (record) => {
          return (
            normalizeId(record.id) ===
            normalizedId
          );
        },
      );

    if (recordIndex === -1) {
      throw createServiceError(
        "No waiting record was found for this appointment.",
        "WAITING_NOT_FOUND",
        404,
      );
    }

    const waitingRecord =
      waitingRecords[recordIndex];

    if (
      normalizeValue(
        waitingRecord.end_time,
      )
    ) {
      throw createServiceError(
        "This waiting period has already been completed.",
        "WAITING_ALREADY_COMPLETED",
        409,
      );
    }

    if (
      !normalizeValue(
        waitingRecord.start_time,
      )
    ) {
      throw createServiceError(
        "This waiting period has not been started.",
        "WAITING_NOT_STARTED",
        409,
      );
    }

    const updatedRecord = {
      ...waitingRecord,
      end_time:
        getCurrentDateTime(),
    };

    waitingRecords[recordIndex] =
      updatedRecord;

    await writeSheet(
      IN_WAITING_SHEET,
      waitingRecords,
    );

    return updatedRecord;
  };