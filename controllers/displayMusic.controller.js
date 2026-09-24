import * as displayMusicService from "../services/displayMusic.service.js";

/* =========================================================
   GET DISPLAY MUSIC
========================================================= */

const getDisplayMusic = async (req, res) => {
  try {
    const data =
      await displayMusicService.getDisplayMusic();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET DISPLAY MUSIC ERROR:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to get display music settings.",
    });
  }
};

/* =========================================================
   UPDATE / CHANGE MUSIC
========================================================= */

const updateDisplayMusic = async (req, res) => {
  try {
    const {
      youtube_url,
      playing = true,
      volume = 20,
    } = req.body;

    if (!youtube_url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "YouTube URL is required.",
      });
    }

    const data =
      await displayMusicService.updateDisplayMusic({
        youtube_url: youtube_url.trim(),
        playing,
        volume,
      });

    return res.status(200).json({
      success: true,
      message:
        "Display music updated successfully.",
      data,
    });
  } catch (error) {
    console.error(
      "UPDATE DISPLAY MUSIC ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update display music.",
      });
  }
};

/* =========================================================
   PLAY
========================================================= */

const playDisplayMusic = async (req, res) => {
  try {
    const data =
      await displayMusicService.updatePlayingState(
        true,
      );

    return res.status(200).json({
      success: true,
      message: "Display music started.",
      data,
    });
  } catch (error) {
    console.error(
      "PLAY DISPLAY MUSIC ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to start display music.",
      });
  }
};

/* =========================================================
   PAUSE
========================================================= */

const pauseDisplayMusic = async (req, res) => {
  try {
    const data =
      await displayMusicService.updatePlayingState(
        false,
      );

    return res.status(200).json({
      success: true,
      message: "Display music paused.",
      data,
    });
  } catch (error) {
    console.error(
      "PAUSE DISPLAY MUSIC ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to pause display music.",
      });
  }
};

/* =========================================================
   VOLUME
========================================================= */

const updateDisplayMusicVolume = async (req, res) => {
  try {
    const { volume } = req.body;

    if (
      volume === undefined ||
      volume === null ||
      volume === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Volume is required.",
      });
    }

    const numericVolume = Number(volume);

    if (!Number.isFinite(numericVolume)) {
      return res.status(400).json({
        success: false,
        message:
          "Volume must be a valid number.",
      });
    }

    const data =
      await displayMusicService.updateVolume(
        numericVolume,
      );

    return res.status(200).json({
      success: true,
      message:
        "Display music volume updated.",
      data,
    });
  } catch (error) {
    console.error(
      "UPDATE DISPLAY MUSIC VOLUME ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update volume.",
      });
  }
};

/* =========================================================
   EXPORTS
========================================================= */

export {
  getDisplayMusic,
  updateDisplayMusic,
  playDisplayMusic,
  pauseDisplayMusic,
  updateDisplayMusicVolume,
};

export default {
  getDisplayMusic,
  updateDisplayMusic,
  playDisplayMusic,
  pauseDisplayMusic,
  updateDisplayMusicVolume,
};