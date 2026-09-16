import {
  createPatientMediaRecords,
  getPatientMediaByAppointmentId,
  getPatientMediaById,
  getPatientMediaByPatientId,
  getPatientMediaByTreatmentId,
  getPatientMediaFileStream,
  permanentlyDeletePatientMedia,
  softDeletePatientMedia,
} from "../services/patientMedia.service.js";

/* ========================================================
   HELPERS
======================================================== */

const getLoggedUserId = (req) => {
  return (
    req.user?.id ||
    req.user?.user_id ||
    req.user?.username ||
    req.user?.email ||
    ""
  );
};

const buildClientMedia = (
  req,
  media,
) => {
  const baseUrl = `${req.protocol}://${req.get(
    "host",
  )}`;

  return {
    ...media,

    view_url: `${baseUrl}/api/patient-media/${media.media_id}/view`,

    download_url: `${baseUrl}/api/patient-media/${media.media_id}/download`,
  };
};

/* ========================================================
   UPLOAD
======================================================== */

export const uploadPatientMedia =
  async (req, res) => {
    try {
      const {
        patient_id,
        appointment_id,
        treatment_id,
        media_type,
        category,
        tooth_number,
        description,
      } = req.body;

      if (!patient_id) {
        return res.status(400).json({
          success: false,

          message:
            "patient_id is required",
        });
      }

      if (!media_type) {
        return res.status(400).json({
          success: false,

          message:
            "media_type is required",
        });
      }

      if (
        !req.files ||
        req.files.length === 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "At least one clinical file is required",
        });
      }

      const records =
        await createPatientMediaRecords({
          files: req.files,

          patientId: patient_id,

          appointmentId:
            appointment_id,

          treatmentId:
            treatment_id,

          mediaType: media_type,

          category,

          toothNumber:
            tooth_number,

          description,

          uploadedBy:
            getLoggedUserId(req),
        });

      return res.status(201).json({
        success: true,

        message:
          records.length === 1
            ? "Clinical media uploaded successfully"
            : `${records.length} clinical files uploaded successfully`,

        data: records.map((record) =>
          buildClientMedia(
            req,
            record,
          ),
        ),
      });
    } catch (error) {
      console.error(
        "uploadPatientMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to upload clinical media",
      });
    }
  };

/* ========================================================
   GET PATIENT MEDIA
======================================================== */

export const getPatientMedia =
  async (req, res) => {
    try {
      const {
        patientId,
      } = req.params;

      const records =
        await getPatientMediaByPatientId(
          patientId,
        );

      return res.json({
        success: true,

        count: records.length,

        data: records.map((record) =>
          buildClientMedia(
            req,
            record,
          ),
        ),
      });
    } catch (error) {
      console.error(
        "getPatientMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to load patient media",
      });
    }
  };

/* ========================================================
   GET APPOINTMENT MEDIA
======================================================== */

export const getAppointmentMedia =
  async (req, res) => {
    try {
      const {
        appointmentId,
      } = req.params;

      const records =
        await getPatientMediaByAppointmentId(
          appointmentId,
        );

      return res.json({
        success: true,

        count: records.length,

        data: records.map((record) =>
          buildClientMedia(
            req,
            record,
          ),
        ),
      });
    } catch (error) {
      console.error(
        "getAppointmentMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to load appointment media",
      });
    }
  };

/* ========================================================
   GET TREATMENT MEDIA
======================================================== */

export const getTreatmentMedia =
  async (req, res) => {
    try {
      const {
        treatmentId,
      } = req.params;

      const records =
        await getPatientMediaByTreatmentId(
          treatmentId,
        );

      return res.json({
        success: true,

        count: records.length,

        data: records.map((record) =>
          buildClientMedia(
            req,
            record,
          ),
        ),
      });
    } catch (error) {
      console.error(
        "getTreatmentMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to load treatment media",
      });
    }
  };

/* ========================================================
   GET ONE MEDIA RECORD
======================================================== */

export const getMediaById =
  async (req, res) => {
    try {
      const {
        mediaId,
      } = req.params;

      const record =
        await getPatientMediaById(
          mediaId,
        );

      if (
        !record ||
        String(
          record.is_deleted,
        ).toLowerCase() === "true"
      ) {
        return res.status(404).json({
          success: false,

          message:
            "Clinical media not found",
        });
      }

      return res.json({
        success: true,

        data: buildClientMedia(
          req,
          record,
        ),
      });
    } catch (error) {
      console.error(
        "getMediaById error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to load clinical media",
      });
    }
  };

/* ========================================================
   VIEW FILE
======================================================== */

export const viewPatientMedia =
  async (req, res) => {
    try {
      const {
        mediaId,
      } = req.params;

      const result =
        await getPatientMediaFileStream(
          mediaId,
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          message:
            "Clinical media not found",
        });
      }

      const {
        media,
        metadata,
        stream,
      } = result;

      const mimeType =
        metadata?.mimeType ||
        media.mime_type ||
        "application/octet-stream";

      res.setHeader(
        "Content-Type",
        mimeType,
      );

      /*
       * Inline means browser displays
       * image/PDF instead of forcing download.
       */
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(
          media.file_name ||
            metadata?.name ||
            "clinical-media",
        )}"`,
      );

      /*
       * Since these are patient records,
       * avoid browser/proxy caching.
       */
      res.setHeader(
        "Cache-Control",
        "private, no-store, max-age=0",
      );

      stream.on(
        "error",
        (error) => {
          console.error(
            "Drive stream error:",
            error,
          );

          if (!res.headersSent) {
            res
              .status(500)
              .end();
          }
        },
      );

      stream.pipe(res);
    } catch (error) {
      console.error(
        "viewPatientMedia error:",
        error,
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,

          message:
            error.message ||
            "Failed to view clinical media",
        });
      }
    }
  };

/* ========================================================
   DOWNLOAD FILE
======================================================== */

export const downloadPatientMedia =
  async (req, res) => {
    try {
      const {
        mediaId,
      } = req.params;

      const result =
        await getPatientMediaFileStream(
          mediaId,
        );

      if (!result) {
        return res.status(404).json({
          success: false,

          message:
            "Clinical media not found",
        });
      }

      const {
        media,
        metadata,
        stream,
      } = result;

      const mimeType =
        metadata?.mimeType ||
        media.mime_type ||
        "application/octet-stream";

      const fileName =
        media.file_name ||
        metadata?.name ||
        "clinical-media";

      res.setHeader(
        "Content-Type",
        mimeType,
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(
          fileName,
        )}"`,
      );

      res.setHeader(
        "Cache-Control",
        "private, no-store, max-age=0",
      );

      stream.pipe(res);
    } catch (error) {
      console.error(
        "downloadPatientMedia error:",
        error,
      );

      if (!res.headersSent) {
        return res.status(500).json({
          success: false,

          message:
            error.message ||
            "Failed to download clinical media",
        });
      }
    }
  };

/* ========================================================
   SOFT DELETE
======================================================== */

export const deletePatientMedia =
  async (req, res) => {
    try {
      const {
        mediaId,
      } = req.params;

      const deleted =
        await softDeletePatientMedia(
          mediaId,
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,

          message:
            "Clinical media not found",
        });
      }

      return res.json({
        success: true,

        message:
          "Clinical media removed successfully",
      });
    } catch (error) {
      console.error(
        "deletePatientMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to remove clinical media",
      });
    }
  };

/* ========================================================
   PERMANENT DELETE
======================================================== */

export const hardDeletePatientMedia =
  async (req, res) => {
    try {
      const {
        mediaId,
      } = req.params;

      const deleted =
        await permanentlyDeletePatientMedia(
          mediaId,
        );

      if (!deleted) {
        return res.status(404).json({
          success: false,

          message:
            "Clinical media not found",
        });
      }

      return res.json({
        success: true,

        message:
          "Clinical media permanently deleted",
      });
    } catch (error) {
      console.error(
        "hardDeletePatientMedia error:",
        error,
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to permanently delete clinical media",
      });
    }
  };