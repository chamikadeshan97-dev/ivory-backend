import express from "express";

import mediaUpload from "../middleware/mediaUpload.js";

import {
  deletePatientMedia,
  downloadPatientMedia,
  getAppointmentMedia,
  getMediaById,
  getPatientMedia,
  getTreatmentMedia,
  hardDeletePatientMedia,
  uploadPatientMedia,
  viewPatientMedia,
} from "../controllers/patientMedia.controller.js";




const router = express.Router();

router.post(
  "/upload",

  mediaUpload.array("files", 10),
  uploadPatientMedia,
);

router.get(
  "/patient/:patientId",

  getPatientMedia,
);

router.get(
  "/appointment/:appointmentId",

  getAppointmentMedia,
);

router.get(
  "/treatment/:treatmentId",

  getTreatmentMedia,
);

router.get(
  "/:mediaId/view",

  viewPatientMedia,
);

router.get(
  "/:mediaId/download",

  downloadPatientMedia,
);

router.delete(
  "/:mediaId/permanent",
  hardDeletePatientMedia,
);

router.delete(
  "/:mediaId",

  deletePatientMedia,
);

router.get(
  "/:mediaId",

  
  getMediaById,
);

export default router;