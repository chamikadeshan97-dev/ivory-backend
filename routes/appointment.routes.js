import express from "express";
import appointmentController from "../controllers/appointment.controller.js";

const router = express.Router();

router.post("/", appointmentController.createAppointment);

router.get("/", appointmentController.getAppointments);

// Keep specific routes before dynamic /:id routes
router.get("/range", appointmentController.getAppointmentsByDateRange);

// Get single appointment
router.get("/:id", appointmentController.getAppointmentById);

router.get(
  "/:appointmentId/full-details",
  appointmentController.getAppointmentFullDetails,
);
router.get( "/treatment/:treatmentId", appointmentController.getAppointmentByTreatmentId); //->TRT_90000b36
// Status update
router.patch(
  "/:id/status",
  appointmentController.updateAppointmentStatusController,
);

// Full update
router.patch("/:id", appointmentController.updateAppointment);

export default router;
