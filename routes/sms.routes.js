import express from "express";

import {
  loginSmsApi,
  sendSingleSms,
  sendBulkSmsController,
  normalizeSmsNumber,
  getSmsTokenStatus,
  clearSmsToken,sendTemplateSMS
} from "../controllers/sms.Controller.js";

const router = express.Router();

/* =========================================================
   HUTCH SMS ROUTES
========================================================= */

router.post("/login", loginSmsApi);

router.post("/send", sendSingleSms);

router.post("/bulk", sendBulkSmsController);

router.post("/normalize", normalizeSmsNumber);

router.get("/token-status", getSmsTokenStatus);

router.delete("/token", clearSmsToken);

router.post(
  "/send-template",
  sendTemplateSMS,
);
/* =========================================================
   EXPORT
========================================================= */

export default router;