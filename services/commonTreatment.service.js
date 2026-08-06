import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import {
  createId,
  now,
} from "../utils/helpers.js";

import appError from "../utils/appError.js";

const SHEET_NAME = "Common_Treatments";

/* --------------------------------------------------------
   Helpers
-------------------------------------------------------- */

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeTreatmentName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeTreatmentNameForComparison(value) {
  return normalizeTreatmentName(value).toLowerCase();
}

function validateTreatmentName(value) {
  const treatmentName =
    normalizeTreatmentName(value);

  if (!treatmentName) {
    throw appError(
      "Treatment name is required",
      400,
    );
  }

  if (treatmentName.length > 150) {
    throw appError(
      "Treatment name cannot exceed 150 characters",
      400,
    );
  }

  return treatmentName;
}

function validateFee(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    throw appError(
      "Treatment fee is required",
      400,
    );
  }

  const fee = Number(value);

  if (!Number.isFinite(fee)) {
    throw appError(
      "Treatment fee must be a valid number",
      400,
    );
  }

  if (fee < 0) {
    throw appError(
      "Treatment fee cannot be less than zero",
      400,
    );
  }

  return Number(fee.toFixed(2));
}

function normalizeTreatment(record) {
  return {
    id: normalizeText(record?.id),

    treatment_name:
      normalizeTreatmentName(
        record?.treatment_name,
      ),

    fee: Number(record?.fee || 0),

    created_at:
      normalizeText(record?.created_at),

    updated_at:
      normalizeText(record?.updated_at),
  };
}

function sortTreatmentsByName(treatments) {
  return [...treatments].sort(
    (first, second) =>
      first.treatment_name.localeCompare(
        second.treatment_name,
        undefined,
        {
          sensitivity: "base",
        },
      ),
  );
}

/*
 * Google Sheets operations are asynchronous,
 * so this helper must also be asynchronous.
 */
async function getAllTreatmentRows() {
  const rows = await readSheet(SHEET_NAME);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .filter(
      (row) =>
        row &&
        typeof row === "object",
    )
    .map(normalizeTreatment)
    .filter(
      (treatment) =>
        Boolean(treatment.id),
    );
}

function findTreatmentIndexById(
  treatments,
  id,
) {
  const normalizedId =
    normalizeText(id).toLowerCase();

  return treatments.findIndex(
    (treatment) =>
      normalizeText(
        treatment.id,
      ).toLowerCase() === normalizedId,
  );
}

function findDuplicateTreatment(
  treatments,
  treatmentName,
  ignoredId = null,
) {
  const normalizedName =
    normalizeTreatmentNameForComparison(
      treatmentName,
    );

  const normalizedIgnoredId =
    ignoredId
      ? normalizeText(
          ignoredId,
        ).toLowerCase()
      : null;

  return treatments.find(
    (treatment) => {
      const hasSameName =
        normalizeTreatmentNameForComparison(
          treatment.treatment_name,
        ) === normalizedName;

      const isIgnoredTreatment =
        normalizedIgnoredId &&
        normalizeText(
          treatment.id,
        ).toLowerCase() ===
          normalizedIgnoredId;

      return (
        hasSameName &&
        !isIgnoredTreatment
      );
    },
  );
}

/* --------------------------------------------------------
   Create
-------------------------------------------------------- */

export async function createCommonTreatment(
  data,
) {
  const treatments =
    await getAllTreatmentRows();

  const treatmentName =
    validateTreatmentName(
      data?.treatment_name,
    );

  const fee =
    validateFee(data?.fee);

  const duplicateTreatment =
    findDuplicateTreatment(
      treatments,
      treatmentName,
    );

  if (duplicateTreatment) {
    throw appError(
      "A common treatment with this name already exists",
      409,
    );
  }

  const timestamp = now();

  const newTreatment = {
    id: createId("CT"),

    treatment_name:
      treatmentName,

    fee,

    created_at:
      timestamp,

    updated_at:
      timestamp,
  };

  treatments.push(newTreatment);

  await writeSheet(
    SHEET_NAME,
    treatments,
  );

  return newTreatment;
}

/* --------------------------------------------------------
   Read all
-------------------------------------------------------- */

export async function getAllCommonTreatments() {
  const treatments =
    await getAllTreatmentRows();

  return sortTreatmentsByName(
    treatments,
  );
}

/* --------------------------------------------------------
   Search
-------------------------------------------------------- */

export async function searchCommonTreatments(
  q,
) {
  const treatments =
    await getAllTreatmentRows();

  const searchValue =
    normalizeText(q).toLowerCase();

  if (!searchValue) {
    return sortTreatmentsByName(
      treatments,
    );
  }

  const filteredTreatments =
    treatments.filter(
      (treatment) => {
        const treatmentId =
          normalizeText(
            treatment.id,
          ).toLowerCase();

        const treatmentName =
          normalizeText(
            treatment.treatment_name,
          ).toLowerCase();

        const treatmentFee =
          String(
            treatment.fee,
          ).toLowerCase();

        return (
          treatmentId.includes(
            searchValue,
          ) ||
          treatmentName.includes(
            searchValue,
          ) ||
          treatmentFee.includes(
            searchValue,
          )
        );
      },
    );

  return sortTreatmentsByName(
    filteredTreatments,
  );
}

/* --------------------------------------------------------
   Read by ID
-------------------------------------------------------- */

export async function getCommonTreatmentById(
  id,
) {
  const normalizedId =
    normalizeText(id);

  if (!normalizedId) {
    throw appError(
      "Common treatment ID is required",
      400,
    );
  }

  const treatments =
    await getAllTreatmentRows();

  const treatment =
    treatments.find(
      (item) =>
        normalizeText(
          item.id,
        ).toLowerCase() ===
        normalizedId.toLowerCase(),
    );

  if (!treatment) {
    throw appError(
      "Common treatment not found",
      404,
    );
  }

  return treatment;
}

/* --------------------------------------------------------
   Update
-------------------------------------------------------- */

export async function updateCommonTreatment(
  id,
  data,
) {
  const normalizedId =
    normalizeText(id);

  if (!normalizedId) {
    throw appError(
      "Common treatment ID is required",
      400,
    );
  }

  const treatments =
    await getAllTreatmentRows();

  const treatmentIndex =
    findTreatmentIndexById(
      treatments,
      normalizedId,
    );

  if (treatmentIndex === -1) {
    throw appError(
      "Common treatment not found",
      404,
    );
  }

  const existingTreatment =
    treatments[treatmentIndex];

  let treatmentName =
    existingTreatment.treatment_name;

  let fee =
    existingTreatment.fee;

  if (
    Object.prototype.hasOwnProperty.call(
      data || {},
      "treatment_name",
    )
  ) {
    treatmentName =
      validateTreatmentName(
        data.treatment_name,
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      data || {},
      "fee",
    )
  ) {
    fee =
      validateFee(data.fee);
  }

  const duplicateTreatment =
    findDuplicateTreatment(
      treatments,
      treatmentName,
      existingTreatment.id,
    );

  if (duplicateTreatment) {
    throw appError(
      "A common treatment with this name already exists",
      409,
    );
  }

  const updatedTreatment = {
    ...existingTreatment,

    treatment_name:
      treatmentName,

    fee,

    updated_at:
      now(),
  };

  treatments[treatmentIndex] =
    updatedTreatment;

  await writeSheet(
    SHEET_NAME,
    treatments,
  );

  return updatedTreatment;
}

/* --------------------------------------------------------
   Delete
-------------------------------------------------------- */

export async function deleteCommonTreatment(
  id,
) {
  const normalizedId =
    normalizeText(id);

  if (!normalizedId) {
    throw appError(
      "Common treatment ID is required",
      400,
    );
  }

  const treatments =
    await getAllTreatmentRows();

  const treatmentIndex =
    findTreatmentIndexById(
      treatments,
      normalizedId,
    );

  if (treatmentIndex === -1) {
    throw appError(
      "Common treatment not found",
      404,
    );
  }

  const deletedTreatment =
    treatments[treatmentIndex];

  treatments.splice(
    treatmentIndex,
    1,
  );

  await writeSheet(
    SHEET_NAME,
    treatments,
  );

  return deletedTreatment;
}

/* --------------------------------------------------------
   Statistics
-------------------------------------------------------- */

export async function getCommonTreatmentStatistics() {
  const treatments =
    await getAllTreatmentRows();

  const fees = treatments
    .map(
      (treatment) =>
        Number(treatment.fee),
    )
    .filter(
      (fee) =>
        Number.isFinite(fee),
    );

  const totalFeeValue =
    fees.reduce(
      (total, fee) =>
        total + fee,
      0,
    );

  const averageFee =
    fees.length > 0
      ? totalFeeValue / fees.length
      : 0;

  const lowestFee =
    fees.length > 0
      ? Math.min(...fees)
      : 0;

  const highestFee =
    fees.length > 0
      ? Math.max(...fees)
      : 0;

  const lowestFeeTreatment =
    treatments.length > 0
      ? treatments.reduce(
          (
            lowest,
            treatment,
          ) => {
            if (
              Number(
                treatment.fee,
              ) <
              Number(
                lowest.fee,
              )
            ) {
              return treatment;
            }

            return lowest;
          },
        )
      : null;

  const highestFeeTreatment =
    treatments.length > 0
      ? treatments.reduce(
          (
            highest,
            treatment,
          ) => {
            if (
              Number(
                treatment.fee,
              ) >
              Number(
                highest.fee,
              )
            ) {
              return treatment;
            }

            return highest;
          },
        )
      : null;

  return {
    total_treatments:
      treatments.length,

    total_fee_value:
      Number(
        totalFeeValue.toFixed(2),
      ),

    average_fee:
      Number(
        averageFee.toFixed(2),
      ),

    lowest_fee:
      Number(
        lowestFee.toFixed(2),
      ),

    highest_fee:
      Number(
        highestFee.toFixed(2),
      ),

    lowest_fee_treatment:
      lowestFeeTreatment,

    highest_fee_treatment:
      highestFeeTreatment,
  };
}