import express from "express";

import authController from "../controllers/auth.controller.js";
import authenticate from "../middleware/auth.middleware.js";

const router = express.Router();

/*
  POST /api/auth/login
*/
router.post("/login", authController.login);

/*
  GET /api/auth/me
*/
router.get("/me", authenticate, authController.getCurrentUser);

/*
  POST /api/auth/logout
*/
router.post("/logout", authenticate, authController.logout);
router.post("/register", authController.register);

export default router;
