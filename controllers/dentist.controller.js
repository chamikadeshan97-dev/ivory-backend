import * as dentistService from "../services/dentist.service.js";
import sendError from "../utils/sendError.js";

function createDentist(req, res) {
  try {
    const dentist = dentistService.createDentist(req.body);

    res.status(201).json({
      success: true,
      message: "Dentist added successfully",
      data: dentist,
    });
  } catch (error) {
    sendError(res, error, "Failed to add dentist");
  }
}

function getAllDentists(req, res) {
  try {
    const dentists = dentistService.getAllDentists();

    res.json({
      success: true,
      data: dentists,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch dentists");
  }
}

function searchDentists(req, res) {
  try {
    const dentists = dentistService.searchDentists(req.query.q);

    res.json({
      success: true,
      data: dentists,
    });
  } catch (error) {
    sendError(res, error, "Dentist search failed");
  }
}

function getDentistById(req, res) {
  try {
    const dentist = dentistService.getDentistById(req.params.id);

    res.json({
      success: true,
      data: dentist,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch dentist");
  }
}

function updateDentist(req, res) {
  try {
    const dentist = dentistService.updateDentist(req.params.id, req.body);

    res.json({
      success: true,
      message: "Dentist updated successfully",
      data: dentist,
    });
  } catch (error) {
    sendError(res, error, "Failed to update dentist");
  }
}

function deleteDentist(req, res) {
  try {
    dentistService.deleteDentist(req.params.id);

    res.json({
      success: true,
      message: "Dentist deleted successfully",
    });
  } catch (error) {
    sendError(res, error, "Failed to delete dentist");
  }
}

function getDentistStatistics(req, res) {
  try {
    const statistics = dentistService.getDentistStatistics();

    res.json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch dentist statistics");
  }
}

export default {
  createDentist,
  getAllDentists,
  searchDentists,
  getDentistById,
  updateDentist,
  deleteDentist,
  getDentistStatistics,
};