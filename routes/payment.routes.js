import express from "express";
import paymentController from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/", paymentController.createPayment);
router.get("/", paymentController.getPayments);

export default router;
