import * as paymentService from "../services/payment.service.js";
import sendError from "../utils/sendError.js";

function createPayment(req, res) {
  try {
    const payment = paymentService.createPayment(req.body);

    res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: payment,
    });
  } catch (error) {
    sendError(res, error, "Failed to record payment");
  }
}

function getPayments(req, res) {
  try {
    const payments = paymentService.getPayments(req.query);

    res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    sendError(res, error, "Failed to fetch payments");
  }
}



export default {
  createPayment,

  getPayments,
};
