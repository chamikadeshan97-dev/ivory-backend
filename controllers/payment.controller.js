import * as paymentService from "../services/payment.service.js";

import sendError from "../utils/sendError.js";

/*
|--------------------------------------------------------------------------
| Create Payment
|--------------------------------------------------------------------------
|
| POST /api/payments
|
*/

async function createPayment(req, res) {
  try {
    const payment =
      await paymentService.createPayment(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message:
        "Payment recorded successfully",
      data: payment,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to record payment",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Get Payments
|--------------------------------------------------------------------------
|
| GET /api/payments
|
*/

async function getPayments(req, res) {
  try {
    const payments =
      await paymentService.getPayments(
        req.query,
      );

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch payments",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Export Controller
|--------------------------------------------------------------------------
*/

export default {
  createPayment,
  getPayments,
};