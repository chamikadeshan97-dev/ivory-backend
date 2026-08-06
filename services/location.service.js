import {
  readSheet,
  writeSheet,
} from "../utils/excelDb.js";

const SHEET_NAME = "Locations";

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeDistance = (value) => {
  const distance = Number(value);

  if (
    !Number.isFinite(distance) ||
    distance < 0
  ) {
    return null;
  }

  return distance;
};

const generateLocationId = (locations = []) => {
  const largestNumber = locations.reduce(
    (largest, location) => {
      const match = String(
        location?.id || "",
      ).match(/^LOC_(\d+)$/i);

      if (!match) {
        return largest;
      }

      return Math.max(
        largest,
        Number(match[1]),
      );
    },
    0,
  );

  return `LOC_${String(
    largestNumber + 1,
  ).padStart(4, "0")}`;
};

const formatLocation = (location) => ({
  id: normalizeText(location?.id),
  location: normalizeText(
    location?.location,
  ),
  distance_km:
    Number(location?.distance_km) || 0,
});

/* ========================================================
   Get all locations
======================================================== */

export const getAllLocationsService =
  async () => {
    const locations =
      (await readSheet(SHEET_NAME)) || [];

    return locations
      .map(formatLocation)
      .sort(
        (firstLocation, secondLocation) =>
          firstLocation.distance_km -
            secondLocation.distance_km ||
          firstLocation.location.localeCompare(
            secondLocation.location,
          ),
      );
  };

/* ========================================================
   Get location by ID
======================================================== */

export const getLocationByIdService =
  async (id) => {
    const locationId = normalizeText(id);

    const locations =
      (await readSheet(SHEET_NAME)) || [];

    const location = locations.find(
      (item) =>
        normalizeText(
          item.id,
        ).toLowerCase() ===
        locationId.toLowerCase(),
    );

    return location
      ? formatLocation(location)
      : null;
  };

/* ========================================================
   Create location
======================================================== */

export const createLocationService =
  async ({
    location,
    distance_km,
  }) => {
    const locationName =
      normalizeText(location);

    const distanceKm =
      normalizeDistance(distance_km);

    if (!locationName) {
      const error = new Error(
        "Location name is required.",
      );

      error.statusCode = 400;

      throw error;
    }

    if (distanceKm === null) {
      const error = new Error(
        "Distance must be a valid number greater than or equal to 0.",
      );

      error.statusCode = 400;

      throw error;
    }

    const locations =
      (await readSheet(SHEET_NAME)) || [];

    const locationAlreadyExists =
      locations.some(
        (item) =>
          normalizeText(
            item.location,
          ).toLowerCase() ===
          locationName.toLowerCase(),
      );

    if (locationAlreadyExists) {
      const error = new Error(
        "A location with this name already exists.",
      );

      error.statusCode = 409;

      throw error;
    }

    const newLocation = {
      id: generateLocationId(locations),
      location: locationName,
      distance_km: distanceKm,
    };

    locations.push(newLocation);

    await writeSheet(
      SHEET_NAME,
      locations,
    );

    return newLocation;
  };

/* ========================================================
   Update location
======================================================== */

export const updateLocationService =
  async (
    id,
    {
      location,
      distance_km,
    },
  ) => {
    const locationId = normalizeText(id);

    const locationName =
      normalizeText(location);

    const distanceKm =
      normalizeDistance(distance_km);

    if (!locationName) {
      const error = new Error(
        "Location name is required.",
      );

      error.statusCode = 400;

      throw error;
    }

    if (distanceKm === null) {
      const error = new Error(
        "Distance must be a valid number greater than or equal to 0.",
      );

      error.statusCode = 400;

      throw error;
    }

    const locations =
      (await readSheet(SHEET_NAME)) || [];

    const locationIndex =
      locations.findIndex(
        (item) =>
          normalizeText(
            item.id,
          ).toLowerCase() ===
          locationId.toLowerCase(),
      );

    if (locationIndex === -1) {
      const error = new Error(
        "Location not found.",
      );

      error.statusCode = 404;

      throw error;
    }

    const duplicateLocation =
      locations.some(
        (item, index) =>
          index !== locationIndex &&
          normalizeText(
            item.location,
          ).toLowerCase() ===
            locationName.toLowerCase(),
      );

    if (duplicateLocation) {
      const error = new Error(
        "A location with this name already exists.",
      );

      error.statusCode = 409;

      throw error;
    }

    const updatedLocation = {
      id: normalizeText(
        locations[locationIndex].id,
      ),
      location: locationName,
      distance_km: distanceKm,
    };

    locations[locationIndex] =
      updatedLocation;

    await writeSheet(
      SHEET_NAME,
      locations,
    );

    return updatedLocation;
  };

/* ========================================================
   Delete location
======================================================== */

export const deleteLocationService =
  async (id) => {
    const locationId = normalizeText(id);

    const locations =
      (await readSheet(SHEET_NAME)) || [];

    const locationIndex =
      locations.findIndex(
        (item) =>
          normalizeText(
            item.id,
          ).toLowerCase() ===
          locationId.toLowerCase(),
      );

    if (locationIndex === -1) {
      const error = new Error(
        "Location not found.",
      );

      error.statusCode = 404;

      throw error;
    }

    const [deletedLocation] =
      locations.splice(locationIndex, 1);

    await writeSheet(
      SHEET_NAME,
      locations,
    );

    return formatLocation(
      deletedLocation,
    );
  };