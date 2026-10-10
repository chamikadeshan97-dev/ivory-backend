
/* ============================================================
   IVORY DENTAL - SMS LOG API ROUTES
============================================================ */

import express from "express";

import {
  getSMSStatus,
  getTodaySMSStatuses,
  claimSMSBatch,
  completeSMSBatch,
} from "../services/smsLogService.js";

const router = express.Router();

/* ============================================================
   ERROR HANDLER
============================================================ */

const handleError = (res, error) => {
  console.error("SMS log error:", error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "Unable to process SMS tracking request."
        : error.message,
  });
};

/* ============================================================
   GET BOTH SMS STATUSES
   GET /api/sms-logs/today
============================================================ */

router.get("/today", async (req, res) => {
  try {
    const data = await getTodaySMSStatuses();

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/* ============================================================
   GET SINGLE SMS STATUS
   GET /api/sms-logs/status/:smsType
============================================================ */

router.get("/status/:smsType", async (req, res) => {
  try {
    const data = await getSMSStatus(
      req.params.smsType
    );

    return res.json({
      success: true,
      ...data,
    });
  } catch (error) {
    return handleError(res, error);
  }
});

/* ============================================================
   CLAIM SMS BATCH
   POST /api/sms-logs/claim
============================================================ */

router.post("/claim", async (req, res) => {
  try {
    const { smsType, total } = req.body;

    // Identity must come from authentication,
    // not from a client-controlled request body.
    const sentBy =
      req.user?.username ||
      req.user?.name ||
      req.user?.id ||
      "Unknown";

    const result = await claimSMSBatch({
      smsType,
      total,
      sentBy,
    });

    return res.status(
      result.success ? 200 : 409
    ).json(result);

  } catch (error) {
    return handleError(res, error);
  }
});

/* ============================================================
   COMPLETE SMS BATCH
   POST /api/sms-logs/complete
============================================================ */

router.post("/complete", async (req, res) => {
  try {
    const {
      smsType,
      token,
      successCount,
      failedCount,
    } = req.body;

    const result = await completeSMSBatch({
      smsType,
      token,
      successCount,
      failedCount,
    });

    return res.json(result);

  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
