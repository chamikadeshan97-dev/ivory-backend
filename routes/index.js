import express from "express";

import patientRoutes from "./patient.routes.js";
import dentistRoutes from "./dentist.routes.js";
import appointmentRoutes from "./appointment.routes.js";
import treatmentRoutes from "./treatment.routes.js";
import paymentRoutes from "./payment.routes.js";
import reportRoutes from "./report.routes.js";
import authRoutes from "./auth.routes.js";
import commonTreatmentRouter from "./commonTreatments.routes.js";
import dailyQueueRoutes from "./dailyQueue.routes.js";
import drugRoutes from "./drug.routes.js";
import inWaitingRoutes from "./inWaiting.routes.js";
import locationRoutes from "./locations.routes.js";

const router = express.Router();

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Dental Clinic Backend is running V2",
  });
});

router.use("/patients", patientRoutes);
router.use("/dentists", dentistRoutes);
router.use("/appointments", appointmentRoutes);
router.use("/treatments", treatmentRoutes);
router.use("/payments", paymentRoutes);
router.use("/reports", reportRoutes);
router.use("/daily-queue", dailyQueueRoutes);
router.use("/auth", authRoutes);
router.use("/common-treatments",commonTreatmentRouter)
router.use("/drugs", drugRoutes);
router.use("/locations", locationRoutes);
router.use("/in-waiting", inWaitingRoutes);
export default router;
