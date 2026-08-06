import express from "express";

import {
  startWaiting,
  endWaiting,
  getAllWaitingRecords,
  getActiveWaitingRecords,
  getWaitingByAppointmentId,
} from "../controllers/inWaiting.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| In Waiting Routes
|--------------------------------------------------------------------------
*/

// Get every waiting record
router.get("/", getAllWaitingRecords);

// Get patients who are currently waiting
router.get("/active", getActiveWaitingRecords);

// Get waiting information for one appointment
router.get("/appointment/:appointmentId", getWaitingByAppointmentId);

// Start waiting for an appointment
router.post("/start/:appointmentId", startWaiting);

// End waiting for an appointment
router.patch("/end/:appointmentId", endWaiting);

export default router;