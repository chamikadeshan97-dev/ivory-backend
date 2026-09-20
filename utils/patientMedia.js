/* ========================================================
   NORMAL PATIENT MEDIA TYPES
======================================================== */

export const MEDIA_TYPES = {
  XRAY: "X-Ray",
  TREATMENT_PHOTO: "Treatment Photo",
  CLINICAL_PHOTO: "Clinical Photo",
  DOCUMENT: "Document",
  OTHER: "Other",
};

/* ========================================================
   NORMAL PATIENT MEDIA FOLDERS
======================================================== */

export const MEDIA_FOLDER_MAP = {
  "X-Ray": "X-Rays",

  "Treatment Photo": "Treatment Photos",

  "Clinical Photo": "Clinical Photos",

  Document: "Documents",

  Other: "Other",
};

/* ========================================================
   ORTHO MEDIA TYPES
======================================================== */

export const ORTHO_MEDIA_TYPES = {
  XRAY: "X-Ray",

  CLINICAL_PHOTO: "Clinical Photo",

  DOCUMENT: "Document",

  SCAN: "Scan",

  OTHER: "Other",
};

/* ========================================================
   ORTHO DRIVE FOLDERS
======================================================== */

/*
 * These folders will be created inside the
 * existing patient folder in Google Drive.
 *
 * Example:
 *
 * PAT_0001
 * ├── Clinical Photos
 * ├── X-Rays
 * ├── Documents
 * ├── Ortho - Clinical Photos
 * ├── Ortho - X-Rays
 * ├── Ortho - Documents
 * ├── Ortho - Scans
 * └── Ortho - Other
 */

export const ORTHO_MEDIA_FOLDER_MAP = {
  "Clinical Photo": "Ortho - Clinical Photos",

  "X-Ray": "Ortho - X-Rays",

  Document: "Ortho - Documents",

  Scan: "Ortho - Scans",

  Other: "Ortho - Other",
};

/* ========================================================
   X-RAY CATEGORIES
======================================================== */

export const XRAY_CATEGORIES = [
  "IOPA",
  "OPG",
  "Bitewing",
  "Occlusal",
  "Cephalometric",
  "CBCT",
  "Other",
];

/* ========================================================
   TREATMENT PHOTO CATEGORIES
======================================================== */

export const TREATMENT_PHOTO_CATEGORIES = ["Before", "During", "After"];

/* ========================================================
   ORTHO PHOTO CATEGORIES
======================================================== */

export const ORTHO_PHOTO_CATEGORIES = [
  "Front View",
  "Right Side",
  "Left Side",
  "Upper Occlusal",
  "Lower Occlusal",
  "Smile",
  "Profile",
  "Other",
];

/* ========================================================
   ORTHO STAGES
======================================================== */

export const ORTHO_TREATMENT_STAGES = [
  "Before Treatment",
  "During Treatment",
  "After Treatment",
  "Retainer Stage",
];

/* ========================================================
   NORMAL PATIENT FOLDER
======================================================== */

export const getMediaFolder = (mediaType) => {
  return MEDIA_FOLDER_MAP[mediaType] || "Other";
};

/* ========================================================
   ORTHO MEDIA FOLDER
======================================================== */

export const getOrthoMediaFolder = (mediaType) => {
  return ORTHO_MEDIA_FOLDER_MAP[mediaType] || "Ortho - Other";
};
