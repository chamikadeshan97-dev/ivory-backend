import express from "express";

import * as drugController from "../controllers/drug.controller.js";

const router = express.Router();

/*
|--------------------------------------------------------------------------
| Drug Routes
|--------------------------------------------------------------------------
|
| Base path: /api/drugs
|
*/

// Create a drug
router.post("/", drugController.createDrug);

// Create multiple drugs
router.post("/bulk", drugController.createDrugsBulk);

// Get all drugs
router.get("/", drugController.getDrugs);

// Search drugs
// Keep this before the dynamic /:id route
router.get("/search", drugController.searchDrugs);

// Get a single drug
router.get("/:id", drugController.getDrugById);

// Full update
router.put("/:id", drugController.updateDrug);

// Partial update
router.patch("/:id", drugController.updateDrug);

// Delete a drug
router.delete("/:id", drugController.deleteDrug);

export default router;