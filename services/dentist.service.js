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

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */

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

