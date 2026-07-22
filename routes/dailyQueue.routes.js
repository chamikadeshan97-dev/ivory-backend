import express from "express";

import {
  addWalkInToQueue,
  checkInAppointment,
  deleteQueueItem,
  getCurrentQueuePatient,
  getDailyQueue,
  getNextQueuePatient,
  getPreviousQueuePatient,
  getQueueItemById,
  updateQueueStatus,
} from "../controllers/dailyQueue.controller.js";

const router = express.Router();

router.get("/", getDailyQueue);

router.get("/next", getNextQueuePatient);

router.get("/current", getCurrentQueuePatient);

router.get("/previous", getPreviousQueuePatient);

router.post("/check-in", checkInAppointment);

router.post("/walk-in", addWalkInToQueue);

router.patch("/:id/status", updateQueueStatus);

router.get("/:id", getQueueItemById);

router.delete("/:id", deleteQueueItem);

export default router;