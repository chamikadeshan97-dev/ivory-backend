import express from "express";
import patientController, { getPatientFullDetailsController } from "../controllers/patient.controller.js";

const router = express.Router();

// Create
router.post("/", patientController.createPatient);

// Read
router.get("/", patientController.getAllPatients);
router.get("/search", patientController.searchPatients);
router.get("/statistics", patientController.getPatientStatistics);
router.get("/recent", patientController.getRecentPatients);
router.get("/:id/history", patientController.getPatientHistory);
router.get("/:id", patientController.getPatientById);

router.get(
  "/:patientId/full-details",
  getPatientFullDetailsController,
);


// Update
router.put("/:id", patientController.updatePatient);

// Delete
router.delete("/:id", patientController.deletePatient);

export default router;