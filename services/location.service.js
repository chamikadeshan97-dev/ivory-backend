import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

const SHEET_NAME = "Locations";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

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

const generateLocationId = (
  locations = [],
) => {
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

const formatLocation = (location) => {
  return {
    id: normalizeText(location?.id),
    location: normalizeText(
      location?.location,
    ),
    distance_km:
      Number(location?.distance_km) || 0,
  };
};

/*
|--------------------------------------------------------------------------
| Get All Locations
|--------------------------------------------------------------------------
*/

export const getAllLocationsService =
  async () => {
    const locationRows =
      await readSheet(SHEET_NAME);

    const locations =
      Array.isArray(locationRows)
        ? locationRows
        : [];

    return locations
      .map(formatLocation)
      .filter(
        (location) =>
          location.id &&
          location.location,
      )
      .sort(
        (firstLocation, secondLocation) =>
          firstLocation.distance_km -
            secondLocation.distance_km ||
          firstLocation.location.localeCompare(
            secondLocation.location,
            undefined,
            {
              sensitivity: "base",
            },
          ),
      );
  };

/*
|--------------------------------------------------------------------------
| Get Location by ID
|--------------------------------------------------------------------------
*/

export const getLocationByIdService =
  async (id) => {
    const locationId =
      normalizeText(id).toLowerCase();

    if (!locationId) {
      return null;
    }

    const locationRows =
      await readSheet(SHEET_NAME);

    const locations =
      Array.isArray(locationRows)
        ? locationRows
        : [];

    const location = locations.find(
      (item) => {
        return (
          normalizeText(
            item?.id,
          ).toLowerCase() === locationId
        );
      },
    );

    return location
      ? formatLocation(location)
      : null;
  };

/*
|--------------------------------------------------------------------------
| Create Location
|--------------------------------------------------------------------------
*/

export const createLocationService =
  async (data = {}) => {
    const locationName =
      normalizeText(data.location);

    const distanceKm =
      normalizeDistance(
        data.distance_km,
      );

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

    const locationRows =
      await readSheet(SHEET_NAME);

    const locations =
      Array.isArray(locationRows)
        ? locationRows.map(formatLocation)
        : [];

    const normalizedLocationName =
      locationName.toLowerCase();

    const locationAlreadyExists =
      locations.some((item) => {
        return (
          normalizeText(
            item.location,
          ).toLowerCase() ===
          normalizedLocationName
        );
      });

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

/*
|--------------------------------------------------------------------------
| Update Location
|--------------------------------------------------------------------------
*/

export const updateLocationService =
  async (
    id,
    data = {},
  ) => {
    const locationId =
      normalizeText(id).toLowerCase();

    const locationName =
      normalizeText(data.location);

    const distanceKm =
      normalizeDistance(
        data.distance_km,
      );

    if (!locationId) {
      const error = new Error(
        "Location ID is required.",
      );

      error.statusCode = 400;

      throw error;
    }

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

    const locationRows =
      await readSheet(SHEET_NAME);

    const locations =
      Array.isArray(locationRows)
        ? locationRows.map(formatLocation)
        : [];

    const locationIndex =
      locations.findIndex((item) => {
        return (
          normalizeText(
            item.id,
          ).toLowerCase() === locationId
        );
      });

    if (locationIndex === -1) {
      const error = new Error(
        "Location not found.",
      );

      error.statusCode = 404;

      throw error;
    }

    const normalizedLocationName =
      locationName.toLowerCase();

    const duplicateLocation =
      locations.some(
        (item, index) => {
          if (index === locationIndex) {
            return false;
          }

          return (
            normalizeText(
              item.location,
            ).toLowerCase() ===
            normalizedLocationName
          );
        },
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

/*
|--------------------------------------------------------------------------
| Delete Location
|--------------------------------------------------------------------------
*/

export const deleteLocationService =
  async (id) => {
    const locationId =
      normalizeText(id).toLowerCase();

    if (!locationId) {
      const error = new Error(
        "Location ID is required.",
      );

      error.statusCode = 400;

      throw error;
    }

    const locationRows =
      await readSheet(SHEET_NAME);

    const locations =
      Array.isArray(locationRows)
        ? locationRows.map(formatLocation)
        : [];

    const locationIndex =
      locations.findIndex((item) => {
        return (
          normalizeText(
            item.id,
          ).toLowerCase() === locationId
        );
      });

    if (locationIndex === -1) {
      const error = new Error(
        "Location not found.",
      );

      error.statusCode = 404;

      throw error;
    }

    const [deletedLocation] =
      locations.splice(
        locationIndex,
        1,
      );

    await writeSheet(
      SHEET_NAME,
      locations,
    );

    return formatLocation(
      deletedLocation,
    );
  };