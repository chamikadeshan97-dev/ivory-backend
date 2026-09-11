import express from "express";

import * as queueOrderController from "../controllers/queueOrder.controller.js";

const router = express.Router();

/* ========================================================
   Queue Order Routes
======================================================== */

/**
 * GET
 * /api/queue-order?date=2026-08-26
 */
router.get(
  "/",
  queueOrderController.getQueueByDate
);

/**
 * PUT
 * /api/queue-order
 *
 * Body:
 * {
 *   date: "2026-08-26",
 *   queue_order: [
 *     "APP_20260826_0003",
 *     "APP_20260826_0005",
 *     "APP_20260826_0001"
 *   ]
 * }
 */
router.put(
  "/",
  queueOrderController.saveQueue
);

/**
 * DELETE
 * /api/queue-order?date=2026-08-26
 */
router.delete(
  "/",
  queueOrderController.clearQueue
);

export default router;