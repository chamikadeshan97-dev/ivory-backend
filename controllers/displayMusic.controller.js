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
   PLAY MUSIC
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
   PAUSE MUSIC
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
   MUSIC VOLUME
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
   GET DISPLAY VIDEO
========================================================= */

const getDisplayVideo = async (req, res) => {
  try {
    const data =
      await displayMusicService.getDisplayVideo();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET DISPLAY VIDEO ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to get display video.",
      });
  }
};

/* =========================================================
   UPDATE / CHANGE VIDEO
========================================================= */

const updateDisplayVideo = async (req, res) => {
  try {
    const {
      youtube_url,
      playing = true,
      volume = 50,
    } = req.body;

    if (!youtube_url?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Video YouTube URL is required.",
      });
    }

    const numericVolume = Number(volume);

    if (
      !Number.isFinite(numericVolume) ||
      numericVolume < 0 ||
      numericVolume > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Volume must be between 0 and 100.",
      });
    }

    const data =
      await displayMusicService.updateDisplayVideo({
        youtube_url: youtube_url.trim(),
        playing: Boolean(playing),
        volume: numericVolume,
      });

    return res.status(200).json({
      success: true,
      message:
        "Display video updated successfully.",
      data,
    });
  } catch (error) {
    console.error(
      "UPDATE DISPLAY VIDEO ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update display video.",
      });
  }
};

/* =========================================================
   PLAY VIDEO
========================================================= */

const playDisplayVideo = async (req, res) => {
  try {
    const data =
      await displayMusicService.updateVideoPlayingState(
        true,
      );

    return res.status(200).json({
      success: true,
      message: "Display video started.",
      data,
    });
  } catch (error) {
    console.error(
      "PLAY DISPLAY VIDEO ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to start display video.",
      });
  }
};

/* =========================================================
   PAUSE VIDEO
========================================================= */

const pauseDisplayVideo = async (req, res) => {
  try {
    const data =
      await displayMusicService.updateVideoPlayingState(
        false,
      );

    return res.status(200).json({
      success: true,
      message: "Display video paused.",
      data,
    });
  } catch (error) {
    console.error(
      "PAUSE DISPLAY VIDEO ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to pause display video.",
      });
  }
};

/* =========================================================
   VIDEO VOLUME
========================================================= */

const updateDisplayVideoVolume = async (
  req,
  res,
) => {
  try {
    const { volume } = req.body;

    if (
      volume === undefined ||
      volume === null ||
      volume === ""
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Video volume is required.",
      });
    }

    const numericVolume = Number(volume);

    if (
      !Number.isFinite(numericVolume) ||
      numericVolume < 0 ||
      numericVolume > 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Volume must be between 0 and 100.",
      });
    }

    const data =
      await displayMusicService.updateVideoVolume(
        numericVolume,
      );

    return res.status(200).json({
      success: true,
      message:
        "Display video volume updated.",
      data,
    });
  } catch (error) {
    console.error(
      "UPDATE DISPLAY VIDEO VOLUME ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update video volume.",
      });
  }
};

/* =========================================================
   REMOVE VIDEO
========================================================= */

const removeDisplayVideo = async (req, res) => {
  try {
    const data =
      await displayMusicService.removeDisplayVideo();

    return res.status(200).json({
      success: true,
      message:
        "Display video removed successfully.",
      data,
    });
  } catch (error) {
    console.error(
      "REMOVE DISPLAY VIDEO ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to remove display video.",
      });
  }
};

/* =========================================================
   GET DISPLAY MODE
========================================================= */

const getDisplayMode = async (req, res) => {
  try {
    const data =
      await displayMusicService.getDisplayMode();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "GET DISPLAY MODE ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to get display mode.",
      });
  }
};

/* =========================================================
   UPDATE DISPLAY MODE
========================================================= */

const updateDisplayMode = async (req, res) => {
  try {
    const { mode } = req.body;

    if (!mode) {
      return res.status(400).json({
        success: false,
        message:
          "Display mode is required.",
      });
    }

    const normalizedMode =
      String(mode).trim().toLowerCase();

    const allowedModes = [
      "queue",
      "video",
    ];

    if (
      !allowedModes.includes(
        normalizedMode,
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Display mode must be queue or video.",
      });
    }

    const data =
      await displayMusicService.updateDisplayMode(
        normalizedMode,
      );

    return res.status(200).json({
      success: true,
      message:
        `Display changed to ${normalizedMode} mode.`,
      data,
    });
  } catch (error) {
    console.error(
      "UPDATE DISPLAY MODE ERROR:",
      error,
    );

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message:
          error.message ||
          "Unable to update display mode.",
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

  getDisplayVideo,
  updateDisplayVideo,
  playDisplayVideo,
  pauseDisplayVideo,
  updateDisplayVideoVolume,
  removeDisplayVideo,

  getDisplayMode,
  updateDisplayMode,
};