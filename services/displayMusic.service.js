import { readSheet, writeSheet } from "../utils/googleSheets.js";

import appError from "../utils/appError.js";

/* =========================================================
   CONFIG
========================================================= */

const SHEET_NAME = "DisplayMusic";

const DEFAULT_MUSIC_VOLUME = 20;
const DEFAULT_VIDEO_VOLUME = 50;

const DEFAULT_DISPLAY_MODE = "queue";

const ALLOWED_DISPLAY_MODES = ["queue", "video"];

/* =========================================================
   HELPERS
========================================================= */

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeBoolean = (value) => {
  if (value === true || value === 1) {
    return true;
  }

  return ["true", "1", "yes"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );
};

const normalizeVolume = (value, fallback = 20) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(100, Math.max(0, Math.round(parsed)));
};

/* =========================================================
   EXTRACT YOUTUBE VIDEO ID
========================================================= */

const extractYouTubeVideoId = (url) => {
  const normalizedUrl = normalizeText(url);

  if (!normalizedUrl) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalizedUrl);

    const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();

    /* youtu.be/VIDEO_ID */

    if (hostname === "youtu.be") {
      const videoId = parsedUrl.pathname.split("/").filter(Boolean)[0];

      return normalizeText(videoId);
    }

    const isYouTubeHost =
      hostname === "youtube.com" || hostname.endsWith(".youtube.com");

    if (!isYouTubeHost) {
      return "";
    }

    /* youtube.com/watch?v=VIDEO_ID */

    const queryVideoId = parsedUrl.searchParams.get("v");

    if (queryVideoId) {
      return normalizeText(queryVideoId);
    }

    const parts = parsedUrl.pathname.split("/").filter(Boolean);

    /* /embed/VIDEO_ID */

    const embedIndex = parts.indexOf("embed");

    if (embedIndex !== -1 && parts[embedIndex + 1]) {
      return normalizeText(parts[embedIndex + 1]);
    }

    /* /shorts/VIDEO_ID */

    const shortsIndex = parts.indexOf("shorts");

    if (shortsIndex !== -1 && parts[shortsIndex + 1]) {
      return normalizeText(parts[shortsIndex + 1]);
    }

    /* /live/VIDEO_ID */

    const liveIndex = parts.indexOf("live");

    if (liveIndex !== -1 && parts[liveIndex + 1]) {
      return normalizeText(parts[liveIndex + 1]);
    }

    return "";
  } catch {
    return "";
  }
};

/* =========================================================
   GET SETTINGS ROWS
========================================================= */

async function getSettingsRows() {
  const rows = await readSheet(SHEET_NAME);

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter((row) => row && typeof row === "object");
}

/* =========================================================
   DEFAULT RECORD
========================================================= */

const createDefaultRecord = () => ({
  music_youtube_url: "",
  music_video_id: "",
  music_playing: false,
  music_volume: DEFAULT_MUSIC_VOLUME,

  video_youtube_url: "",
  video_video_id: "",
  video_playing: false,
  video_volume: DEFAULT_VIDEO_VOLUME,

  display_mode: DEFAULT_DISPLAY_MODE,

  updated_at: null,
});

/* =========================================================
   NORMALIZE FULL RECORD
========================================================= */

const normalizeRecord = (record = {}) => {
  const musicUrl = normalizeText(
    record.music_youtube_url ?? record.youtube_url,
  );

  const musicVideoId =
    extractYouTubeVideoId(musicUrl) ||
    normalizeText(record.music_video_id ?? record.video_id);

  const videoUrl = normalizeText(record.video_youtube_url);

  const videoVideoId =
    extractYouTubeVideoId(videoUrl) || normalizeText(record.video_video_id);

  const rawMode = normalizeText(record.display_mode).toLowerCase();

  const displayMode = ALLOWED_DISPLAY_MODES.includes(rawMode)
    ? rawMode
    : DEFAULT_DISPLAY_MODE;

  return {
    music_youtube_url: musicUrl,

    music_video_id: musicVideoId,

    music_playing: normalizeBoolean(record.music_playing ?? record.playing),

    music_volume: normalizeVolume(
      record.music_volume ?? record.volume,
      DEFAULT_MUSIC_VOLUME,
    ),

    video_youtube_url: videoUrl,

    video_video_id: videoVideoId,

    video_playing: normalizeBoolean(record.video_playing),

    video_volume: normalizeVolume(record.video_volume, DEFAULT_VIDEO_VOLUME),

    display_mode: displayMode,

    updated_at: normalizeText(record.updated_at) || null,
  };
};

/* =========================================================
   GET FULL SETTINGS RECORD
========================================================= */

async function getSettingsRecord() {
  const rows = await getSettingsRows();

  if (!rows.length) {
    return createDefaultRecord();
  }

  return normalizeRecord(rows[0]);
}

/* =========================================================
   SAVE FULL SETTINGS RECORD
========================================================= */

async function saveSettingsRecord(record) {
  const normalized = normalizeRecord({
    ...record,

    updated_at: new Date().toISOString(),
  });

  await writeSheet(SHEET_NAME, [normalized]);

  return normalized;
}

/* =========================================================
   MUSIC
========================================================= */

/* =========================================================
   GET DISPLAY MUSIC
========================================================= */

export async function getDisplayMusic() {
  const record = await getSettingsRecord();

  return {
    youtube_url: record.music_youtube_url,

    video_id: record.music_video_id,

    playing: record.music_playing,

    volume: record.music_volume,

    updated_at: record.updated_at,
  };
}

/* =========================================================
   UPDATE DISPLAY MUSIC
========================================================= */

export async function updateDisplayMusic({
  youtube_url,
  playing = true,
  volume = DEFAULT_MUSIC_VOLUME,
} = {}) {
  const normalizedUrl = normalizeText(youtube_url);

  if (!normalizedUrl) {
    throw appError("YouTube URL is required.", 400);
  }

  const videoId = extractYouTubeVideoId(normalizedUrl);

  if (!videoId) {
    throw appError("Invalid YouTube URL.", 400);
  }

  const record = await getSettingsRecord();

  record.music_youtube_url = normalizedUrl;

  record.music_video_id = videoId;

  record.music_playing = normalizeBoolean(playing);

  record.music_volume = normalizeVolume(volume, DEFAULT_MUSIC_VOLUME);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.music_youtube_url,

    video_id: saved.music_video_id,

    playing: saved.music_playing,

    volume: saved.music_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   UPDATE MUSIC PLAYING STATE
========================================================= */

export async function updatePlayingState(playing) {
  const record = await getSettingsRecord();

  record.music_playing = normalizeBoolean(playing);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.music_youtube_url,

    video_id: saved.music_video_id,

    playing: saved.music_playing,

    volume: saved.music_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   UPDATE MUSIC VOLUME
========================================================= */

export async function updateVolume(volume) {
  const parsedVolume = Number(volume);

  if (!Number.isFinite(parsedVolume)) {
    throw appError("Volume must be a valid number.", 400);
  }

  if (parsedVolume < 0 || parsedVolume > 100) {
    throw appError("Volume must be between 0 and 100.", 400);
  }

  const record = await getSettingsRecord();

  record.music_volume = normalizeVolume(parsedVolume, DEFAULT_MUSIC_VOLUME);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.music_youtube_url,

    video_id: saved.music_video_id,

    playing: saved.music_playing,

    volume: saved.music_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   VIDEO
========================================================= */

/* =========================================================
   GET DISPLAY VIDEO
========================================================= */

export async function getDisplayVideo() {
  const record = await getSettingsRecord();

  return {
    youtube_url: record.video_youtube_url,

    video_id: record.video_video_id,

    playing: record.video_playing,

    volume: record.video_volume,

    updated_at: record.updated_at,
  };
}

/* =========================================================
   UPDATE / CHANGE DISPLAY VIDEO
========================================================= */

export async function updateDisplayVideo({
  youtube_url,
  playing = true,
  volume = DEFAULT_VIDEO_VOLUME,
} = {}) {
  const normalizedUrl = normalizeText(youtube_url);

  if (!normalizedUrl) {
    throw appError("Video YouTube URL is required.", 400);
  }

  const videoId = extractYouTubeVideoId(normalizedUrl);

  if (!videoId) {
    throw appError("Invalid YouTube URL.", 400);
  }

  const record = await getSettingsRecord();

  record.video_youtube_url = normalizedUrl;

  record.video_video_id = videoId;

  record.video_playing = normalizeBoolean(playing);

  record.video_volume = normalizeVolume(volume, DEFAULT_VIDEO_VOLUME);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.video_youtube_url,

    video_id: saved.video_video_id,

    playing: saved.video_playing,

    volume: saved.video_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   UPDATE VIDEO PLAYING STATE
========================================================= */

export async function updateVideoPlayingState(playing) {
  const record = await getSettingsRecord();

  /*
   * Cannot play a video if no video
   * has been configured.
   */

  if (normalizeBoolean(playing) && !record.video_video_id) {
    throw appError("No display video is configured.", 400);
  }

  record.video_playing = normalizeBoolean(playing);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.video_youtube_url,

    video_id: saved.video_video_id,

    playing: saved.video_playing,

    volume: saved.video_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   UPDATE VIDEO VOLUME
========================================================= */

export async function updateVideoVolume(volume) {
  const parsedVolume = Number(volume);

  if (!Number.isFinite(parsedVolume)) {
    throw appError("Volume must be a valid number.", 400);
  }

  if (parsedVolume < 0 || parsedVolume > 100) {
    throw appError("Volume must be between 0 and 100.", 400);
  }

  const record = await getSettingsRecord();

  record.video_volume = normalizeVolume(parsedVolume, DEFAULT_VIDEO_VOLUME);

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.video_youtube_url,

    video_id: saved.video_video_id,

    playing: saved.video_playing,

    volume: saved.video_volume,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   REMOVE DISPLAY VIDEO
========================================================= */

export async function removeDisplayVideo() {
  const record = await getSettingsRecord();

  record.video_youtube_url = "";
  record.video_video_id = "";
  record.video_playing = false;

  /*
   * If video is removed while the
   * display is in video mode,
   * automatically return to queue.
   */

  if (record.display_mode === "video") {
    record.display_mode = "queue";
  }

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.video_youtube_url,

    video_id: saved.video_video_id,

    playing: saved.video_playing,

    volume: saved.video_volume,

    display_mode: saved.display_mode,

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   DISPLAY MODE
========================================================= */

/* =========================================================
   GET DISPLAY MODE
========================================================= */

export async function getDisplayMode() {
  const record = await getSettingsRecord();

  return {
    mode: record.display_mode,

    video_playing: record.video_playing,

    updated_at: record.updated_at,
  };
}

/* =========================================================
   UPDATE DISPLAY MODE
========================================================= */

export async function updateDisplayMode(mode) {
  const normalizedMode = normalizeText(mode).toLowerCase();

  if (!ALLOWED_DISPLAY_MODES.includes(normalizedMode)) {
    throw appError("Display mode must be queue or video.", 400);
  }

  const record = await getSettingsRecord();

  /*
   * IMPORTANT:
   *
   * When the user switches from
   * video -> queue,
   * pause the video automatically.
   */

  if (normalizedMode === "queue") {
    record.video_playing = false;
  }

  /*
   * Do not allow switching to
   * video mode if there is no
   * configured video.
   */

  if (normalizedMode === "video" && !record.video_video_id) {
    throw appError("No display video is configured.", 400);
  }

  record.display_mode = normalizedMode;

  const saved = await saveSettingsRecord(record);

  return {
    mode: saved.display_mode,

    video: {
      youtube_url: saved.video_youtube_url,

      video_id: saved.video_video_id,

      playing: saved.video_playing,

      volume: saved.video_volume,
    },

    updated_at: saved.updated_at,
  };
}

/* =========================================================
   RESET DISPLAY MUSIC
========================================================= */

export async function resetDisplayMusic() {
  const record = await getSettingsRecord();

  record.music_youtube_url = "";
  record.music_video_id = "";
  record.music_playing = false;

  const saved = await saveSettingsRecord(record);

  return {
    youtube_url: saved.music_youtube_url,

    video_id: saved.music_video_id,

    playing: saved.music_playing,

    volume: saved.music_volume,

    updated_at: saved.updated_at,
  };
}
