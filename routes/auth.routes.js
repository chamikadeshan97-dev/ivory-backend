import express from "express";

import authController from "../controllers/auth.controller.js";
import userController from "../controllers/user.controller.js";





const router = express.Router();

/* --------------------------------------------------------
   Authentication
-------------------------------------------------------- */

/*
  POST /api/auth/login
*/
router.post("/login", authController.login);

/*
  GET /api/auth/me
*/
router.get(
  "/me",
  
  authController.getCurrentUser,
);

/*
  POST /api/auth/logout
*/
router.post(
  "/logout",
  
  authController.logout,
);

/* --------------------------------------------------------
   User management
   Administrator access only
-------------------------------------------------------- */

/*
  POST /api/auth/register
*/
router.post(
  "/register",
  
 
  userController.register,
);

/*
  GET /api/auth/users
*/
router.get(
  "/users",
  
 
  userController.getAllUsers,
);

/*
  GET /api/auth/users/:userId
*/
router.get(
  "/users/:userId",
  
 
  userController.getUserById,
);

/*
  PUT /api/auth/users/:userId
*/
router.put(
  "/users/:userId",
  
 
  userController.updateUser,
);

/*
  DELETE /api/auth/users/:userId
*/
router.delete(
  "/users/:userId",
  
 
  userController.deleteUser,
);

export default router;