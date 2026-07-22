import express from "express";
import reportController from "../controllers/report.controller.js";

const router = express.Router();

router.get("/daily-appointments", reportController.getDailyAppointments);
router.get("/daily-income", reportController.getDailyIncome);
router.get(
  "/daily-next-appointments",
  reportController.getDailyNextAppointments,
);
router.get("/income-range", reportController.getIncomeByDateRange);
export default router;
