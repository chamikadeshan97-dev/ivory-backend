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
  date,
  appointmentNumber,
}) => {
  const smsDate = dayjs(date).format("DD.MM.YYYY");

  const formattedNumber = String(appointmentNumber || "").padStart(2, "0");

  return (
    `Dear Sir/Madam,\n` +
    `Your tentative appointment for Dr Bandu Ukwattage at Ivory Dental on ${smsDate} appt no ${formattedNumber}.\n` +
    `Thanking you for choosing Ivory Dental.\n` +
    `- Ivory Dental -`
  );
};

/**
 * Doctor Arrival SMS
 */
export const doctorArrivalSMS = () => {
  return (
    `Dear Sir/Madam,\n` +
    `Dr Bandu Ukwattage has arrived. Please proceed to the dental clinic according to your allocated number.\n` +
    `Thank You.\n` +
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
