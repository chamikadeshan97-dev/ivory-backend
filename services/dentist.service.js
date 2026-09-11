import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import {
  createId,
  now,
} from "../utils/helpers.js";

import appError from "../utils/appError.js";

const SHEET_NAME = "Dentists";
const DOCTOR_ARRIVAL_SHEET = "Doctor_Arrival";

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */
const normalizeDate = (value) => {
  if (!value) {
    return "";
  }

  return String(value).trim();
};

const normalizeBoolean = (value) => {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeDentist(dentist) {
  return {
    id: normalizeText(dentist?.id),

    name: normalizeText(
      dentist?.name,
    ),

    phone: normalizeText(
      dentist?.phone,
    ),

    specialization: normalizeText(
      dentist?.specialization,
    ),

    created_at: normalizeText(
      dentist?.created_at,
    ),

    updated_at: normalizeText(
      dentist?.updated_at,
    ),
  };
}

async function getDentistRows() {
  const rows = await readSheet(
    SHEET_NAME,
  );

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row) =>
        row &&
        typeof row === "object",
    )
    .map(normalizeDentist)
    .filter(
      (dentist) =>
        Boolean(dentist.id),
    );
}

function findDentistIndexById(
  dentists,
  id,
) {
  const normalizedDentistId =
    normalizeId(id);

  return dentists.findIndex(
    (dentist) =>
      normalizeId(dentist.id) ===
      normalizedDentistId,
  );
}

/* --------------------------------------------------------
   Create dentist
-------------------------------------------------------- */

export async function createDentist(
  data = {},
) {
  const name = normalizeText(
    data.name,
  );

  const phone = normalizeText(
    data.phone,
  );

  const specialization =
    normalizeText(
      data.specialization,
    );

  if (!name) {
    throw appError(
      "Dentist name is required",
      400,
    );
  }

  const dentists =
    await getDentistRows();

  const duplicateDentist =
    dentists.find((dentist) => {
      return (
        normalizeText(
          dentist.name,
        ).toLowerCase() ===
          name.toLowerCase() &&
        normalizeText(
          dentist.phone,
        ) === phone
      );
    });

  if (duplicateDentist) {
    throw appError(
      "A dentist with this name and phone number already exists",
      409,
    );
  }

  const timestamp = now();

  const newDentist = {
    id: createId("DEN"),

    name,

    phone,

    specialization,

    created_at:
      timestamp,

    updated_at:
      timestamp,
  };

  dentists.push(newDentist);

  await writeSheet(
    SHEET_NAME,
    dentists,
  );

  return newDentist;
}

/* --------------------------------------------------------
   Get all dentists
-------------------------------------------------------- */

export async function getAllDentists() {
  const dentists =
    await getDentistRows();

  return dentists.sort(
    (first, second) =>
      first.name.localeCompare(
        second.name,
        undefined,
        {
          sensitivity: "base",
        },
      ),
  );
}

/* --------------------------------------------------------
   Search dentists
-------------------------------------------------------- */

export async function searchDentists(
  q,
) {
  const dentists =
    await getDentistRows();

  const keyword = normalizeText(
    q,
  ).toLowerCase();

  if (!keyword) {
    return dentists.sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          undefined,
          {
            sensitivity: "base",
          },
        ),
    );
  }

  return dentists
    .filter((dentist) => {
      const dentistId =
        normalizeText(
          dentist.id,
        ).toLowerCase();

      const dentistName =
        normalizeText(
          dentist.name,
        ).toLowerCase();

      const dentistPhone =
        normalizeText(
          dentist.phone,
        ).toLowerCase();

      const specialization =
        normalizeText(
          dentist.specialization,
        ).toLowerCase();

      return (
        dentistId.includes(
          keyword,
        ) ||
        dentistName.includes(
          keyword,
        ) ||
        dentistPhone.includes(
          keyword,
        ) ||
        specialization.includes(
          keyword,
        )
      );
    })
    .sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          undefined,
          {
            sensitivity: "base",
          },
        ),
    );
}

/* --------------------------------------------------------
   Get dentist by ID
-------------------------------------------------------- */

export async function getDentistById(
  id,
) {
  const normalizedDentistId =
    normalizeText(id);

  if (!normalizedDentistId) {
    throw appError(
      "Dentist ID is required",
      400,
    );
  }

  const dentists =
    await getDentistRows();

  const dentist =
    dentists.find(
      (item) =>
        normalizeId(item.id) ===
        normalizeId(
          normalizedDentistId,
        ),
    );

  if (!dentist) {
    throw appError(
      "Dentist not found",
      404,
    );
  }

  return dentist;
}

/* --------------------------------------------------------
   Update dentist
-------------------------------------------------------- */

export async function updateDentist(
  id,
  data = {},
) {
  const normalizedDentistId =
    normalizeText(id);

  if (!normalizedDentistId) {
    throw appError(
      "Dentist ID is required",
      400,
    );
  }

  const dentists =
    await getDentistRows();

  const index =
    findDentistIndexById(
      dentists,
      normalizedDentistId,
    );

  if (index === -1) {
    throw appError(
      "Dentist not found",
      404,
    );
  }

  const existing =
    dentists[index];

  const updatedName =
    Object.prototype.hasOwnProperty.call(
      data,
      "name",
    )
      ? normalizeText(
          data.name,
        )
      : existing.name;

  const updatedPhone =
    Object.prototype.hasOwnProperty.call(
      data,
      "phone",
    )
      ? normalizeText(
          data.phone,
        )
      : existing.phone;

  const updatedSpecialization =
    Object.prototype.hasOwnProperty.call(
      data,
      "specialization",
    )
      ? normalizeText(
          data.specialization,
        )
      : existing.specialization;

  if (!updatedName) {
    throw appError(
      "Dentist name is required",
      400,
    );
  }

  const duplicateDentist =
    dentists.find(
      (dentist) => {
        const isCurrentDentist =
          normalizeId(
            dentist.id,
          ) ===
          normalizeId(
            existing.id,
          );

        const hasSameName =
          normalizeText(
            dentist.name,
          ).toLowerCase() ===
          updatedName.toLowerCase();

        const hasSamePhone =
          normalizeText(
            dentist.phone,
          ) === updatedPhone;

        return (
          !isCurrentDentist &&
          hasSameName &&
          hasSamePhone
        );
      },
    );

  if (duplicateDentist) {
    throw appError(
      "A dentist with this name and phone number already exists",
      409,
    );
  }

  const updatedDentist = {
    ...existing,

    name:
      updatedName,

    phone:
      updatedPhone,

    specialization:
      updatedSpecialization,

    updated_at:
      now(),
  };

  dentists[index] =
    updatedDentist;

  await writeSheet(
    SHEET_NAME,
    dentists,
  );

  return updatedDentist;
}

/* --------------------------------------------------------
   Delete dentist
-------------------------------------------------------- */

export async function deleteDentist(
  id,
) {
  const normalizedDentistId =
    normalizeText(id);

  if (!normalizedDentistId) {
    throw appError(
      "Dentist ID is required",
      400,
    );
  }

  const dentists =
    await getDentistRows();

  const index =
    findDentistIndexById(
      dentists,
      normalizedDentistId,
    );

  if (index === -1) {
    throw appError(
      "Dentist not found",
      404,
    );
  }

  const deletedDentist =
    dentists[index];

  dentists.splice(
    index,
    1,
  );

  await writeSheet(
    SHEET_NAME,
    dentists,
  );

  return deletedDentist;
}

/* --------------------------------------------------------
   Dentist statistics
-------------------------------------------------------- */

export async function getDentistStatistics() {
  const dentists =
    await getDentistRows();

  const specializationCounts = {};

  dentists.forEach((dentist) => {
    const specialization =
      normalizeText(
        dentist.specialization,
      ) || "General";

    specializationCounts[
      specialization
    ] =
      (
        specializationCounts[
          specialization
        ] || 0
      ) + 1;
  });

  return {
    total_dentists:
      dentists.length,

    specialization_breakdown:
      specializationCounts,
  };
}
export async function getDoctorArrivalStatus(date) {

  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    throw new Error("Date is required");
  }

  const records = await readSheet(DOCTOR_ARRIVAL_SHEET);

  const arrivalRecord = records.find(
    (record) => normalizeDate(record.date) === normalizedDate,
  );

  if (!arrivalRecord) {
    return {
      date: normalizedDate,
      arrived: false,
      arrived_at: null,
      sms_sent: false,
      sms_count: 0,
    };
  }

  return {
    id: arrivalRecord.id || "",
    date: arrivalRecord.date || normalizedDate,

    arrived: normalizeBoolean(arrivalRecord.arrived),

    arrived_at:
      arrivalRecord.arrived_at ||
      arrivalRecord.arrival_time ||
      null,

    sms_sent: normalizeBoolean(arrivalRecord.sms_sent),

    sms_count: Number(arrivalRecord.sms_count || 0),
  };
};


export async function markDoctorArrived({
  date,
  sendSms = true,
}) {
  const normalizedDate = normalizeDate(date);

  if (!normalizedDate) {
    throw new Error("Date is required");
  }

  const records = await readSheet(DOCTOR_ARRIVAL_SHEET);

  /*
   * Prevent duplicate doctor-arrival records
   * and especially duplicate SMS sending.
   */
  const existingRecordIndex = records.findIndex(
    (record) => normalizeDate(record.date) === normalizedDate,
  );

  if (existingRecordIndex !== -1) {
    const existingRecord = records[existingRecordIndex];

    if (normalizeBoolean(existingRecord.arrived)) {
      return {
        id: existingRecord.id || "",
        date: existingRecord.date || normalizedDate,
        arrived: true,
        arrived_at:
          existingRecord.arrived_at ||
          existingRecord.arrival_time ||
          null,
        sms_sent: normalizeBoolean(existingRecord.sms_sent),
        sms_count: Number(existingRecord.sms_count || 0),
        already_arrived: true,
      };
    }
  }

  const now = new Date().toISOString();

  const id = `DAR_${normalizedDate.replaceAll("-", "")}`;

  /*
   * ======================================================
   * SMS
   * ======================================================
   *
   * For now smsCount is 0.
   *
   * Plug your SMS sending service into this section.
   */
  let smsCount = 0;
  let smsSent = false;

  if (sendSms) {
    try {
      /*
       * Example:
       *
       * const smsResult = await sendDoctorArrivalSms(normalizedDate);
       *
       * smsCount = smsResult.sentCount;
       * smsSent = smsCount > 0;
       */

      smsCount = 0;
      smsSent = false;
    } catch (error) {
      console.error(
        "Failed to send doctor arrival SMS:",
        error,
      );

      /*
       * I recommend NOT failing doctor arrival just because
       * the SMS provider failed.
       */
      smsCount = 0;
      smsSent = false;
    }
  }

  const newRecord = {
    id,
    date: normalizedDate,
    arrived: true,
    arrived_at: now,
    sms_sent: smsSent,
    sms_count: smsCount,
    created_at: now,
    updated_at: now,
  };

  /*
   * Existing row for this date:
   * update it instead of creating duplicate date rows.
   */
  if (existingRecordIndex !== -1) {
    records[existingRecordIndex] = {
      ...records[existingRecordIndex],
      ...newRecord,

      created_at:
        records[existingRecordIndex].created_at || now,
    };
  } else {
    records.push(newRecord);
  }

  await writeSheet(DOCTOR_ARRIVAL_SHEET, records);

  return {
    ...newRecord,
    already_arrived: false,
  };
};

