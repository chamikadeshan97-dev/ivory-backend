import {
  createOrthoCaseService,
  getAllOrthoCasesService,
  getOrthoCaseByIdService,
  getOrthoCasesByPatientService,
  updateOrthoCaseService,
  updateOrthoCaseStatusService,
} from "../services/orthoCase.service.js";

import {
  createOrthoVisitService,
  getOrthoVisitsByCaseService,
  getOrthoVisitByIdService,
  updateOrthoVisitService,
  deleteOrthoVisitService,
} from "../services/orthoVisit.service.js";

import {
  createOrthoPaymentService,
  getOrthoPaymentsByCaseService,
  getOrthoPaymentByIdService,
  updateOrthoPaymentService,
  deleteOrthoPaymentService,
} from "../services/orthoPayment.service.js";

import {
  createOrthoMediaService,
  getOrthoMediaByCaseService,
  getOrthoMediaByIdService,
  deleteOrthoMediaService,
  permanentlyDeleteOrthoMediaService,
  getOrthoMediaFileStream,
} from "../services/orthoMedia.service.js";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) => String(value ?? "").trim();

const sendServerError = (res, error, defaultMessage) => {
  console.error(defaultMessage, error);

  return res.status(500).json({
    success: false,

    message: error?.message || defaultMessage,
  });
};

/* ========================================================
   ORTHO CASES
======================================================== */

export const createOrthoCase = async (req, res) => {
  try {
    const {
      patient_id,
      dentist_id,
      start_date,
      treatment_type,
      treatment_area,
      diagnosis,
      estimated_duration,
      total_treatment_fee,
      payment_plan,
      monthly_payment,
      next_visit_date,
      notes,
    } = req.body;

    if (!normalize(patient_id)) {
      return res.status(400).json({
        success: false,
        message: "patient_id is required",
      });
    }

    const data = await createOrthoCaseService({
      patient_id,
      dentist_id,
      start_date,
      treatment_type,
      treatment_area,
      diagnosis,
      estimated_duration,
      total_treatment_fee,
      payment_plan,
      monthly_payment,
      next_visit_date,
      notes,
    });

    return res.status(201).json({
      success: true,

      message: "Ortho case created successfully",

      data,
    });
  } catch (error) {
    if (error.message === "This patient already has an active Ortho case") {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    return sendServerError(res, error, "Failed to create Ortho case");
  }
};

/* --------------------------------------------------------
   GET ALL CASES
-------------------------------------------------------- */

export const getAllOrthoCases = async (req, res) => {
  try {
    const data = await getAllOrthoCasesService({
      status: req.query.status,

      dentist_id: req.query.dentist_id,

      search: req.query.search,
    });

    return res.json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho cases");
  }
};

/* --------------------------------------------------------
   GET CASE BY ID
-------------------------------------------------------- */

export const getOrthoCaseById = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await getOrthoCaseByIdService(caseId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ortho case not found",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho case");
  }
};

/* --------------------------------------------------------
   GET CASES BY PATIENT
-------------------------------------------------------- */

export const getOrthoCasesByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const data = await getOrthoCasesByPatientService(patientId);

    return res.json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load patient Ortho cases");
  }
};

/* --------------------------------------------------------
   UPDATE CASE
-------------------------------------------------------- */

export const updateOrthoCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await updateOrthoCaseService(caseId, req.body);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ortho case not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho case updated successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update Ortho case");
  }
};

/* --------------------------------------------------------
   UPDATE STATUS
-------------------------------------------------------- */

export const updateOrthoCaseStatus = async (req, res) => {
  try {
    const { caseId } = req.params;

    const { status } = req.body;

    if (!normalize(status)) {
      return res.status(400).json({
        success: false,

        message: "status is required",
      });
    }

    const data = await updateOrthoCaseStatusService(caseId, status);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho case not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho case status updated successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update Ortho case status");
  }
};

/* ========================================================
   VISITS
======================================================== */

export const createOrthoVisit = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await createOrthoVisitService(caseId, req.body);

    return res.status(201).json({
      success: true,

      message: "Ortho visit created successfully",

      data,
    });
  } catch (error) {
    if (error.message === "Ortho case not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    return sendServerError(res, error, "Failed to create Ortho visit");
  }
};

export const getOrthoVisitsByCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await getOrthoVisitsByCaseService(caseId);

    return res.json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho visits");
  }
};

export const getOrthoVisitById = async (req, res) => {
  try {
    const { visitId } = req.params;

    const data = await getOrthoVisitByIdService(visitId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ortho visit not found",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho visit");
  }
};

export const updateOrthoVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const data = await updateOrthoVisitService(visitId, req.body);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ortho visit not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho visit updated successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update Ortho visit");
  }
};

export const deleteOrthoVisit = async (req, res) => {
  try {
    const { visitId } = req.params;

    const data = await deleteOrthoVisitService(visitId);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Ortho visit not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho visit deleted successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete Ortho visit");
  }
};

/* ========================================================
   PAYMENTS
======================================================== */

export const createOrthoPayment = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await createOrthoPaymentService(caseId, req.body);

    return res.status(201).json({
      success: true,

      message: "Ortho payment recorded successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to record Ortho payment");
  }
};

export const getOrthoPaymentsByCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const result = await getOrthoPaymentsByCaseService(caseId);

    return res.json({
      success: true,

      count: result.payments.length,

      total_paid: result.totalPaid,

      data: result.payments,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho payments");
  }
};

export const getOrthoPaymentById = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const data = await getOrthoPaymentByIdService(paymentId);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho payment not found",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho payment");
  }
};

export const updateOrthoPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const data = await updateOrthoPaymentService(paymentId, req.body);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho payment not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho payment updated successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to update Ortho payment");
  }
};

export const deleteOrthoPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    const data = await deleteOrthoPaymentService(paymentId);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho payment not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho payment deleted successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to delete Ortho payment");
  }
};

/* ========================================================
   MEDIA
======================================================== */

export const uploadOrthoMedia = async (req, res) => {
  try {
    const { caseId } = req.params;

    /* ----------------------------------------------------
       DEBUG
    ---------------------------------------------------- */

    console.log("ORTHO UPLOAD BODY:", req.body);

    console.log(
      "ORTHO UPLOAD FILES:",
      req.files?.map((file) => ({
        fieldname: file.fieldname,

        originalname: file.originalname,

        mimetype: file.mimetype,

        size: file.size,

        hasBuffer: Buffer.isBuffer(file.buffer),

        bufferLength: file.buffer?.length,
      })),
    );

    /* ----------------------------------------------------
       VALIDATE FILES
    ---------------------------------------------------- */

    if (!Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({
        success: false,

        message: "At least one file is required",
      });
    }

    const {
      ortho_visit_id,
      media_date,
      media_type,
      category,
      stage,
      description,
      uploaded_by,
    } = req.body;

    if (!normalize(media_type)) {
      return res.status(400).json({
        success: false,

        message: "media_type is required",
      });
    }

    /* ----------------------------------------------------
       CHECK MULTER BUFFER
    ---------------------------------------------------- */

    const invalidFile = req.files.find((file) => !Buffer.isBuffer(file.buffer));

    if (invalidFile) {
      console.error("ORTHO FILE BUFFER MISSING:", {
        name: invalidFile.originalname,

        mimetype: invalidFile.mimetype,

        size: invalidFile.size,

        path: invalidFile.path,
      });

      return res.status(400).json({
        success: false,

        message: `File buffer missing for ${invalidFile.originalname}. Check Multer memoryStorage configuration.`,
      });
    }

    /* ----------------------------------------------------
       SAVE
    ---------------------------------------------------- */

    const data = await createOrthoMediaService({
      files: req.files,

      caseId,

      visitId: ortho_visit_id || "",

      mediaDate: media_date || "",

      mediaType: media_type,

      category: category || "",

      stage: stage || "",

      description: description || "",

      uploadedBy: uploaded_by || "",
    });

    return res.status(201).json({
      success: true,

      message:
        data.length === 1
          ? "Ortho media uploaded successfully"
          : `${data.length} Ortho media files uploaded successfully`,

      count: data.length,

      data,
    });
  } catch (error) {
    console.error("uploadOrthoMedia error:", error);

    if (error.message === "Ortho case not found") {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    if (
      error.message === "At least one file is required" ||
      error.message === "Ortho case ID is required" ||
      error.message === "Media type is required" ||
      error.message === "Patient ID is missing from Ortho case"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return sendServerError(res, error, "Failed to upload Ortho media");
  }
};

/* --------------------------------------------------------
   GET MEDIA BY CASE
-------------------------------------------------------- */

export const getOrthoMediaByCase = async (req, res) => {
  try {
    const { caseId } = req.params;

    const data = await getOrthoMediaByCaseService(caseId, {
      media_type: req.query.media_type,

      stage: req.query.stage,

      visit_id: req.query.visit_id,
    });

    return res.json({
      success: true,

      count: data.length,

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho media");
  }
};

/* --------------------------------------------------------
   GET MEDIA BY ID
-------------------------------------------------------- */

export const getOrthoMediaById = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const data = await getOrthoMediaByIdService(mediaId);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho media not found",
      });
    }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho media");
  }
};

/* --------------------------------------------------------
   STREAM FILE
-------------------------------------------------------- */

export const viewOrthoMediaFile = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const result = await getOrthoMediaFileStream(mediaId);

    if (!result) {
      return res.status(404).json({
        success: false,

        message: "Ortho media not found",
      });
    }

    const { media, metadata, stream } = result;

    const mimeType =
      normalize(metadata?.mimeType) ||
      normalize(media?.mime_type) ||
      "application/octet-stream";

    const fileName =
      normalize(metadata?.name) || normalize(media?.file_name) || "file";

    res.setHeader("Content-Type", mimeType);

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${fileName.replace(/"/g, "")}"`,
    );

    stream.on("error", (streamError) => {
      console.error("Ortho media stream error:", streamError);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,

          message: "Failed to stream Ortho media",
        });
      } else {
        res.end();
      }
    });

    stream.pipe(res);
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho media file");
  }
};

/* --------------------------------------------------------
   SOFT DELETE
-------------------------------------------------------- */

export const deleteOrthoMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const data = await deleteOrthoMediaService(mediaId);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho media not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho media removed successfully",

      data,
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to remove Ortho media");
  }
};

/* --------------------------------------------------------
   PERMANENT DELETE
-------------------------------------------------------- */

export const permanentlyDeleteOrthoMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;

    const data = await permanentlyDeleteOrthoMediaService(mediaId);

    if (!data) {
      return res.status(404).json({
        success: false,

        message: "Ortho media not found",
      });
    }

    return res.json({
      success: true,

      message: "Ortho media permanently deleted",

      data,
    });
  } catch (error) {
    return sendServerError(
      res,
      error,
      "Failed to permanently delete Ortho media",
    );
  }
};

/* ========================================================
   CASE SUMMARY
======================================================== */

export const getOrthoCaseSummary = async (req, res) => {
  try {
    const { caseId } = req.params;

    const orthoCase = await getOrthoCaseByIdService(caseId);

    if (!orthoCase) {
      return res.status(404).json({
        success: false,

        message: "Ortho case not found",
      });
    }

    const [visits, paymentResult, media] = await Promise.all([
      getOrthoVisitsByCaseService(caseId),

      getOrthoPaymentsByCaseService(caseId),

      getOrthoMediaByCaseService(caseId),
    ]);

    const totalFee = Number(orthoCase.total_treatment_fee || 0);

    const totalPaid = Number(paymentResult.totalPaid || 0);

    const balance = Math.max(totalFee - totalPaid, 0);

    const sortedVisits = [...visits].sort(
      (a, b) => Number(a.visit_number || 0) - Number(b.visit_number || 0),
    );

    const lastVisit =
      sortedVisits.length > 0 ? sortedVisits[sortedVisits.length - 1] : null;

    return res.json({
      success: true,

      data: {
        case: orthoCase,

        financials: {
          total_fee: totalFee,

          total_paid: totalPaid,

          balance,
        },

        visit_count: sortedVisits.length,

        payment_count: paymentResult.payments.length,

        media_count: media.length,

        last_visit: lastVisit,

        next_visit_date: orthoCase.next_visit_date || "",

        visits: sortedVisits,

        payments: paymentResult.payments,

        media,
      },
    });
  } catch (error) {
    return sendServerError(res, error, "Failed to load Ortho case summary");
  }
};
