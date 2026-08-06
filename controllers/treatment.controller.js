import * as treatmentService from "../services/treatment.service.js";
import sendError from "../utils/sendError.js";

/* --------------------------------------------------------
   Create treatment
-------------------------------------------------------- */

async function createTreatment(req, res) {
  try {
    const treatment =
      await treatmentService.createTreatment(req.body);

    return res.status(201).json({
      success: true,
      message: "Treatment recorded successfully",
      data: treatment,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to record treatment",
    );
  }
}

/* --------------------------------------------------------
   Get treatments
-------------------------------------------------------- */

async function getTreatments(req, res) {
  try {
    const treatments =
      await treatmentService.getTreatments(
        req.query.patient_id,
      );

    return res.status(200).json({
      success: true,
      data: treatments,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch treatments",
    );
  }
}

/* --------------------------------------------------------
   Get treatment payment summary
-------------------------------------------------------- */

async function getPaymentsByTreatmentIdController(
  req,
  res,
) {
  try {
    const { treatmentId } = req.params;

    const result =
      await treatmentService.getTreatmentPaymentSummary(
        treatmentId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Treatment payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to retrieve treatment payment history",
    );
  }
}

/* --------------------------------------------------------
   Get follow-up patients
-------------------------------------------------------- */

async function getFollowUpPatients(req, res) {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        message:
          "The date query parameter is required.",
        example:
          "/api/treatments/follow-ups?date=2026-07-25",
      });
    }

    const validDateFormat =
      /^\d{4}-\d{2}-\d{2}$/.test(date);

    if (!validDateFormat) {
      return res.status(400).json({
        success: false,
        message:
          "Date must use YYYY-MM-DD format.",
      });
    }

    const result =
      await treatmentService.getFollowUpPatientsByDate(
        date,
      );

    return res.status(200).json({
      success: true,
      message:
        "Follow-up patients retrieved successfully.",
      data: result,
    });
  } catch (error) {
    console.error(
      "Get follow-up patients error:",
      error,
    );

    return sendError(
      res,
      error,
      "Unable to retrieve follow-up patients",
    );
  }
}

export default {
  createTreatment,
  getTreatments,
  getPaymentsByTreatmentIdController,
  getFollowUpPatients,
};