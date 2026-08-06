import * as commonTreatmentService from "../services/commonTreatment.service.js";

import sendError from "../utils/sendError.js";

/* --------------------------------------------------------
   Create
-------------------------------------------------------- */

async function createCommonTreatment(req, res) {
  try {
    const treatment = await commonTreatmentService.createCommonTreatment(
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Common treatment created successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create common treatment");
  }
}

/* --------------------------------------------------------
   Read all
-------------------------------------------------------- */

async function getAllCommonTreatments(req, res) {
  try {
    const treatments = await commonTreatmentService.getAllCommonTreatments();

    return res.status(200).json({
      success: true,
      message: "Common treatments retrieved successfully",
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve common treatments");
  }
}

/* --------------------------------------------------------
   Search
-------------------------------------------------------- */

async function searchCommonTreatments(req, res) {
  try {
    const { q = "" } = req.query;

    const treatments = await commonTreatmentService.searchCommonTreatments(q);

    return res.status(200).json({
      success: true,
      message: "Common treatments searched successfully",
      search_query: String(q).trim(),
      count: treatments.length,
      data: treatments,
    });
  } catch (error) {
    return sendError(res, error, "Failed to search common treatments");
  }
}

/* --------------------------------------------------------
   Read by ID
-------------------------------------------------------- */

async function getCommonTreatmentById(req, res) {
  try {
    const { id } = req.params;

    const treatment = await commonTreatmentService.getCommonTreatmentById(id);

    return res.status(200).json({
      success: true,
      message: "Common treatment retrieved successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error, "Failed to retrieve common treatment");
  }
}

/* --------------------------------------------------------
   Update
-------------------------------------------------------- */

async function updateCommonTreatment(req, res) {
  try {
    const { id } = req.params;

    const treatment = await commonTreatmentService.updateCommonTreatment(
      id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Common treatment updated successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(res, error, "Failed to update common treatment");
  }
}

/* --------------------------------------------------------
   Delete
-------------------------------------------------------- */

async function deleteCommonTreatment(req, res) {
  try {
    const { id } = req.params;

    const deletedTreatment =
      await commonTreatmentService.deleteCommonTreatment(id);

    return res.status(200).json({
      success: true,
      message: "Common treatment deleted successfully",
      data: deletedTreatment,
    });
  } catch (error) {
    return sendError(res, error, "Failed to delete common treatment");
  }
}

/* --------------------------------------------------------
   Statistics
-------------------------------------------------------- */

async function getCommonTreatmentStatistics(req, res) {
  try {
    const statistics =
      await commonTreatmentService.getCommonTreatmentStatistics();

    return res.status(200).json({
      success: true,
      message: "Common treatment statistics retrieved successfully",
      data: statistics,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to retrieve common treatment statistics",
    );
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
