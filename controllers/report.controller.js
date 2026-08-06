import * as reportService from "../services/report.service.js";

import sendError from "../utils/sendError.js";

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

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
    date.getUTCMonth() ===
      month - 1 &&
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

/*
|--------------------------------------------------------------------------
| Get Daily Appointments
|--------------------------------------------------------------------------
|
| GET /api/reports/daily-appointments?date=YYYY-MM-DD
|
*/

async function getDailyAppointments(
  req,
  res,
) {
  try {
    const report =
      await reportService.getDailyAppointments(
        req.query.date,
      );

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to generate daily appointment report",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Get Daily Income
|--------------------------------------------------------------------------
|
| GET /api/reports/daily-income?date=YYYY-MM-DD
|
*/

async function getDailyIncome(
  req,
  res,
) {
  try {
    const report =
      await reportService.getDailyIncome(
        req.query.date,
      );

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to generate daily income report",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Get Daily Next Appointments
|--------------------------------------------------------------------------
|
| GET /api/reports/daily-next-appointments?date=YYYY-MM-DD
|
*/

async function getDailyNextAppointments(
  req,
  res,
) {
  try {
    const report =
      await reportService.getDailyNextAppointments(
        req.query.date,
      );

    return res.status(200).json({
      success: true,
      ...report,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to generate daily next appointment report",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Get Income by Date Range
|--------------------------------------------------------------------------
|
| GET /api/reports/income-range
|     ?start_date=YYYY-MM-DD
|     &end_date=YYYY-MM-DD
|
*/

export async function getIncomeByDateRange(
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

    const result =
      await reportService.getIncomeByDateRange(
        startDate,
        endDate,
      );

    return res.status(200).json({
      success: true,
      data:
        result?.payments || [],
      summary:
        result?.summary || {},
      daily_summary:
        result?.dailySummary || [],
      date_range: {
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    console.error(
      "Get income range error:",
      error,
    );

    return res
      .status(
        error.statusCode || 500,
      )
      .json({
        success: false,
        message:
          error.message ||
          "Failed to get income report for the date range",
      });
  }
}

/*
|--------------------------------------------------------------------------
| Get Appointments and Treatments by Date Range
|--------------------------------------------------------------------------
|
| GET /api/reports/appointments-treatments-range
|     ?start_date=YYYY-MM-DD
|     &end_date=YYYY-MM-DD
|
*/

export async function getAppointmentsTreatmentsRange(
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

    const result =
      await reportService.getAppointmentsTreatmentsByDateRange(
        startDate,
        endDate,
      );

    return res.status(200).json({
      success: true,
      ...result,
      date_range: {
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    console.error(
      "Date range report error:",
      error,
    );

    return res
      .status(
        error.statusCode || 500,
      )
      .json({
        success: false,
        message:
          error.message ||
          "Failed to retrieve appointments and treatments",
      });
  }
}

/*
|--------------------------------------------------------------------------
| Export Controller
|--------------------------------------------------------------------------
*/

export default {
  getDailyAppointments,
  getDailyIncome,
  getIncomeByDateRange,
  getDailyNextAppointments,
  getAppointmentsTreatmentsRange,
};