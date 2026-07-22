import express from "express";
import dentistController from "../controllers/dentist.controller.js";

const router = express.Router();

// Create
router.post("/", dentistController.createDentist);

// Read
router.get("/", dentistController.getAllDentists);
router.get("/search", dentistController.searchDentists);
router.get("/statistics", dentistController.getDentistStatistics);
router.get("/:id", dentistController.getDentistById);

// Update
router.put("/:id", dentistController.updateDentist);

// Delete
router.delete("/:id", dentistController.deleteDentist);

export default router;