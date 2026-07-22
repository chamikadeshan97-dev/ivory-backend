import appError from "../utils/appError.js";
import { readSheet, readSheets } from "../utils/excelDb.js";
export function getDailyAppointments(date) {
  if (!date) {
    throw appError("Date is required. Example: ?date=2026-06-26", 400);
  }

  const patients = readSheet("Patients");
  const dentists = readSheet("Dentists");
  const appointments = readSheet("Appointments");

  const dailyAppointments = appointments
    .filter((appointment) => appointment.appointment_date === date)
    .sort((a, b) =>
      String(a.appointment_time || "").localeCompare(
        String(b.appointment_time || ""),
      ),
    )
    .map((appointment, index) => {
      const patient = patients.find((p) => p.id === appointment.patient_id);
      const dentist = dentists.find((d) => d.id === appointment.dentist_id);

      return {
        queue_no: index + 1,
        appointment_id: appointment.id,
        time: appointment.appointment_time,
        patient_name: patient?.name || "",
        phone: patient?.phone || "",
        dentist_name: dentist?.name || "",
        reason_for_visit: appointment.reason_for_visit,
        status: appointment.status,
      };
    });

  return {
    date,
    total_appointments: dailyAppointments.length,
    data: dailyAppointments,
  };
}

export function getDailyIncome(date) {
  if (!date) {
    throw appError("Date is required. Example: ?date=2026-06-26", 400);
  }

  const patients = readSheet("Patients");
  const treatments = readSheet("Treatments");
  const payments = readSheet("Payments");

  const dailyPayments = payments
    .filter(
      (payment) => String(payment.payment_date).trim() === String(date).trim(),
    )
    .map((payment) => {
      const patient = patients.find(
        (item) => String(item.id).trim() === String(payment.patient_id).trim(),
      );

      const treatment = treatments.find(
        (item) =>
          String(item.id).trim() === String(payment.treatment_id).trim(),
      );

      
      const treatmentFee = Number(treatment?.treatment_fee || 0);

      const paidAmount = Number(payment.payment_amount || 0);

      /*
       * Use the saved payment status when available.
       * Otherwise calculate it from the paid amount.
       */
      const savedStatus = String(payment.status || "")
        .trim()
        .toLowerCase();

      let paymentStatus = "Partial";

      if (
        savedStatus === "paid" ||
        savedStatus === "full" ||
        (treatmentFee > 0 && paidAmount >= treatmentFee)
      ) {
        paymentStatus = "Full";
      }

      const balance = Math.max(treatmentFee - paidAmount, 0);

      return {
        payment_id: payment.id,
        receipt_number: payment.receipt_number || "",

        patient_id: payment.patient_id || "",

        patient_name: patient?.name || "",

        treatment_id: payment.treatment_id || "",

        treatment: treatment?.treatment_performed || "",

        treatment_fee: treatmentFee,
        amount: paidAmount,
        balance,

        payment_method: payment.payment_method || "",

        payment_date: payment.payment_date || "",

        status: paymentStatus,
      };
    });

  /* --------------------------------------------------------
     Payment-method totals
  -------------------------------------------------------- */

  const totalCash = dailyPayments
    .filter(
      (payment) =>
        String(payment.payment_method).trim().toLowerCase() === "cash",
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const totalCard = dailyPayments
    .filter(
      (payment) =>
        String(payment.payment_method).trim().toLowerCase() === "card",
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  const totalTransfer = dailyPayments
    .filter(
      (payment) =>
        String(payment.payment_method).trim().toLowerCase() === "transfer",
    )
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  /* --------------------------------------------------------
     Full and partial payment summaries
  -------------------------------------------------------- */

  const fullPayments = dailyPayments.filter(
    (payment) => payment.status === "Full",
  );

  const partialPayments = dailyPayments.filter(
    (payment) => payment.status === "Partial",
  );

  const totalFullAmount = fullPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const totalPartialAmount = partialPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  const totalIncome = dailyPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );

  return {
    date,

    summary: {
      total_payments: dailyPayments.length,

      full_payments: fullPayments.length,
      partial_payments: partialPayments.length,

      total_full_amount: totalFullAmount,
      total_partial_amount: totalPartialAmount,

      total_cash: totalCash,
      total_card: totalCard,
      total_transfer: totalTransfer,

      total_income: totalIncome,
    },

    data: dailyPayments,
  };
}

const filterByDateRange = (records, dateField, startDate, endDate) => {
  return records.filter((record) => {
    const recordDate = String(record?.[dateField] || "")
      .trim()
      .slice(0, 10);

    return recordDate && recordDate >= startDate && recordDate <= endDate;
  });
};

/* --------------------------------------------------------
   Get income report by date range
-------------------------------------------------------- */

export function getIncomeByDateRange(startDate, endDate) {
  const payments = readSheet("Payments");

  const filteredPayments = filterByDateRange(
    payments,
    "payment_date",
    startDate,
    endDate,
  ).sort((a, b) => {
    return String(a?.payment_date || "").localeCompare(
      String(b?.payment_date || ""),
    );
  });

  /* --------------------------------------------------------
     Overall summary
  -------------------------------------------------------- */

  const summary = filteredPayments.reduce(
    (totals, payment) => {
      const treatmentCharge =
        Number(
          payment?.treatment_charge ??
            payment?.treatment_fee ??
            payment?.charge ??
            0,
        ) || 0;

      const paymentAmount =
        Number(payment?.payment_amount ?? payment?.amount ?? 0) || 0;

      totals.payment_count += 1;
      totals.total_treatment_charge += treatmentCharge;
      totals.total_payment_amount += paymentAmount;
      totals.total_balance += Math.max(treatmentCharge - paymentAmount, 0);

      if (paymentAmount >= treatmentCharge) {
        totals.full_payment_count += 1;
      } else {
        totals.partial_payment_count += 1;
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

  /* --------------------------------------------------------
     Daily summary
  -------------------------------------------------------- */

  const dailySummaryMap = filteredPayments.reduce((result, payment) => {
    const paymentDate = String(payment?.payment_date || "")
      .trim()
      .slice(0, 10);

    if (!paymentDate) {
      return result;
    }

    if (!result[paymentDate]) {
      result[paymentDate] = {
        date: paymentDate,
        payment_count: 0,
        total_treatment_charge: 0,
        total_payment_amount: 0,
        total_balance: 0,
        full_payment_count: 0,
        partial_payment_count: 0,
      };
    }

    const treatmentCharge =
      Number(
        payment?.treatment_charge ??
          payment?.treatment_fee ??
          payment?.charge ??
          0,
      ) || 0;

    const paymentAmount =
      Number(payment?.payment_amount ?? payment?.amount ?? 0) || 0;

    result[paymentDate].payment_count += 1;

    result[paymentDate].total_treatment_charge += treatmentCharge;

    result[paymentDate].total_payment_amount += paymentAmount;

    result[paymentDate].total_balance += Math.max(
      treatmentCharge - paymentAmount,
      0,
    );

    if (paymentAmount >= treatmentCharge) {
      result[paymentDate].full_payment_count += 1;
    } else {
      result[paymentDate].partial_payment_count += 1;
    }

    return result;
  }, {});

  const dailySummary = Object.values(dailySummaryMap).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    payments: filteredPayments,
    summary,
    dailySummary,
  };
}

export function getDailyNextAppointments(date) {
  if (!date) {
    throw appError("Date is required. Example: ?date=2026-07-03", 400);
  }

  const { Patients, Dentists, Treatments } = readSheets([
    "Patients",
    "Dentists",
    "Treatments",
  ]);

  const patientMap = new Map(Patients.map((patient) => [patient.id, patient]));
  const dentistMap = new Map(Dentists.map((dentist) => [dentist.id, dentist]));

  const dailyNextAppointments = Treatments.filter(
    (treatment) => treatment.next_appointment_date === date,
  ).map((treatment) => {
    const patient = patientMap.get(treatment.patient_id);
    const dentist = dentistMap.get(treatment.dentist_id);

    return {
      treatment_id: treatment.id,
      patient_id: treatment.patient_id,
      patient_name: patient?.name || "",
      phone: patient?.phone || "",
      age: patient?.age || "",
      gender: patient?.gender || "",
      address: patient?.address || "",
      dentist_id: treatment.dentist_id,
      dentist_name: dentist?.name || "",
      previous_appointment_id: treatment.appointment_id,
      previous_diagnosis: treatment.diagnosis,
      previous_treatment: treatment.treatment_performed,
      prescription: treatment.prescription,
      doctor_notes: treatment.doctor_notes,
      previous_treatment_date: treatment.treatment_date,
      next_appointment_date: treatment.next_appointment_date,
    };
  });

  return {
    date,
    total_next_appointments: dailyNextAppointments.length,
    data: dailyNextAppointments,
  };
}
