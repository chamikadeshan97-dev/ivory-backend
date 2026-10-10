
import express from "express";
import multer from "multer";

import mediaUpload from "../middleware/mediaUpload.js";

import {
  deletePatientMedia,
  downloadPatientMedia,
  getAppointmentMedia,
  getMediaById,
  getPatientMedia,
  getTreatmentMedia,
  uploadPatientMedia,
  viewPatientMedia,
} from "../controllers/patientMedia.controller.js";

/* ========================================================
   ROUTER
======================================================== */

const router = express.Router();

/* ========================================================
   AUTHENTICATION GUARD

   IMPORTANT:
   Your existing authentication middleware must
   run BEFORE this router and populate req.user.

   This guard checks authentication only.
   Patient-level authorization is still required.
======================================================== */

const requireAuthenticatedUser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  return next();
};

/* ========================================================
   MULTER UPLOAD WRAPPER
======================================================== */

const handleMediaUpload = (req, res, next) => {
  mediaUpload.array("files", 10)(
    req,
    res,
    (error) => {
      if (!error) {
        return next();
      }

      if (error instanceof multer.MulterError) {
        const errorMessages = {
          LIMIT_FILE_SIZE:
            "Each file must not exceed 10 MB",

          LIMIT_FILE_COUNT:
            "Maximum 10 files are allowed",

          LIMIT_UNEXPECTED_FILE:
            "Unexpected upload field or too many files",

          LIMIT_FIELD_VALUE:
            "An upload field exceeds the allowed size",

          LIMIT_FIELD_COUNT:
            "Too many form fields",

          LIMIT_PART_COUNT:
            "Too many multipart form parts",
        };

        return res.status(400).json({
          success: false,

          message:
            errorMessages[error.code] ||
            `File upload error: ${error.code}`,
        });
      }

      return res.status(400).json({
        success: false,

        message:
          error.message ||
          "Invalid clinical file upload",
      });
    },
  );
};

/* ========================================================
   APPLY AUTHENTICATION CHECK
======================================================== */

router.use(requireAuthenticatedUser);

/*
 * IMPORTANT:
 *
 * Before production use, add middleware here
 * or on individual routes that verifies the
 * user's permissions for the requested patient,
 * appointment, treatment, or media record.
 *
 * req.user alone does not authorize access
 * to every patient's clinical records.
 */

/* ========================================================
   UPLOAD MEDIA

   POST /api/patient-media/upload
======================================================== */

router.post(
  "/upload",
  handleMediaUpload,
  uploadPatientMedia,
);

/* ========================================================
   GET PATIENT MEDIA

   GET /api/patient-media/patient/:patientId
======================================================== */

router.get(
  "/patient/:patientId",
  getPatientMedia,
);

/* ========================================================
   GET APPOINTMENT MEDIA

   GET /api/patient-media/appointment/:appointmentId
======================================================== */

router.get(
  "/appointment/:appointmentId",
  getAppointmentMedia,
);

/* ========================================================
   GET TREATMENT MEDIA

   GET /api/patient-media/treatment/:treatmentId
======================================================== */

router.get(
  "/treatment/:treatmentId",
  getTreatmentMedia,
);

/* ========================================================
   VIEW MEDIA

   GET /api/patient-media/:mediaId/view
======================================================== */

router.get(
  "/:mediaId/view",
  viewPatientMedia,
);

/* ========================================================
   DOWNLOAD MEDIA

   GET /api/patient-media/:mediaId/download
======================================================== */

router.get(
  "/:mediaId/download",
  downloadPatientMedia,
);

/* ========================================================
   PERMANENT DELETE

   Keep disabled until admin authorization,
   audit logging, and retention checks exist.
======================================================== */

router.delete(
  "/:mediaId/permanent",
  (req, res) => {
    return res.status(403).json({
      success: false,

      message:
        "Permanent deletion is currently disabled",
    });
  },
);

/* ========================================================
   SOFT DELETE

   DELETE /api/patient-media/:mediaId
======================================================== */

router.delete(
  "/:mediaId",
  deletePatientMedia,
);

/* ========================================================
   GET SINGLE MEDIA RECORD

   GET /api/patient-media/:mediaId
======================================================== */

router.get(
  "/:mediaId",
  getMediaById,
);

/* ========================================================
   EXPORT
======================================================== */

export default router;
