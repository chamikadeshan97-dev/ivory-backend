import * as dentistService from "../services/dentist.service.js";
import sendError from "../utils/sendError.js";

async function getDoctorArrivalStatus   (req, res)  {
  try {
    const { date } = req.params;
console.log(req.params);
console.log(date);
console.log(req.params);
console.log(req.params);
console.log(date);

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const result = await dentistService.getDoctorArrivalStatus(date);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Failed to get doctor arrival status:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message || "Failed to get doctor arrival status",
    });
  }
};
async function markDoctorArrived   (req, res)  {
  try {
    const { date, send_sms = true } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    const result = await dentistService.markDoctorArrived({
      date,
      sendSms: send_sms,
    });

    return res.status(200).json({
      success: true,
      message: "Doctor arrival recorded successfully",
      data: result,
    });
  } catch (error) {
    console.error("Failed to mark doctor arrival:", error);

    return res.status(500).json({
      success: false,
      message:
        error?.message || "Failed to mark doctor arrival",
    });
  }
};

const dentistController = {
  createDentist,
  getAllDentists,
  searchDentists,
  getDentistStatistics,
  getDentistById,
  updateDentist,
  deleteDentist,

  // NEW
  getDoctorArrivalStatus,
  markDoctorArrived,
};


/* --------------------------------------------------------
   Create dentist
-------------------------------------------------------- */

async function createDentist(req, res) {
  try {
    const dentist =
      await dentistService.createDentist(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message: "Dentist added successfully",
      data: dentist,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to add dentist",
    );
  }
}

/* --------------------------------------------------------
   Get all dentists
-------------------------------------------------------- */

async function getAllDentists(req, res) {
  try {
    const dentists =
      await dentistService.getAllDentists();

    return res.status(200).json({
      success: true,
      data: dentists,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch dentists",
    );
  }
}

/* --------------------------------------------------------
   Search dentists
-------------------------------------------------------- */

async function searchDentists(req, res) {
  try {
    const dentists =
      await dentistService.searchDentists(
        req.query.q,
      );

    return res.status(200).json({
      success: true,
      data: dentists,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Dentist search failed",
    );
  }
}

/* --------------------------------------------------------
   Get dentist by ID
-------------------------------------------------------- */

async function getDentistById(req, res) {
  try {
    const dentist =
      await dentistService.getDentistById(
        req.params.id,
      );

    return res.status(200).json({
      success: true,
      data: dentist,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch dentist",
    );
  }
}

/* --------------------------------------------------------
   Update dentist
-------------------------------------------------------- */

async function updateDentist(req, res) {
  try {
    const dentist =
      await dentistService.updateDentist(
        req.params.id,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message: "Dentist updated successfully",
      data: dentist,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update dentist",
    );
  }
}

/* --------------------------------------------------------
   Delete dentist
-------------------------------------------------------- */

async function deleteDentist(req, res) {
  try {
    const deletedDentist =
      await dentistService.deleteDentist(
        req.params.id,
      );

    return res.status(200).json({
      success: true,
      message: "Dentist deleted successfully",
      data: deletedDentist,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to delete dentist",
    );
  }
}

/* --------------------------------------------------------
   Dentist statistics
-------------------------------------------------------- */

async function getDentistStatistics(req, res) {
  try {
    const statistics =
      await dentistService.getDentistStatistics();

    return res.status(200).json({
      success: true,
      data: statistics,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch dentist statistics",
    );
  }
}

/* --------------------------------------------------------
   Default export
-------------------------------------------------------- */

export default {
  createDentist,
  getAllDentists,
  searchDentists,
  getDentistById,
  updateDentist,
  deleteDentist,
  getDentistStatistics,getDoctorArrivalStatus,markDoctorArrived
};
