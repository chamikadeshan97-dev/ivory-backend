import {
  startAppointmentWaiting,
  endAppointmentWaiting,
  getAllInWaitingRecords,
  getActiveInWaitingRecords,
  getInWaitingByAppointmentId,
} from "../services/inWaiting.service.js";

/*
|--------------------------------------------------------------------------
| Get all waiting records
|--------------------------------------------------------------------------
*/

export const getAllWaitingRecords = async (req, res) => {
  try {
    const records = await getAllInWaitingRecords();

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Get all waiting records error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load waiting records.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get currently active waiting records
|--------------------------------------------------------------------------
*/

export const getActiveWaitingRecords = async (req, res) => {
  try {
    const records = await getActiveInWaitingRecords();

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Get active waiting records error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load active waiting records.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get waiting record by appointment ID
|--------------------------------------------------------------------------
*/

export const getWaitingByAppointmentId = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const record = await getInWaitingByAppointmentId(appointmentId);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Waiting record not found for this appointment.",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Get waiting record error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load waiting record.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Start waiting
|--------------------------------------------------------------------------
*/

export const startWaiting = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const record = await startAppointmentWaiting(appointmentId);

    return res.status(201).json({
      success: true,
      message: "Patient moved to waiting.",
      data: record,
    });
  } catch (error) {
    console.error("Start waiting error:", error);

    const statusCode =
      error.code === "APPOINTMENT_NOT_FOUND"
        ? 404
        : error.code === "ALREADY_WAITING"
          ? 409
          : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to start waiting.",
    });
  }
};

/*
|--------------------------------------------------------------------------
| End waiting
|--------------------------------------------------------------------------
*/

export const endWaiting = async (req, res) => {
  try {
    const { appointmentId } = req.params;

    const record = await endAppointmentWaiting(appointmentId);

    return res.status(200).json({
      success: true,
      message: "Patient waiting period completed.",
      data: record,
    });
  } catch (error) {
    console.error("End waiting error:", error);

    const statusCode =
      error.code === "WAITING_NOT_FOUND"
        ? 404
        : error.code === "WAITING_ALREADY_COMPLETED"
          ? 409
          : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to end waiting.",
    });
  }
};
