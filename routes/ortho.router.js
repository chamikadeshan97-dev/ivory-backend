import express from "express";

import mediaUpload from "../middleware/mediaUpload.js";

import {
  /* =====================================================
     CASES
  ===================================================== */

  createOrthoCase,
  getAllOrthoCases,
  getOrthoCaseById,
  getOrthoCasesByPatient,
  updateOrthoCase,
  updateOrthoCaseStatus,
  getOrthoCaseSummary,

  /* =====================================================
     VISITS
  ===================================================== */

  createOrthoVisit,
  getOrthoVisitsByCase,
  getOrthoVisitById,
  updateOrthoVisit,
  deleteOrthoVisit,

  /* =====================================================
     PAYMENTS
  ===================================================== */

  createOrthoPayment,
  getOrthoPaymentsByCase,
  getOrthoPaymentById,
  updateOrthoPayment,
  deleteOrthoPayment,

  /* =====================================================
     MEDIA
  ===================================================== */

  uploadOrthoMedia,
  getOrthoMediaByCase,
  getOrthoMediaById,
  viewOrthoMediaFile,
  deleteOrthoMedia,
  permanentlyDeleteOrthoMedia,
} from "../controllers/ortho.controller.js";

const router = express.Router();

/* ========================================================
   ORTHO CASES
======================================================== */

router.post(
  "/cases",
  createOrthoCase,
);

router.get(
  "/cases",
  getAllOrthoCases,
);

router.get(
  "/patient/:patientId",
  getOrthoCasesByPatient,
);

router.get(
  "/cases/:caseId/summary",
  getOrthoCaseSummary,
);

router.get(
  "/cases/:caseId",
  getOrthoCaseById,
);

router.patch(
  "/cases/:caseId",
  updateOrthoCase,
);

router.patch(
  "/cases/:caseId/status",
  updateOrthoCaseStatus,
);

/* ========================================================
   ORTHO VISITS
======================================================== */

router.post(
  "/cases/:caseId/visits",
  createOrthoVisit,
);

router.get(
  "/cases/:caseId/visits",
  getOrthoVisitsByCase,
);

router.get(
  "/visits/:visitId",
  getOrthoVisitById,
);

router.patch(
  "/visits/:visitId",
  updateOrthoVisit,
);

router.delete(
  "/visits/:visitId",
  deleteOrthoVisit,
);

/* ========================================================
   ORTHO PAYMENTS
======================================================== */

router.post(
  "/cases/:caseId/payments",
  createOrthoPayment,
);

router.get(
  "/cases/:caseId/payments",
  getOrthoPaymentsByCase,
);

router.get(
  "/payments/:paymentId",
  getOrthoPaymentById,
);

router.patch(
  "/payments/:paymentId",
  updateOrthoPayment,
);

router.delete(
  "/payments/:paymentId",
  deleteOrthoPayment,
);

/* ========================================================
   ORTHO MEDIA
======================================================== */

/*
 * IMPORTANT
 *
 * Frontend must send multipart/form-data
 * using the field name:
 *
 * files
 */

router.post(
  "/cases/:caseId/media",
  mediaUpload.array(
    "files",
    10,
  ),
  uploadOrthoMedia,
);

/*
 * Get all media for an Ortho case.
 *
 * Optional filters:
 *
 * ?media_type=Clinical Photo
 * ?stage=During Treatment
 * ?visit_id=ORV_000001
 */

router.get(
  "/cases/:caseId/media",
  getOrthoMediaByCase,
);

/*
 * Stream actual Google Drive file.
 */

router.get(
  "/media/:mediaId/view",
  viewOrthoMediaFile,
);

/*
 * Get media metadata.
 */

router.get(
  "/media/:mediaId",
  getOrthoMediaById,
);

/*
 * Soft delete.
 */

router.delete(
  "/media/:mediaId",
  deleteOrthoMedia,
);

/*
 * Permanent delete:
 *
 * removes Drive file
 * +
 * removes Google Sheet row
 */

router.delete(
  "/media/:mediaId/permanent",
  permanentlyDeleteOrthoMedia,
);

/* ========================================================
   EXPORT
======================================================== */

export default router;