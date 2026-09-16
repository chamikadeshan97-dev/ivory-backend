export const MEDIA_TYPES = {
  XRAY: "X-Ray",
  TREATMENT_PHOTO: "Treatment Photo",
  CLINICAL_PHOTO: "Clinical Photo",
  DOCUMENT: "Document",
  OTHER: "Other",
};

export const MEDIA_FOLDER_MAP = {
  "X-Ray": "X-Rays",

  "Treatment Photo": "Treatment Photos",

  "Clinical Photo": "Clinical Photos",

  Document: "Documents",

  Other: "Other",
};

export const XRAY_CATEGORIES = [
  "IOPA",
  "OPG",
  "Bitewing",
  "Occlusal",
  "Cephalometric",
  "CBCT",
  "Other",
];

export const TREATMENT_PHOTO_CATEGORIES = [
  "Before",
  "During",
  "After",
];

export const getMediaFolder = (mediaType) => {
  return MEDIA_FOLDER_MAP[mediaType] || "Other";
};