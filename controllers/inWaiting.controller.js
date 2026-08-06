import {
  startAppointmentWaiting,
  endAppointmentWaiting,
  getAllInWaitingRecords,
  getActiveInWaitingRecords,
  getInWaitingByAppointmentId,
} from "../services/inWaiting.service.js";

/*
|--------------------------------------------------------------------------
| Controller Error Handler
|--------------------------------------------------------------------------
*/

const handleControllerError = (
  error,
  res,
  fallbackMessage,
  statusCode = 500,
) => {
  console.error(
    fallbackMessage,
    error,
  );

  return res
    .status(
      error.statusCode ||
        statusCode,
    )
    .json({
      success: false,
      message:
        error.message ||
        fallbackMessage,
    });
};

/*
|--------------------------------------------------------------------------
| Get All Waiting Records
|--------------------------------------------------------------------------
|
| GET /api/in-waiting
|
*/

export const getAllWaitingRecords =
  async (req, res) => {
    try {
      const records =
        await getAllInWaitingRecords();

      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to load waiting records.",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Get Active Waiting Records
|--------------------------------------------------------------------------
|
| GET /api/in-waiting/active
|
*/

export const getActiveWaitingRecords =
  async (req, res) => {
    try {
      const records =
        await getActiveInWaitingRecords();

      return res.status(200).json({
        success: true,
        count: records.length,
        data: records,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to load active waiting records.",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Get Waiting Record by Appointment ID
|--------------------------------------------------------------------------
|
| GET /api/in-waiting/appointment/:appointmentId
|
*/

export const getWaitingByAppointmentId =
  async (req, res) => {
    try {
      const appointmentId =
        String(
          req.params.appointmentId ||
            "",
        ).trim();

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          message:
            "Appointment ID is required.",
        });
      }

      const record =
        await getInWaitingByAppointmentId(
          appointmentId,
        );

      if (!record) {
        return res.status(404).json({
          success: false,
          message:
            "Waiting record not found for this appointment.",
        });
      }

      return res.status(200).json({
        success: true,
        data: record,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to load waiting record.",
      );
    }
  };

/*
|--------------------------------------------------------------------------
| Start Waiting
|--------------------------------------------------------------------------
|
| POST /api/in-waiting/:appointmentId
|
*/

export const startWaiting =
  async (req, res) => {
    try {
      const appointmentId =
        String(
          req.params.appointmentId ||
            "",
        ).trim();

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          message:
            "Appointment ID is required.",
        });
      }

      const record =
        await startAppointmentWaiting(
          appointmentId,
        );

      return res.status(201).json({
        success: true,
        message:
          "Patient moved to waiting.",
        data: record,
      });
    } catch (error) {
      console.error(
        "Start waiting error:",
        error,
      );

      const statusCode =
        error.statusCode ||
        (error.code ===
        "APPOINTMENT_NOT_FOUND"
          ? 404
          : error.code ===
              "ALREADY_WAITING"
            ? 409
            : 500);

      return res
        .status(statusCode)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to start waiting.",
        });
    }
  };

/*
|--------------------------------------------------------------------------
| End Waiting
|--------------------------------------------------------------------------
|
| PATCH /api/in-waiting/:appointmentId/end
|
*/

export const endWaiting =
  async (req, res) => {
    try {
      const appointmentId =
        String(
          req.params.appointmentId ||
            "",
        ).trim();

      if (!appointmentId) {
        return res.status(400).json({
          success: false,
          message:
            "Appointment ID is required.",
        });
      }

      const record =
        await endAppointmentWaiting(
          appointmentId,
        );

      return res.status(200).json({
        success: true,
        message:
          "Patient waiting period completed.",
        data: record,
      });
    } catch (error) {
      console.error(
        "End waiting error:",
        error,
      );

      const statusCode =
        error.statusCode ||
        (error.code ===
        "WAITING_NOT_FOUND"
          ? 404
          : error.code ===
              "WAITING_ALREADY_COMPLETED"
            ? 409
            : 500);

      return res
        .status(statusCode)
        .json({
          success: false,
          message:
            error.message ||
            "Failed to end waiting.",
        });
    }
  };