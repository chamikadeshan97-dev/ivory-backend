
import express from "express";
import multer from "multer";

import {
  getDisplaySlides,
  getAdminSlides,
  addDisplaySlide,
  editDisplaySlide,
  changeDisplaySlideImage,
  removeDisplaySlide,
} from "../controllers/idleDisplayController.js";

/* =========================================================
   ROUTER
========================================================= */

const router = express.Router();

/* =========================================================
   UPLOAD CONFIGURATION
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },

  fileFilter: (req, file, callback) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error(
          "Only JPG, PNG and WebP images are allowed",
        ),
      );
    }

    callback(null, true);
  },
});

/* =========================================================
   REQUEST LOGGER
========================================================= */

router.use((req, res, next) => {
  console.log(
    `[IDLE DISPLAY ROUTER] ${req.method} ${req.originalUrl}`,
  );

  next();
});

/* =========================================================
   PUBLIC DISPLAY
========================================================= */

router.get("/", getDisplaySlides);

/* =========================================================
   ADMIN ROUTES

   IMPORTANT:
   Add your existing authentication + admin
   authorization middleware before these routes.
========================================================= */

router.get("/all", getAdminSlides);

/* =========================================================
   CREATE POSTER
========================================================= */

router.post(
  "/",

  (req, res, next) => {
    console.log("[IDLE] STEP A: Route reached");
    next();
  },

  (req, res, next) => {
    console.log("[IDLE] STEP B: Starting Multer");

    upload.single("image")(req, res, (error) => {
      if (error) {
        console.error("[IDLE] Multer error:", error);
        return next(error);
      }

      console.log("[IDLE] STEP C: Multer completed");

      console.log("[IDLE] File:", {
        name: req.file?.originalname,
        size: req.file?.size,
        type: req.file?.mimetype,
      });

      next();
    });
  },

  (req, res, next) => {
    console.log("[IDLE] STEP D: Controller next");
    next();
  },

  addDisplaySlide,
);

/* =========================================================
   UPDATE POSTER DETAILS
========================================================= */

router.patch("/:slideId", editDisplaySlide);

/* =========================================================
   REPLACE POSTER IMAGE
========================================================= */

router.put(
  "/:slideId/image",
  upload.single("image"),
  changeDisplaySlideImage,
);

/* =========================================================
   DELETE POSTER
========================================================= */

router.delete("/:slideId", removeDisplaySlide);

/* =========================================================
   ERROR HANDLING
========================================================= */

router.use((error, req, res, next) => {
  if (
    error instanceof multer.MulterError ||
    error.message?.includes(
      "Only JPG, PNG and WebP",
    )
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  next(error);
});

/* =========================================================
   EXPORT ROUTER
========================================================= */

export default router;
