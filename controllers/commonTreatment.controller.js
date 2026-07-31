import * as commonTreatmentService from "../services/commonTreatment.service.js";

import sendError from "../utils/sendError.js";

/* --------------------------------------------------------
   Create
-------------------------------------------------------- */

function createCommonTreatment(req, res) {
  try {
    const treatment =
      commonTreatmentService.createCommonTreatment(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message: "Common treatment created successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Read all
-------------------------------------------------------- */

function getAllCommonTreatments(req, res) {
  try {
    const treatments =
      commonTreatmentService.getAllCommonTreatments();

    return res.status(200).json({
      success: true,
      message:
        "Common treatments retrieved successfully",
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Search
-------------------------------------------------------- */

function searchCommonTreatments(req, res) {
  try {
    const { q = "" } = req.query;

    const treatments =
      commonTreatmentService.searchCommonTreatments(q);

    return res.status(200).json({
      success: true,
      message:
        "Common treatments searched successfully",
      search_query: String(q).trim(),
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Read by ID
-------------------------------------------------------- */

function getCommonTreatmentById(req, res) {
  try {
    const { id } = req.params;

    const treatment =
      commonTreatmentService.getCommonTreatmentById(id);

    return res.status(200).json({
      success: true,
      message:
        "Common treatment retrieved successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Update
-------------------------------------------------------- */

function updateCommonTreatment(req, res) {
  try {
    const { id } = req.params;

    const treatment =
      commonTreatmentService.updateCommonTreatment(
        id,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message: "Common treatment updated successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Delete
-------------------------------------------------------- */

function deleteCommonTreatment(req, res) {
  try {
    const { id } = req.params;

    const deletedTreatment =
      commonTreatmentService.deleteCommonTreatment(id);

    return res.status(200).json({
      success: true,
      message: "Common treatment deleted successfully",
      data: deletedTreatment,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Statistics
-------------------------------------------------------- */

function getCommonTreatmentStatistics(req, res) {
  try {
    const statistics =
      commonTreatmentService.getCommonTreatmentStatistics();

    return res.status(200).json({
      success: true,
      message:
        "Common treatment statistics retrieved successfully",
      data: statistics,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/* --------------------------------------------------------
   Default export
-------------------------------------------------------- */

export default {
  createCommonTreatment,
  getAllCommonTreatments,
  searchCommonTreatments,
  getCommonTreatmentById,
  updateCommonTreatment,
  deleteCommonTreatment,
  getCommonTreatmentStatistics,
};