import {
  createLocationService,
  deleteLocationService,
  getAllLocationsService,
  getLocationByIdService,
  updateLocationService,
} from "../services/location.service.js";

/*
|--------------------------------------------------------------------------
| Controller Error Handler
|--------------------------------------------------------------------------
*/

const handleControllerError = (
  error,
  res,
  fallbackMessage,
) => {
  console.error(
    fallbackMessage,
    error,
  );

  return res
    .status(error.statusCode || 500)
    .json({
      success: false,
      message:
        error.message || fallbackMessage,
    });
};

/*
|--------------------------------------------------------------------------
| Get All Locations
|--------------------------------------------------------------------------
|
| GET /api/locations
|
*/

export const getAllLocations = async (
  req,
  res,
) => {
  try {
    const locations =
      await getAllLocationsService();

    return res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to get locations.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Get Location by ID
|--------------------------------------------------------------------------
|
| GET /api/locations/:id
|
*/

export const getLocationById = async (
  req,
  res,
) => {
  try {
    const location =
      await getLocationByIdService(
        req.params.id,
      );

    if (!location) {
      return res.status(404).json({
        success: false,
        message: "Location not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to get location.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Create Location
|--------------------------------------------------------------------------
|
| POST /api/locations
|
| Body:
| {
|   "location": "Palatuwa",
|   "distance_km": 5
| }
|
*/

export const createLocation = async (
  req,
  res,
) => {
  try {
    const newLocation =
      await createLocationService(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message:
        "Location created successfully.",
      data: newLocation,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to create location.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Update Location
|--------------------------------------------------------------------------
|
| PUT /api/locations/:id
| PATCH /api/locations/:id
|
| Body:
| {
|   "location": "Palatuwa",
|   "distance_km": 5.5
| }
|
*/

export const updateLocation = async (
  req,
  res,
) => {
  try {
    const updatedLocation =
      await updateLocationService(
        req.params.id,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message:
        "Location updated successfully.",
      data: updatedLocation,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to update location.",
    );
  }
};

/*
|--------------------------------------------------------------------------
| Delete Location
|--------------------------------------------------------------------------
|
| DELETE /api/locations/:id
|
*/

export const deleteLocation = async (
  req,
  res,
) => {
  try {
    const deletedLocation =
      await deleteLocationService(
        req.params.id,
      );

    return res.status(200).json({
      success: true,
      message:
        "Location deleted successfully.",
      data: deletedLocation,
    });
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to delete location.",
    );
  }
};