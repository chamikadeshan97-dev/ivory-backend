import appError from "../utils/appError.js";

import {
  readSheet,
} from "../utils/googleSheets.js";

/*
|--------------------------------------------------------------------------
| Sheet Names
|--------------------------------------------------------------------------
*/

const PATIENTS_SHEET = "Patients";
const DENTISTS_SHEET = "Dentists";
const APPOINTMENTS_SHEET = "Appointments";
const TREATMENTS_SHEET = "Treatments";
const PAYMENTS_SHEET = "Payments";

/*
|--------------------------------------------------------------------------
| General Helpers
|--------------------------------------------------------------------------
*/

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeId = (value) => {
  return normalizeText(value).toLowerCase();
};

const ensureArray = (value) => {
  return Array.isArray(value)
    ? value
    : [];
};

const convertToNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const cleanedValue = String(value)
    .replace(/[^0-9.-]/g, "");

  const numberValue = Number(
    cleanedValue,
  );

  return Number.isFinite(numberValue)
    ? numberValue
    : 0;
};

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }

  const stringValue =
    normalizeText(value);

  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      stringValue,
    )
  ) {
    return stringValue;
  }

  const date = new Date(
    stringValue,
  );

  if (
    Number.isNaN(date.getTime())
  ) {
    return null;
  }

  return date
    .toISOString()
    .split("T")[0];
};

const validateRequiredDate = (
  date,
  exampleDate,
) => {
  const normalizedDate =
    normalizeDate(date);

  if (!date) {
    throw appError(
      `Date is required. Example: ?date=${exampleDate}`,
      400,
    );
  }

  if (!normalizedDate) {
    throw appError(
      "Invalid date format. Use YYYY-MM-DD.",
      400,
    );
  }

  return normalizedDate;
};

const isDateWithinRange = (
  dateValue,
  startDate,
  endDate,
) => {
  const normalizedDate =
    normalizeDate(dateValue);

  if (!normalizedDate) {
    return false;
  }

  return (
    normalizedDate >= startDate &&
    normalizedDate <= endDate
  );
};

const filterByDateRange = (
  records,
  dateField,
  startDate,
  endDate,
) => {
  return ensureArray(records).filter(
    (record) => {
      const recordDate =
        normalizeDate(
          record?.[dateField],
        );

      return (
        recordDate &&
        recordDate >= startDate &&
        recordDate <= endDate
      );
    },
  );
};

const getTreatmentCharge = (
  treatment,
  payment = null,
) => {
  return convertToNumber(
    payment?.treatment_charge ??
      treatment?.treatment_fee ??
      treatment?.treatment_charge ??
      treatment?.fee ??
      0,
  );
};

const getPaymentAmount = (
  payment,
) => {
  return convertToNumber(
    payment?.payment_amount ??
      payment?.amount ??
      0,
  );
};

/*
|--------------------------------------------------------------------------
| Get Daily Appointments
|--------------------------------------------------------------------------
*/

export async function getDailyAppointments(
  date,
) {
  const reportDate =
    validateRequiredDate(
      date,
      "2026-06-26",
    );

  const [
    patientRows,
    dentistRows,
    appointmentRows,
  ] = await Promise.all([
    readSheet(PATIENTS_SHEET),
    readSheet(DENTISTS_SHEET),
    readSheet(APPOINTMENTS_SHEET),
  ]);

  const patients =
    ensureArray(patientRows);

  const dentists =
    ensureArray(dentistRows);

  const appointments =
    ensureArray(appointmentRows);

  const patientMap = new Map(
    patients.map((patient) => [
      normalizeId(patient?.id),
      patient,
    ]),
  );

  const dentistMap = new Map(
    dentists.map((dentist) => [
      normalizeId(dentist?.id),
      dentist,
    ]),
  );

  const dailyAppointments =
    appointments
      .filter((appointment) => {
        return (
          normalizeDate(
            appointment
              ?.appointment_date,
          ) === reportDate
        );
      })
      .sort((first, second) => {
        return normalizeText(
          first?.appointment_time,
        ).localeCompare(
          normalizeText(
            second?.appointment_time,
          ),
        );
      })
      .map(
        (
          appointment,
          index,
        ) => {
          const patient =
            patientMap.get(
              normalizeId(
                appointment
                  ?.patient_id,
              ),
            );

          const dentist =
            dentistMap.get(
              normalizeId(
                appointment
                  ?.dentist_id,
              ),
            );

          return {
            queue_no: index + 1,

            appointment_id:
              normalizeText(
                appointment?.id,
              ),

            time: normalizeText(
              appointment
                ?.appointment_time,
            ),

            patient_name:
              normalizeText(
                patient?.name,
              ),

            phone: normalizeText(
              patient?.phone,
            ),

            dentist_name:
              normalizeText(
                dentist?.name,
              ),

            reason_for_visit:
              normalizeText(
                appointment
                  ?.reason_for_visit,
              ),

            status: normalizeText(
              appointment?.status,
            ),
          };
        },
      );

  return {
    date: reportDate,
    total_appointments:
      dailyAppointments.length,
    data: dailyAppointments,
  };
}

/*
|--------------------------------------------------------------------------
| Get Daily Income
|--------------------------------------------------------------------------
*/

export async function getDailyIncome(
  date,
) {
  const reportDate =
    validateRequiredDate(
      date,
      "2026-06-26",
    );

  const [
    patientRows,
    treatmentRows,
    paymentRows,
  ] = await Promise.all([
    readSheet(PATIENTS_SHEET),
    readSheet(TREATMENTS_SHEET),
    readSheet(PAYMENTS_SHEET),
  ]);

  const patients =
    ensureArray(patientRows);

  const treatments =
    ensureArray(treatmentRows);

  const payments =
    ensureArray(paymentRows);

  const patientMap = new Map(
    patients.map((patient) => [
      normalizeId(patient?.id),
      patient,
    ]),
  );

  const treatmentMap = new Map(
    treatments.map((treatment) => [
      normalizeId(treatment?.id),
      treatment,
    ]),
  );

  const dailyPayments =
    payments
      .filter((payment) => {
        return (
          normalizeDate(
            payment?.payment_date,
          ) === reportDate
        );
      })
      .map((payment) => {
        const patient =
          patientMap.get(
            normalizeId(
              payment?.patient_id,
            ),
          );

        const treatment =
          treatmentMap.get(
            normalizeId(
              payment?.treatment_id,
            ),
          );

        const treatmentFee =
          getTreatmentCharge(
            treatment,
            payment,
          );

        const paidAmount =
          getPaymentAmount(payment);

        const savedStatus =
          normalizeText(
            payment?.status,
          ).toLowerCase();

        let paymentStatus =
          "Partial";

        if (
          savedStatus === "paid" ||
          savedStatus === "full" ||
          (
            treatmentFee > 0 &&
            convertToNumber(
              payment?.remaining_amount,
            ) <= 0 &&
            convertToNumber(
              payment?.total_paid,
            ) >= treatmentFee
          )
        ) {
          paymentStatus = "Full";
        }

        const totalPaid =
          convertToNumber(
            payment?.total_paid ??
              paidAmount,
          );

        const balance =
          payment
            ?.remaining_amount !==
          undefined
            ? convertToNumber(
                payment
                  ?.remaining_amount,
              )
            : Math.max(
                treatmentFee -
                  totalPaid,
                0,
              );

        return {
          payment_id:
            normalizeText(
              payment?.id,
            ),

          receipt_number:
            normalizeText(
              payment
                ?.receipt_number,
            ),

          patient_id:
            normalizeText(
              payment?.patient_id,
            ),

          patient_name:
            normalizeText(
              patient?.name,
            ),

          treatment_id:
            normalizeText(
              payment?.treatment_id,
            ),

          treatment:
            normalizeText(
              treatment
                ?.treatment_performed,
            ),

          treatment_fee:
            treatmentFee,

          amount: paidAmount,

          previously_paid:
            convertToNumber(
              payment
                ?.previously_paid,
            ),

          total_paid:
            totalPaid,

          balance,

          installment_number:
            convertToNumber(
              payment
                ?.installment_number,
            ),

          payment_method:
            normalizeText(
              payment
                ?.payment_method,
            ),

          payment_date:
            normalizeText(
              payment
                ?.payment_date,
            ),

          status:
            paymentStatus,
        };
      });

  /*
   * Payment method totals
   */

  const getTotalByMethod = (
    methods,
  ) => {
    const acceptedMethods =
      methods.map((method) =>
        method.toLowerCase(),
      );

    return dailyPayments
      .filter((payment) => {
        return acceptedMethods.includes(
          normalizeText(
            payment.payment_method,
          ).toLowerCase(),
        );
      })
      .reduce(
        (sum, payment) =>
          sum +
          convertToNumber(
            payment.amount,
          ),
        0,
      );
  };

  const totalCash =
    getTotalByMethod(["Cash"]);

  const totalCard =
    getTotalByMethod(["Card"]);

  const totalTransfer =
    getTotalByMethod([
      "Transfer",
      "Bank Transfer",
      "Online",
    ]);

  /*
   * Full and partial summaries
   */

  const fullPayments =
    dailyPayments.filter(
      (payment) =>
        payment.status === "Full",
    );

  const partialPayments =
    dailyPayments.filter(
      (payment) =>
        payment.status ===
        "Partial",
    );

  const totalFullAmount =
    fullPayments.reduce(
      (sum, payment) =>
        sum +
        convertToNumber(
          payment.amount,
        ),
      0,
    );

  const totalPartialAmount =
    partialPayments.reduce(
      (sum, payment) =>
        sum +
        convertToNumber(
          payment.amount,
        ),
      0,
    );

  const totalIncome =
    dailyPayments.reduce(
      (sum, payment) =>
        sum +
        convertToNumber(
          payment.amount,
        ),
      0,
    );

  return {
    date: reportDate,

    summary: {
      total_payments:
        dailyPayments.length,

      full_payments:
        fullPayments.length,

      partial_payments:
        partialPayments.length,

      total_full_amount:
        totalFullAmount,

      total_partial_amount:
        totalPartialAmount,

      total_cash:
        totalCash,

      total_card:
        totalCard,

      total_transfer:
        totalTransfer,

      total_income:
        totalIncome,
    },

    data: dailyPayments,
  };
}

/*
|--------------------------------------------------------------------------
| Get Income by Date Range
|--------------------------------------------------------------------------
*/

export async function getIncomeByDateRange(
  startDateParam,
  endDateParam,
) {
  const startDate =
    normalizeDate(startDateParam);

  const endDate =
    normalizeDate(endDateParam);

  if (!startDate || !endDate) {
    throw appError(
      "Invalid date format. Use YYYY-MM-DD.",
      400,
    );
  }

  if (startDate > endDate) {
    throw appError(
      "start_date cannot be after end_date",
      400,
    );
  }

  const paymentRows =
    await readSheet(
      PAYMENTS_SHEET,
    );

  const payments =
    ensureArray(paymentRows);

  const filteredPayments =
    filterByDateRange(
      payments,
      "payment_date",
      startDate,
      endDate,
    ).sort((first, second) => {
      return normalizeText(
        first?.payment_date,
      ).localeCompare(
        normalizeText(
          second?.payment_date,
        ),
      );
    });

  /*
   * Overall summary
   */

  const summary =
    filteredPayments.reduce(
      (totals, payment) => {
        const treatmentCharge =
          getTreatmentCharge(
            null,
            payment,
          );

        const paymentAmount =
          getPaymentAmount(
            payment,
          );

        const remainingAmount =
          payment
            ?.remaining_amount !==
          undefined
            ? convertToNumber(
                payment
                  ?.remaining_amount,
              )
            : Math.max(
                treatmentCharge -
                  convertToNumber(
                    payment
                      ?.total_paid ??
                      paymentAmount,
                  ),
                0,
              );

        const status =
          normalizeText(
            payment?.status,
          ).toLowerCase();

        totals.payment_count += 1;

        totals.total_treatment_charge +=
          treatmentCharge;

        totals.total_payment_amount +=
          paymentAmount;

        totals.total_balance +=
          remainingAmount;

        if (
          status === "paid" ||
          status === "full" ||
          (
            treatmentCharge > 0 &&
            remainingAmount <= 0
          )
        ) {
          totals.full_payment_count +=
            1;
        } else {
          totals.partial_payment_count +=
            1;
        }

        return totals;
      },
      {
        payment_count: 0,
        total_treatment_charge: 0,
        total_payment_amount: 0,
        total_balance: 0,
        full_payment_count: 0,
        partial_payment_count: 0,
      },
    );

  /*
   * Daily summary
   */

  const dailySummaryMap =
    filteredPayments.reduce(
      (result, payment) => {
        const paymentDate =
          normalizeDate(
            payment
              ?.payment_date,
          );

        if (!paymentDate) {
          return result;
        }

        if (
          !result[paymentDate]
        ) {
          result[paymentDate] = {
            date: paymentDate,
            payment_count: 0,
            total_treatment_charge:
              0,
            total_payment_amount:
              0,
            total_balance: 0,
            full_payment_count:
              0,
            partial_payment_count:
              0,
          };
        }

        const treatmentCharge =
          getTreatmentCharge(
            null,
            payment,
          );

        const paymentAmount =
          getPaymentAmount(
            payment,
          );

        const remainingAmount =
          payment
            ?.remaining_amount !==
          undefined
            ? convertToNumber(
                payment
                  ?.remaining_amount,
              )
            : Math.max(
                treatmentCharge -
                  convertToNumber(
                    payment
                      ?.total_paid ??
                      paymentAmount,
                  ),
                0,
              );

        const paymentStatus =
          normalizeText(
            payment?.status,
          ).toLowerCase();

        const dailyRecord =
          result[paymentDate];

        dailyRecord.payment_count +=
          1;

        dailyRecord
          .total_treatment_charge +=
          treatmentCharge;

        dailyRecord
          .total_payment_amount +=
          paymentAmount;

        dailyRecord.total_balance +=
          remainingAmount;

        if (
          paymentStatus === "paid" ||
          paymentStatus === "full" ||
          (
            treatmentCharge > 0 &&
            remainingAmount <= 0
          )
        ) {
          dailyRecord
            .full_payment_count += 1;
        } else {
          dailyRecord
            .partial_payment_count +=
            1;
        }

        return result;
      },
      {},
    );

  const dailySummary =
    Object.values(
      dailySummaryMap,
    ).sort((first, second) => {
      return first.date.localeCompare(
        second.date,
      );
    });

  return {
    payments:
      filteredPayments,
    summary,
    dailySummary,
  };
}

/*
|--------------------------------------------------------------------------
| Get Daily Next Appointments
|--------------------------------------------------------------------------
*/

export async function getDailyNextAppointments(
  date,
) {
  const reportDate =
    validateRequiredDate(
      date,
      "2026-07-03",
    );

  const [
    patientRows,
    dentistRows,
    treatmentRows,
  ] = await Promise.all([
    readSheet(PATIENTS_SHEET),
    readSheet(DENTISTS_SHEET),
    readSheet(TREATMENTS_SHEET),
  ]);

  const patients =
    ensureArray(patientRows);

  const dentists =
    ensureArray(dentistRows);

  const treatments =
    ensureArray(treatmentRows);

  const patientMap = new Map(
    patients.map((patient) => [
      normalizeId(patient?.id),
      patient,
    ]),
  );

  const dentistMap = new Map(
    dentists.map((dentist) => [
      normalizeId(dentist?.id),
      dentist,
    ]),
  );

  const dailyNextAppointments =
    treatments
      .filter((treatment) => {
        return (
          normalizeDate(
            treatment
              ?.next_appointment_date,
          ) === reportDate
        );
      })
      .map((treatment) => {
        const patient =
          patientMap.get(
            normalizeId(
              treatment
                ?.patient_id,
            ),
          );

        const dentist =
          dentistMap.get(
            normalizeId(
              treatment
                ?.dentist_id,
            ),
          );

        return {
          treatment_id:
            normalizeText(
              treatment?.id,
            ),

          patient_id:
            normalizeText(
              treatment
                ?.patient_id,
            ),

          patient_name:
            normalizeText(
              patient?.name,
            ),

          phone:
            normalizeText(
              patient?.phone,
            ),

          age:
            normalizeText(
              patient?.age,
            ),

          gender:
            normalizeText(
              patient?.gender,
            ),

          address:
            normalizeText(
              patient?.address,
            ),

          dentist_id:
            normalizeText(
              treatment
                ?.dentist_id,
            ),

          dentist_name:
            normalizeText(
              dentist?.name,
            ),

          previous_appointment_id:
            normalizeText(
              treatment
                ?.appointment_id,
            ),

          previous_diagnosis:
            normalizeText(
              treatment
                ?.diagnosis,
            ),

          previous_treatment:
            normalizeText(
              treatment
                ?.treatment_performed,
            ),

          prescription:
            treatment
              ?.prescription || "",

          doctor_notes:
            normalizeText(
              treatment
                ?.doctor_notes,
            ),

          previous_treatment_date:
            normalizeText(
              treatment
                ?.treatment_date,
            ),

          next_appointment_date:
            normalizeText(
              treatment
                ?.next_appointment_date,
            ),
        };
      });

  return {
    date: reportDate,

    total_next_appointments:
      dailyNextAppointments.length,

    data:
      dailyNextAppointments,
  };
}

/*
|--------------------------------------------------------------------------
| Get Appointments, Treatments and Payments by Date Range
|--------------------------------------------------------------------------
*/

export async function getAppointmentsTreatmentsByDateRange(
  startDateParam,
  endDateParam,
) {
  if (
    !startDateParam ||
    !endDateParam
  ) {
    throw appError(
      "start_date and end_date are required",
      400,
    );
  }

  const startDate =
    normalizeDate(
      startDateParam,
    );

  const endDate =
    normalizeDate(
      endDateParam,
    );

  if (
    !startDate ||
    !endDate
  ) {
    throw appError(
      "Invalid date format. Use YYYY-MM-DD.",
      400,
    );
  }

  if (startDate > endDate) {
    throw appError(
      "start_date cannot be after end_date",
      400,
    );
  }

  const [
    appointmentRows,
    treatmentRows,
    paymentRows,
  ] = await Promise.all([
    readSheet(
      APPOINTMENTS_SHEET,
    ),
    readSheet(
      TREATMENTS_SHEET,
    ),
    readSheet(
      PAYMENTS_SHEET,
    ),
  ]);

  const appointments =
    ensureArray(
      appointmentRows,
    );

  const treatments =
    ensureArray(
      treatmentRows,
    );

  const payments =
    ensureArray(
      paymentRows,
    );

  /*
   * Find appointments within selected date range
   */

  const filteredAppointments =
    appointments.filter(
      (appointment) => {
        return isDateWithinRange(
          appointment
            ?.appointment_date,
          startDate,
          endDate,
        );
      },
    );

  const appointmentIds =
    new Set(
      filteredAppointments
        .map((appointment) =>
          normalizeId(
            appointment?.id,
          ),
        )
        .filter(Boolean),
    );

  /*
   * Find treatments connected to appointments
   */

  const relatedTreatments =
    treatments.filter(
      (treatment) => {
        return appointmentIds.has(
          normalizeId(
            treatment
              ?.appointment_id,
          ),
        );
      },
    );

  const treatmentIds =
    new Set(
      relatedTreatments
        .map((treatment) =>
          normalizeId(
            treatment?.id,
          ),
        )
        .filter(Boolean),
    );

  /*
   * Find payments connected to treatments
   */

  const relatedPayments =
    payments.filter(
      (payment) => {
        return treatmentIds.has(
          normalizeId(
            payment
              ?.treatment_id,
          ),
        );
      },
    );

  /*
   * Group payments by treatment ID
   */

  const paymentsByTreatmentId =
    new Map();

  relatedPayments.forEach(
    (payment) => {
      const treatmentId =
        normalizeId(
          payment
            ?.treatment_id,
        );

      if (
        !paymentsByTreatmentId.has(
          treatmentId,
        )
      ) {
        paymentsByTreatmentId.set(
          treatmentId,
          [],
        );
      }

      paymentsByTreatmentId
        .get(treatmentId)
        .push(payment);
    },
  );

  /*
   * Group treatments by appointment ID
   */

  const treatmentsByAppointmentId =
    new Map();

  relatedTreatments.forEach(
    (treatment) => {
      const appointmentId =
        normalizeId(
          treatment
            ?.appointment_id,
        );

      const treatmentId =
        normalizeId(
          treatment?.id,
        );

      const treatmentPayments =
        paymentsByTreatmentId.get(
          treatmentId,
        ) || [];

      const treatmentCharge =
        getTreatmentCharge(
          treatment,
        );

      const totalPaid =
        treatmentPayments.reduce(
          (total, payment) => {
            return (
              total +
              getPaymentAmount(
                payment,
              )
            );
          },
          0,
        );

      const remainingAmount =
        Math.max(
          treatmentCharge -
            totalPaid,
          0,
        );

      const treatmentWithPayments =
        {
          ...treatment,

          payment_summary: {
            treatment_charge:
              treatmentCharge,

            total_paid:
              totalPaid,

            remaining_amount:
              remainingAmount,

            installment_count:
              treatmentPayments.length,

            status:
              treatmentCharge >
                0 &&
              remainingAmount <= 0
                ? "Paid"
                : totalPaid > 0
                  ? "Partial"
                  : "Unpaid",
          },

          payments:
            treatmentPayments,
        };

      if (
        !treatmentsByAppointmentId.has(
          appointmentId,
        )
      ) {
        treatmentsByAppointmentId.set(
          appointmentId,
          [],
        );
      }

      treatmentsByAppointmentId
        .get(appointmentId)
        .push(
          treatmentWithPayments,
        );
    },
  );

  /*
   * Build final appointment data
   */

  const results =
    filteredAppointments.map(
      (appointment) => {
        const appointmentId =
          normalizeId(
            appointment?.id,
          );

        const appointmentTreatments =
          treatmentsByAppointmentId.get(
            appointmentId,
          ) || [];

        const appointmentTreatmentCharge =
          appointmentTreatments.reduce(
            (
              total,
              treatment,
            ) => {
              return (
                total +
                getTreatmentCharge(
                  treatment,
                )
              );
            },
            0,
          );

        const appointmentTotalPaid =
          appointmentTreatments.reduce(
            (
              total,
              treatment,
            ) => {
              return (
                total +
                convertToNumber(
                  treatment
                    ?.payment_summary
                    ?.total_paid,
                )
              );
            },
            0,
          );

        const appointmentRemaining =
          Math.max(
            appointmentTreatmentCharge -
              appointmentTotalPaid,
            0,
          );

        return {
          ...appointment,

          treatments:
            appointmentTreatments,

          financial_summary: {
            treatment_charge:
              appointmentTreatmentCharge,

            total_paid:
              appointmentTotalPaid,

            remaining_amount:
              appointmentRemaining,

            status:
              appointmentTreatmentCharge >
                0 &&
              appointmentRemaining <= 0
                ? "Paid"
                : appointmentTotalPaid >
                    0
                  ? "Partial"
                  : "Unpaid",
          },
        };
      },
    );

  /*
   * Calculate report summary
   */

  const totalTreatmentCharge =
    relatedTreatments.reduce(
      (total, treatment) => {
        return (
          total +
          getTreatmentCharge(
            treatment,
          )
        );
      },
      0,
    );

  const totalPaid =
    relatedPayments.reduce(
      (total, payment) => {
        return (
          total +
          getPaymentAmount(
            payment,
          )
        );
      },
      0,
    );

  const totalRemaining =
    Math.max(
      totalTreatmentCharge -
        totalPaid,
      0,
    );

  return {
    date_range: {
      start_date:
        startDate,
      end_date:
        endDate,
    },

    summary: {
      appointment_count:
        filteredAppointments.length,

      treatment_count:
        relatedTreatments.length,

      payment_count:
        relatedPayments.length,

      total_treatment_charge:
        totalTreatmentCharge,

      total_paid:
        totalPaid,

      total_remaining:
        totalRemaining,
    },

    data: results,
  };
}