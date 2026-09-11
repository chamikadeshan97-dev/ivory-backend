import * as queueOrderService from "../services/queueOrder.service.js";

/* ========================================================
   GET /api/queue-order?date=YYYY-MM-DD
======================================================== */

export const getQueueByDate = async (
  req,
  res,
  next
) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        status: "fail",
        message: "Date is required",
      });
    }

    const queue =
      await queueOrderService.getQueueByDate(
        date
      );

    return res.status(200).json({
      status: "success",
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/* ========================================================
   PUT /api/queue-order
======================================================== */

export const saveQueue = async (
  req,
  res,
  next
) => {
  try {
    const {
      date,
      queue_order,
    } = req.body;

    if (!date) {
      return res.status(400).json({
        status: "fail",
        message: "Date is required",
      });
    }

    if (!Array.isArray(queue_order)) {
      return res.status(400).json({
        status: "fail",
        message:
          "queue_order must be an array",
      });
    }

    const queue =
      await queueOrderService.saveQueue({
        date,
        queue_order,
      });

    return res.status(200).json({
      status: "success",
      message:
        "Queue saved successfully",
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

/* ========================================================
   DELETE /api/queue-order?date=YYYY-MM-DD
======================================================== */

export const clearQueue = async (
  req,
  res,
  next
) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        status: "fail",
        message: "Date is required",
      });
    }

    const queue =
      await queueOrderService.clearQueue(
        date
      );

    return res.status(200).json({
      status: "success",
      message:
        "Queue cleared successfully",
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};