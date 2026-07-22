import * as treatmentService from "../services/treatment.service.js";
import sendError from "../utils/sendError.js";

function createTreatment(req, res) {
  try {
    const treatment = treatmentService.createTreatment(req.body);

    res.status(201).json({
      success: true,
      message: "Treatment recorded successfully",
      data: treatment,
    });
  } catch (error) {
    sendError(res, error, "Failed to record treatment");
  }
}

function getTreatments(req, res) {
  try {
    const treatments = treatmentService.getTreatments(req.query.patient_id);

    res.json({
      success: true,
      data: treatments,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch treatments");
  }
}
function getPaymentsByTreatmentIdController(req, res, next) {
  try {
    const { treatmentId } = req.params;

    const result = treatmentService.getTreatmentPaymentSummary(treatmentId);

    return res.status(200).json({
      success: true,
      message: "Treatment payment history retrieved successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

function getFollowUpPatients  (req, res)  {
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
       treatmentService.getFollowUpPatientsByDate(
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

    return res.status(500).json({
      success: false,
      message:
        "Unable to retrieve follow-up patients.",
      error: error.message,
    });
  }
};

export default {
  createTreatment,getFollowUpPatients,
  getTreatments,getPaymentsByTreatmentIdController
};
