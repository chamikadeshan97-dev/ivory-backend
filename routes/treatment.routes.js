import express from "express";
import treatmentController from "../controllers/treatment.controller.js";

const router = express.Router();

router.post("/", treatmentController.createTreatment);
router.get("/", treatmentController.getTreatments);
router.get(
  "/:treatmentId/payments",
  treatmentController.getPaymentsByTreatmentIdController,
);
router.get(
  "/follow-ups",
  treatmentController.getFollowUpPatients,
);
export default router;
