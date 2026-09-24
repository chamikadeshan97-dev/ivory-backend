import express from "express";

import {
  getDisplayMusic,
  updateDisplayMusic,
  playDisplayMusic,
  pauseDisplayMusic,
  updateDisplayMusicVolume,
} from "../controllers/displayMusic.controller.js";

const router = express.Router();

/* =========================================================
   GET CURRENT MUSIC
========================================================= */

router.get(
  "/",
  getDisplayMusic,
);

/* =========================================================
   CHANGE MUSIC
========================================================= */

router.post(
  "/",
  updateDisplayMusic,
);

/* =========================================================
   PLAY
========================================================= */

router.post(
  "/play",
  playDisplayMusic,
);

/* =========================================================
   PAUSE
========================================================= */

router.post(
  "/pause",
  pauseDisplayMusic,
);

/* =========================================================
   VOLUME
========================================================= */

router.post(
  "/volume",
  updateDisplayMusicVolume,
);

export default router;