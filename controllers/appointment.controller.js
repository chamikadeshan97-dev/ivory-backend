import * as appointmentService from "../services/appointment.service.js";
import sendError from "../utils/sendError.js";

/* --------------------------------------------------------
   Create appointment
-------------------------------------------------------- */

async function createAppointment(req, res) {
  try {
    const appointment =
      await appointmentService.createAppointment(req.body);

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      data: appointment,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to book appointment",
    );
  }
}

/* --------------------------------------------------------
   Get appointments
-------------------------------------------------------- */

async function getAppointments(req, res) {
  try {
    const appointments =
      await appointmentService.getAppointments(
        req.query.date,
      );

    return res.status(200).json({
      success: true,
      data: appointments,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch appointments",
    );
  }
}

/* --------------------------------------------------------
   Get appointment by ID
-------------------------------------------------------- */

async function getAppointmentById(req, res) {
  try {
    const appointment =
      await appointmentService.getAppointmentById(
        req.params.id,
      );

    return res.status(200).json({
      success: true,
      data: appointment,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to fetch appointment",
    );
  }
}

/* --------------------------------------------------------
   Update appointment status
-------------------------------------------------------- */

async function updateAppointmentStatusController(
  req,
  res,
  next,
) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updatedAppointment =
      await appointmentService.updateAppointmentStatus(
        id,
        status,
      );

    return res.status(200).json({
      success: true,
      message:
        "Appointment status updated successfully",
      data: updatedAppointment,
    });
  } catch (error) {
    return next(error);
  }
}

/* --------------------------------------------------------
   Update appointment
-------------------------------------------------------- */

async function updateAppointment(req, res) {
  try {
    const { id } = req.params;

    const appointment =
      await appointmentService.updateAppointment(
        id,
        req.body,
      );

    return res.status(200).json({
      success: true,
      message: "Appointment updated successfully",
      data: appointment,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to update appointment",
    );
  }
}

/* --------------------------------------------------------
   Date validation helpers
-------------------------------------------------------- */

const isValidDate = (value) => {
  const dateValue = String(
    value || "",
  ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateValue,
    )
  ) {
    return false;
  }

  const [year, month, day] =
    dateValue
      .split("-")
      .map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
    ),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const getDateRange = (req) => {
  const startDate = String(
    req.query.start_date || "",
  ).trim();

  const endDate = String(
    req.query.end_date || "",
  ).trim();

  if (!startDate || !endDate) {
    return {
      error:
        "start_date and end_date are required",
    };
  }

  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate)
  ) {
    return {
      error:
        "Dates must use YYYY-MM-DD format",
    };
  }

  if (startDate > endDate) {
    return {
      error:
        "start_date cannot be after end_date",
    };
  }

  return {
    startDate,
    endDate,
  };
};

/* --------------------------------------------------------
   Get appointments by date range
-------------------------------------------------------- */

async function getAppointmentsByDateRange(
  req,
  res,
) {
  try {
    const {
      startDate,
      endDate,
      error,
    } = getDateRange(req);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error,
      });
    }

    const appointments =
      await appointmentService
        .getAppointmentsByDateRange(
          startDate,
          endDate,
        );

    return res.status(200).json({
      success: true,
      data: appointments,
      total: appointments.length,

      date_range: {
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    console.error(
      "Get appointment range error:",
      error,
    );

    return sendError(
      res,
      error,
      "Failed to get appointments for the date range",
    );
  }
}

/* --------------------------------------------------------
   Get full appointment details
-------------------------------------------------------- */

async function getAppointmentFullDetails(
  req,
  res,
) {
  try {
    const { appointmentId } =
      req.params;

    const data =
      await appointmentService
        .getAppointmentFullDetailsService(
          appointmentId,
        );

    return res.status(200).json({
      success: true,
      message:
        "Appointment details retrieved successfully",
      data,
    });
  } catch (error) {
    console.error(
      "Get appointment full details error:",
      error,
    );

    return sendError(
      res,
      error,
      "Failed to retrieve appointment details",
    );
  }
}

/* --------------------------------------------------------
   Get appointment by treatment ID
-------------------------------------------------------- */

async function getAppointmentByTreatmentId(
  req,
  res,
) {
  try {
    const { treatmentId } =
      req.params;

    const result =
      await appointmentService
        .getAppointmentByTreatmentId({
          treatmentId,
        });

    if (result.type === "single") {
      return res.status(200).json({
        success: true,
        data: result.data,
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data,
      total: result.total,
    });
  } catch (error) {
    console.error(
      "Get appointment by treatment error:",
      error,
    );

    return sendError(
      res,
      error,
      "Failed to retrieve appointment",
    );
  }
}

export {
  updateAppointmentStatusController,
};

export default {
  createAppointment,
  getAppointments,
  getAppointmentByTreatmentId,
  getAppointmentById,
  getAppointmentsByDateRange,
  getAppointmentFullDetails,
  updateAppointmentStatusController,
  updateAppointment,
};