import express from "express";

import {
  downloadCurrentExcelFile,
} from "../controllers/database.controller.js";

const router = express.Router();

router.get(
  "/download-excel",
  downloadCurrentExcelFile,
);

export default router;