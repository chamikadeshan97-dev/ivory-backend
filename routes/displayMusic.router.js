import express from "express";

import {
  getDisplayMusic,
  updateDisplayMusic,
  playDisplayMusic,
  pauseDisplayMusic,
  updateDisplayMusicVolume,

  // Video
  getDisplayVideo,
  updateDisplayVideo,
  playDisplayVideo,
  pauseDisplayVideo,
  updateDisplayVideoVolume,
  removeDisplayVideo,

  // Display mode
  getDisplayMode,
  updateDisplayMode,
} from "../controllers/displayMusic.controller.js";

const router = express.Router();

/* =========================================================
   MUSIC
========================================================= */

/* GET CURRENT MUSIC */

router.get(
  "/",
  getDisplayMusic,
);

/* CHANGE MUSIC */

router.post(
  "/",
  updateDisplayMusic,
);

/* PLAY MUSIC */

router.post(
  "/play",
  playDisplayMusic,
);

/* PAUSE MUSIC */

router.post(
  "/pause",
  pauseDisplayMusic,
);

/* MUSIC VOLUME */

router.post(
  "/volume",
  updateDisplayMusicVolume,
);

/* =========================================================
   VIDEO
========================================================= */

/* GET CURRENT VIDEO */

router.get(
  "/video",
  getDisplayVideo,
);

/* SET / CHANGE VIDEO */

router.post(
  "/video",
  updateDisplayVideo,
);

/* PLAY VIDEO */

router.post(
  "/video/play",
  playDisplayVideo,
);

/* PAUSE VIDEO */

router.post(
  "/video/pause",
  pauseDisplayVideo,
);

/* VIDEO VOLUME */

router.post(
  "/video/volume",
  updateDisplayVideoVolume,
);

/* REMOVE VIDEO */

router.delete(
  "/video",
  removeDisplayVideo,
);

/* =========================================================
   DISPLAY MODE
========================================================= */

/*
 * Current mode:
 * queue | video
 */

router.get(
  "/mode",
  getDisplayMode,
);

/*
 * POST /display-music/mode
 *
 * {
 *   mode: "queue"
 * }
 *
 * or
 *
 * {
 *   mode: "video"
 * }
 */
router.post(
  "/mode",
  updateDisplayMode,
);

export default router;