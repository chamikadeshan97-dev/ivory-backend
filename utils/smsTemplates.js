/* =========================================================
   SMS TEMPLATES
========================================================= */

import dayjs from "dayjs";

const MAX_SMS_LENGTH = 150;

const getFirstName = (fullName = "") => {
  return String(fullName).trim().split(/\s+/)[0] || "Sir/Madam";
};

const formatSmsDate = (date) => {
  const appointmentDate = dayjs(date);

  return appointmentDate.format("YYYY MMMM DD");
};

export const appointmentDetailsSMS = ({
  patientName,
  date,
  appointmentNumber,
  reason,
}) => {
  const firstName = getFirstName(patientName);
  const smsDate = formatSmsDate(date);
  const reasonText = String(reason || "")
    .toLowerCase()
    .includes("see")
    ? "To Check"
    : reason || "N/A";
  return (
    `Dear Sir/Madam,\n\n` +
    `Your appointment details\n` +
    `Date - ${smsDate}\n` +
    `Number - #${appointmentNumber}\n\n` +
 `Contact: +94 71 144 9999\n` +
    `- Ivory Dental -`
  );
};

/**
 * Doctor Arrival SMS
 */
export const doctorArrivalSMS = ({ patientName }) => {
  return (
    `Dear Sir/Madam,\n\n` +
    `Doctor has arrived.\n` +
    `Please stay at the clinic.\n\n` +
     `Contact: +94 71 144 9999\n` +
    `- Ivory Dental -`
  );
};

/**
 * Appointment Details / Confirmation SMS
 */

/**
 * E-Bill / Payment SMS
 */
export const eBillSMS = ({ patientName, total, paid, balance, billLink }) => {
  const firstName = getFirstName(patientName);

  return (
    `Dear Sir/Madam,\n\n` +
    `Total Rs.${total}, Paid Rs.${paid}, Bal Rs.${balance}.\n` +
    `Bill: ${billLink}\n\n` +
    `Contact: +94 71 144 9999\n` +
    `- Ivory Dental -`
  );
};

/* =========================================================
   CENTRAL TEMPLATE OBJECT
========================================================= */

const SMS_TEMPLATES = {
  doctorArrival: doctorArrivalSMS,
  appointmentDetails: appointmentDetailsSMS,
  eBill: eBillSMS,
};

export default SMS_TEMPLATES;
