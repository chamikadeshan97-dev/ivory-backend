import express from "express";

import {
  createLocation,
  deleteLocation,
  getAllLocations,
  getLocationById,
  updateLocation,
} from "../controllers/location.controller.js";

const router = express.Router();

router.get("/", getAllLocations);

router.get("/:id", getLocationById);

router.post("/", createLocation);

router.put("/:id", updateLocation);

router.delete("/:id", deleteLocation);

export default router;