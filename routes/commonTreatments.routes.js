import express from "express";

import commonTreatmentController from "../controllers/commonTreatment.controller.js";

const router = express.Router();

/* --------------------------------------------------------
   Create
-------------------------------------------------------- */

router.post(
  "/",
  commonTreatmentController.createCommonTreatment,
);

/* --------------------------------------------------------
   Read
-------------------------------------------------------- */

router.get(
  "/",
  commonTreatmentController.getAllCommonTreatments,
);

router.get(
  "/search",
  commonTreatmentController.searchCommonTreatments,
);

router.get(
  "/statistics",
  commonTreatmentController.getCommonTreatmentStatistics,
);

router.get(
  "/:id",
  commonTreatmentController.getCommonTreatmentById,
);

/* --------------------------------------------------------
   Update
-------------------------------------------------------- */

router.put(
  "/:id",
  commonTreatmentController.updateCommonTreatment,
);

/* --------------------------------------------------------
   Delete
-------------------------------------------------------- */

router.delete(
  "/:id",
  commonTreatmentController.deleteCommonTreatment,
);

export default router;