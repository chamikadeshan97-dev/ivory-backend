import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import appError from "../utils/appError.js";

/* =========================================================
   CONFIG
========================================================= */

const SHEET_NAME = "DisplayMusic";

const DEFAULT_VOLUME = 20;

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

const normalizeVolume = (
  value,
  fallback = DEFAULT_VOLUME,
) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    100,
    Math.max(
      0,
      Math.round(parsed),
    ),
  );
};

/* =========================================================
   EXTRACT YOUTUBE VIDEO ID
========================================================= */

const extractYouTubeVideoId = (url) => {
  const normalizedUrl =
    normalizeText(url);

  if (!normalizedUrl) {
    return "";
  }

  try {
    const parsedUrl =
      new URL(normalizedUrl);

    const hostname =
      parsedUrl.hostname
        .replace(/^www\./, "")
        .toLowerCase();

    /* ===============================================
       youtu.be/VIDEO_ID
    =============================================== */

    if (hostname === "youtu.be") {
      const videoId =
        parsedUrl.pathname
          .split("/")
          .filter(Boolean)[0];

      return normalizeText(videoId);
    }

    /* ===============================================
       Validate YouTube hostname
    =============================================== */

    const isYouTubeHost =
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com");

    if (!isYouTubeHost) {
      return "";
    }

    /* ===============================================
       youtube.com/watch?v=VIDEO_ID
    =============================================== */

    const queryVideoId =
      parsedUrl.searchParams.get("v");

    if (queryVideoId) {
      return normalizeText(
        queryVideoId,
      );
    }

    const parts =
      parsedUrl.pathname
        .split("/")
        .filter(Boolean);

    /* ===============================================
       /embed/VIDEO_ID
    =============================================== */

    const embedIndex =
      parts.indexOf("embed");

    if (
      embedIndex !== -1 &&
      parts[embedIndex + 1]
    ) {
      return normalizeText(
        parts[embedIndex + 1],
      );
    }

    /* ===============================================
       /shorts/VIDEO_ID
    =============================================== */

    const shortsIndex =
      parts.indexOf("shorts");

    if (
      shortsIndex !== -1 &&
      parts[shortsIndex + 1]
    ) {
      return normalizeText(
        parts[shortsIndex + 1],
      );
    }

    /* ===============================================
       /live/VIDEO_ID
    =============================================== */

    const liveIndex =
      parts.indexOf("live");

    if (
      liveIndex !== -1 &&
      parts[liveIndex + 1]
    ) {
      return normalizeText(
        parts[liveIndex + 1],
      );
    }

    return "";
  } catch {
    return "";
  }
};

/* =========================================================
   NORMALIZE MUSIC RECORD
========================================================= */

const normalizeMusicRecord = (
  record = {},
) => {
  const youtubeUrl =
    normalizeText(
      record.youtube_url,
    );

  /*
   * Prefer extracting the ID from the URL.
   *
   * If the URL is empty or cannot be parsed,
   * fall back to the stored video_id.
   */

  const extractedVideoId =
    extractYouTubeVideoId(
      youtubeUrl,
    );

  const videoId =
    extractedVideoId ||
    normalizeText(
      record.video_id,
    );

  return {
    youtube_url:
      youtubeUrl,

    video_id:
      videoId,

    playing:
      normalizeBoolean(
        record.playing,
      ),

    volume:
      normalizeVolume(
        record.volume,
      ),

    updated_at:
      normalizeText(
        record.updated_at,
      ) || null,
  };
};

/* =========================================================
   GET MUSIC ROWS
========================================================= */

async function getMusicRows() {
  const rows =
    await readSheet(
      SHEET_NAME,
    );

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.filter(
    (row) =>
      row &&
      typeof row === "object",
  );
}

/* =========================================================
   GET DISPLAY MUSIC
========================================================= */

export async function getDisplayMusic() {
  const rows =
    await getMusicRows();

  /*
   * DisplayMusic only needs one settings record.
   */

  if (!rows.length) {
    return {
      youtube_url: "",
      video_id: "",
      playing: false,
      volume:
        DEFAULT_VOLUME,
      updated_at: null,
    };
  }

  return normalizeMusicRecord(
    rows[0],
  );
}

/* =========================================================
   UPDATE / CHANGE DISPLAY MUSIC
========================================================= */

export async function updateDisplayMusic(
  {
    youtube_url,
    playing = true,
    volume = DEFAULT_VOLUME,
  } = {},
) {
  const normalizedUrl =
    normalizeText(
      youtube_url,
    );

  if (!normalizedUrl) {
    throw appError(
      "YouTube URL is required.",
      400,
    );
  }

  const videoId =
    extractYouTubeVideoId(
      normalizedUrl,
    );

  if (!videoId) {
    throw appError(
      "Invalid YouTube URL.",
      400,
    );
  }

  const safeVolume =
    normalizeVolume(
      volume,
    );

  const timestamp =
    new Date().toISOString();

  const rows =
    await getMusicRows();

  const existing =
    rows[0] || {};

  const record = {
    ...existing,

    youtube_url:
      normalizedUrl,

    video_id:
      videoId,

    playing:
      normalizeBoolean(
        playing,
      ),

    volume:
      safeVolume,

    updated_at:
      timestamp,
  };

  /*
   * Keep only one configuration row.
   */

  await writeSheet(
    SHEET_NAME,
    [record],
  );

  return normalizeMusicRecord(
    record,
  );
}

/* =========================================================
   UPDATE PLAYING STATE
========================================================= */

export async function updatePlayingState(
  playing,
) {
  const rows =
    await getMusicRows();

  /*
   * If DisplayMusic sheet has no row yet,
   * create the default configuration row.
   */

  const existing =
    rows[0] || {
      youtube_url: "",
      video_id: "",
      volume:
        DEFAULT_VOLUME,
    };

  const record = {
    ...existing,

    playing:
      normalizeBoolean(
        playing,
      ),

    volume:
      normalizeVolume(
        existing.volume,
      ),

    updated_at:
      new Date().toISOString(),
  };

  await writeSheet(
    SHEET_NAME,
    [record],
  );

  return normalizeMusicRecord(
    record,
  );
}

/* =========================================================
   UPDATE VOLUME
========================================================= */

export async function updateVolume(
  volume,
) {
  if (
    volume === undefined ||
    volume === null ||
    volume === ""
  ) {
    throw appError(
      "Volume is required.",
      400,
    );
  }

  const parsedVolume =
    Number(volume);

  if (
    !Number.isFinite(
      parsedVolume,
    )
  ) {
    throw appError(
      "Volume must be a valid number.",
      400,
    );
  }

  if (
    parsedVolume < 0 ||
    parsedVolume > 100
  ) {
    throw appError(
      "Volume must be between 0 and 100.",
      400,
    );
  }

  const safeVolume =
    normalizeVolume(
      parsedVolume,
    );

  const rows =
    await getMusicRows();

  const existing =
    rows[0] || {
      youtube_url: "",
      video_id: "",
      playing: false,
    };

  const record = {
    ...existing,

    volume:
      safeVolume,

    playing:
      normalizeBoolean(
        existing.playing,
      ),

    updated_at:
      new Date().toISOString(),
  };

  await writeSheet(
    SHEET_NAME,
    [record],
  );

  return normalizeMusicRecord(
    record,
  );
}

/* =========================================================
   OPTIONAL HELPER
   RESET DISPLAY MUSIC
========================================================= */

export async function resetDisplayMusic() {
  const record = {
    youtube_url: "",
    video_id: "",
    playing: false,
    volume:
      DEFAULT_VOLUME,
    updated_at:
      new Date().toISOString(),
  };

  await writeSheet(
    SHEET_NAME,
    [record],
  );

  return record;
}