import * as patientService from "../services/patient.service.js";
import sendError from "../utils/sendError.js";

/* ========================================================
   Get patient full details
======================================================== */

export async function getPatientFullDetailsController(
  req,
  res,
  next,
) {
  try {
    const { patientId } = req.params;

    const data =
      await patientService.getPatientFullDetails(
        patientId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Patient full details retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}

/* ========================================================
   Create patient
======================================================== */

async function createPatient(req, res) {
  try {
    const patient =
      await patientService.createPatient(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message:
        "Patient registered successfully",
      data: patient,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to register patient",
    );
  }
}

/* ========================================================
   Get all patients
======================================================== */

async function getAllPatients(req, res) {
  try {
    const patients =
      await patientService.getAllPatients();

    return res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch patients",
    );
  }
}

/* ========================================================
   Search patients
======================================================== */

async function searchPatients(req, res) {
  try {
    const patients =
      await patientService.searchPatients(
        req.query.q,
      );

    return res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Patient search failed",
    );
  }
}

/* ========================================================
   Get patient by ID
======================================================== */

async function getPatientById(req, res) {
  try {
    const patient =
      await patientService.getPatientById(
        req.params.id,
      );

    return res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch patient",
    );
  }
}

/* ========================================================
   Get patient history
======================================================== */

async function getPatientHistory(req, res) {
  try {
    const history =
      await patientService.getPatientHistory(
        req.params.id,
      );

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch patient history",
    );
  }
}

/* ========================================================
   Update patient
======================================================== */

async function updatePatient(req, res) {
  try {
    const patient =
      await patientService.updatePatient(
        req.params.id,
        req.body,
      );

    return res.json({
      success: true,
      message:
        "Patient updated successfully",
      data: patient,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update patient",
    );
  }
}

/* ========================================================
   Delete patient
======================================================== */

async function deletePatient(req, res) {
  try {
    const deletedPatient =
      await patientService.deletePatient(
        req.params.id,
      );

    return res.json({
      success: true,
      message:
        "Patient deleted successfully",
      data: deletedPatient,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to delete patient",
    );
  }
}

/* ========================================================
   Patient statistics
======================================================== */

async function getPatientStatistics(
  req,
  res,
) {
  try {
    const stats =
      await patientService.getPatientStatistics();

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch patient statistics",
    );
  }
}

/* ========================================================
   Recent patients
======================================================== */

async function getRecentPatients(req, res) {
  try {
    const patients =
      await patientService.getRecentPatients();

    return res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch recent patients",
    );
  }
}

/* ========================================================
   Export controller
======================================================== */

export default {
  createPatient,
  getAllPatients,
  searchPatients,
  getPatientById,
  getPatientHistory,
  updatePatient,
  deletePatient,
  getPatientStatistics,
  getRecentPatients,
};