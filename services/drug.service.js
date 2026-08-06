import {
  readSheet,
  writeSheet,
} from "../utils/excelDb.js";

import appError from "../utils/appError.js";

const DRUGS_SHEET = "Drugs";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeDrugName(value) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeDrug(drug) {
  return {
    id: normalizeText(drug?.id),
    name: normalizeDrugName(drug?.name),
  };
}

function getDrugNumber(id) {
  const match = normalizeText(id).match(
    /^DRG_(\d+)$/i,
  );

  if (!match) {
    return 0;
  }

  return Number(match[1]) || 0;
}

function generateDrugId(drugs) {
  const highestNumber = drugs.reduce(
    (highest, drug) => {
      return Math.max(
        highest,
        getDrugNumber(drug.id),
      );
    },
    0,
  );

  return `DRG_${String(highestNumber + 1).padStart(
    4,
    "0",
  )}`;
}

function findDrugIndexById(drugs, id) {
  const normalizedId = normalizeText(id).toLowerCase();

  return drugs.findIndex(
    (drug) =>
      normalizeText(drug.id).toLowerCase() ===
      normalizedId,
  );
}

function checkDrugNameExists(
  drugs,
  name,
  excludedId = null,
) {
  const normalizedName =
    normalizeDrugName(name).toLowerCase();

  return drugs.some((drug) => {
    const currentDrugId =
      normalizeText(drug.id).toLowerCase();

    const excludedDrugId =
      normalizeText(excludedId).toLowerCase();

    if (
      excludedId &&
      currentDrugId === excludedDrugId
    ) {
      return false;
    }

    return (
      normalizeDrugName(drug.name).toLowerCase() ===
      normalizedName
    );
  });
}

/*
|--------------------------------------------------------------------------
| Create Drug
|--------------------------------------------------------------------------
*/

export function createDrug(data) {
  const drugs = readSheet(DRUGS_SHEET).map(
    normalizeDrug,
  );

  const name = normalizeDrugName(data?.name);

  if (!name) {
    throw appError("Drug name is required", 400);
  }

  if (checkDrugNameExists(drugs, name)) {
    throw appError(
      "A drug with this name already exists",
      409,
    );
  }

  const drug = {
    id: generateDrugId(drugs),
    name,
  };

  drugs.push(drug);

  writeSheet(DRUGS_SHEET, drugs);

  return drug;
}

/*
|--------------------------------------------------------------------------
| Create Multiple Drugs
|--------------------------------------------------------------------------
*/

export function createDrugsBulk(data) {
  const drugs = readSheet(DRUGS_SHEET).map(
    normalizeDrug,
  );

  const drugItems = data?.drugs;

  if (
    !Array.isArray(drugItems) ||
    drugItems.length === 0
  ) {
    throw appError(
      "A non-empty drugs array is required",
      400,
    );
  }

  const created = [];
  const skipped = [];

  let highestNumber = drugs.reduce(
    (highest, drug) => {
      return Math.max(
        highest,
        getDrugNumber(drug.id),
      );
    },
    0,
  );

  drugItems.forEach((drugItem) => {
    const name = normalizeDrugName(
      drugItem?.name,
    );

    if (!name) {
      skipped.push({
        name: "",
        reason: "Drug name is required",
      });

      return;
    }

    const allDrugs = [
      ...drugs,
      ...created,
    ];

    if (checkDrugNameExists(allDrugs, name)) {
      skipped.push({
        name,
        reason: "Drug already exists",
      });

      return;
    }

    highestNumber += 1;

    const drug = {
      id: `DRG_${String(highestNumber).padStart(
        4,
        "0",
      )}`,
      name,
    };

    created.push(drug);
  });

  if (created.length > 0) {
    writeSheet(DRUGS_SHEET, [
      ...drugs,
      ...created,
    ]);
  }

  return {
    created,
    skipped,
    created_count: created.length,
    skipped_count: skipped.length,
  };
}

/*
|--------------------------------------------------------------------------
| Get All Drugs
|--------------------------------------------------------------------------
*/

export function getDrugs(query = {}) {
  let drugs = readSheet(DRUGS_SHEET)
    .map(normalizeDrug)
    .filter((drug) => drug.id && drug.name);

  const search = normalizeText(
    query.search,
  ).toLowerCase();

  const sort = normalizeText(
    query.sort,
  ).toLowerCase();

  if (search) {
    drugs = drugs.filter((drug) => {
      return (
        drug.id.toLowerCase().includes(search) ||
        drug.name.toLowerCase().includes(search)
      );
    });
  }

  drugs.sort((firstDrug, secondDrug) => {
    const comparison =
      firstDrug.name.localeCompare(
        secondDrug.name,
        undefined,
        {
          sensitivity: "base",
        },
      );

    return sort === "desc"
      ? -comparison
      : comparison;
  });

  return drugs;
}

/*
|--------------------------------------------------------------------------
| Search Drugs
|--------------------------------------------------------------------------
*/

export function searchDrugs(searchQuery) {
  const query = normalizeText(
    searchQuery,
  ).toLowerCase();

  if (!query) {
    throw appError(
      "Search query is required",
      400,
    );
  }

  const drugs = readSheet(DRUGS_SHEET)
    .map(normalizeDrug)
    .filter((drug) => {
      return (
        drug.id.toLowerCase().includes(query) ||
        drug.name.toLowerCase().includes(query)
      );
    });

  drugs.sort((firstDrug, secondDrug) =>
    firstDrug.name.localeCompare(
      secondDrug.name,
      undefined,
      {
        sensitivity: "base",
      },
    ),
  );

  return drugs;
}

/*
|--------------------------------------------------------------------------
| Get Drug by ID
|--------------------------------------------------------------------------
*/

export function getDrugById(id) {
  const drugs = readSheet(DRUGS_SHEET).map(
    normalizeDrug,
  );

  const drugIndex = findDrugIndexById(
    drugs,
    id,
  );

  if (drugIndex === -1) {
    throw appError("Drug not found", 404);
  }

  return drugs[drugIndex];
}

/*
|--------------------------------------------------------------------------
| Update Drug
|--------------------------------------------------------------------------
*/

export function updateDrug(id, data) {
  const drugs = readSheet(DRUGS_SHEET).map(
    normalizeDrug,
  );

  const drugIndex = findDrugIndexById(
    drugs,
    id,
  );

  if (drugIndex === -1) {
    throw appError("Drug not found", 404);
  }

  const name = normalizeDrugName(data?.name);

  if (!name) {
    throw appError("Drug name is required", 400);
  }

  if (
    checkDrugNameExists(
      drugs,
      name,
      drugs[drugIndex].id,
    )
  ) {
    throw appError(
      "Another drug with this name already exists",
      409,
    );
  }

  const updatedDrug = {
    ...drugs[drugIndex],
    name,
  };

  drugs[drugIndex] = updatedDrug;

  writeSheet(DRUGS_SHEET, drugs);

  return updatedDrug;
}

/*
|--------------------------------------------------------------------------
| Delete Drug
|--------------------------------------------------------------------------
*/

export function deleteDrug(id) {
  const drugs = readSheet(DRUGS_SHEET).map(
    normalizeDrug,
  );

  const drugIndex = findDrugIndexById(
    drugs,
    id,
  );

  if (drugIndex === -1) {
    throw appError("Drug not found", 404);
  }

  const [deletedDrug] = drugs.splice(
    drugIndex,
    1,
  );

  writeSheet(DRUGS_SHEET, drugs);

  return deletedDrug;
}