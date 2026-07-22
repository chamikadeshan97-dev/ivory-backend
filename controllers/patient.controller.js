import * as patientService from "../services/patient.service.js";
import sendError from "../utils/sendError.js";

export function getPatientFullDetailsController(req, res, next) {
  try {
    const { patientId } = req.params;

    const data = patientService.getPatientFullDetails(patientId);

    return res.status(200).json({
      success: true,
      message: "Patient full details retrieved successfully",
      data,
    });
  } catch (error) {
    next(error);
  }
}
function createPatient(req, res) {
  try {
    const patient = patientService.createPatient(req.body);

    res.status(201).json({
      success: true,
      message: "Patient registered successfully",
      data: patient,
    });
  } catch (error) {
    sendError(res, error, "Failed to register patient");
  }
}

function getAllPatients(req, res) {
  try {
    const patients = patientService.getAllPatients();

    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch patients");
  }
}

function searchPatients(req, res) {
  try {
    const patients = patientService.searchPatients(req.query.q);

    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    sendError(res, error, "Patient search failed");
  }
}

function getPatientById(req, res) {
  try {
    const patient = patientService.getPatientById(req.params.id);

    res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch patient");
  }
}

function getPatientHistory(req, res) {
  try {
    const history = patientService.getPatientHistory(req.params.id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch patient history");
  }
}

function updatePatient(req, res) {
  try {
    const patient = patientService.updatePatient(req.params.id, req.body);

    res.json({
      success: true,
      message: "Patient updated successfully",
      data: patient,
    });
  } catch (error) {
    sendError(res, error, "Failed to update patient");
  }
}

function deletePatient(req, res) {
  try {
    patientService.deletePatient(req.params.id);

    res.json({
      success: true,
      message: "Patient deleted successfully",
    });
  } catch (error) {
    sendError(res, error, "Failed to delete patient");
  }
}

function getPatientStatistics(req, res) {
  try {
    const stats = patientService.getPatientStatistics();

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch patient statistics");
  }
}

function getRecentPatients(req, res) {
  try {
    const patients = patientService.getRecentPatients();

    res.json({
      success: true,
      data: patients,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch recent patients");
  }
}

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
