import {
  loginHutchSMS,
  sendSMS,
  sendBulkSMS,
  normalizeSriLankanNumber,
  clearHutchSmsToken,
  getHutchTokenStatus,
} from "../services/hutchSms.service.js";
import SMS_TEMPLATES from "../utils/smsTemplates.js";

/* =========================================================
   LOGIN TEST
========================================================= */

export const loginSmsApi = async (
  req,
  res
) => {
  try {
    const result =
      await loginHutchSMS();

    return res.status(200).json({
      success: true,

      message:
        "Hutch SMS login successful.",

      data: result,
    });
  } catch (error) {
    console.error(
      "loginSmsApi error:",
      error.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,

      message:
        "Unable to login to Hutch SMS API.",

      error:
        error.response?.data ||
        error.message,
    });
  }
};

/* =========================================================
   SEND SINGLE SMS
========================================================= */

export const sendSingleSms = async (
  req,
  res
) => {
  try {
    const {
      number,
      numbers,
      content,
      campaignName,
    } = req.body;

    const mobileNumbers =
      numbers || number;

    if (!mobileNumbers) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Mobile number is required.",
        });
    }

    if (
      !content ||
      !String(content).trim()
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "SMS content is required.",
        });
    }

    const result =
      await sendSMS({
        numbers:
          mobileNumbers,

        content,

        campaignName,
      });

    if (!result.success) {
      return res
        .status(502)
        .json({
          success: false,

          message:
            "Unable to send SMS.",

          ...result,
        });
    }

    return res.status(200).json({
      success: true,

      message:
        "SMS sent successfully.",

      ...result,
    });
  } catch (error) {
    console.error(
      "sendSingleSms error:",
      error
    );

    return res.status(500).json({
      success: false,

      message:
        "Unexpected error while sending SMS.",

      error: error.message,
    });
  }
};

/* =========================================================
   SEND BULK SMS
========================================================= */

export const sendBulkSmsController =
  async (req, res) => {
    try {
      const {
        messages,
        campaignName,
      } = req.body;

      if (
        !Array.isArray(messages)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "messages must be an array.",
          });
      }

      if (
        messages.length === 0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "At least one SMS message is required.",
          });
      }

      const result =
        await sendBulkSMS(
          messages,
          {
            campaignName,
          }
        );

      return res.status(200).json({
        message:
          result.failed === 0
            ? "All SMS messages sent successfully."
            : "Bulk SMS process completed with some failures.",

        ...result,
      });
    } catch (error) {
      console.error(
        "sendBulkSmsController error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unexpected error while sending bulk SMS.",

          error:
            error.message,
        });
    }
  };

/* =========================================================
   NORMALIZE NUMBER
   Useful while testing
========================================================= */

export const normalizeSmsNumber = (
  req,
  res
) => {
  try {
    const { number } =
      req.body;

    if (!number) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "number is required.",
        });
    }

    const normalized =
      normalizeSriLankanNumber(
        number
      );

    if (!normalized) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Invalid Sri Lankan mobile number.",
        });
    }

    return res.status(200).json({
      success: true,

      original: number,

      normalized,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message,
      });
  }
};

/* =========================================================
   TOKEN STATUS
========================================================= */

export const getSmsTokenStatus = (
  req,
  res
) => {
  try {
    const status =
      getHutchTokenStatus();

    return res.status(200).json({
      success: true,

      ...status,
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message,
      });
  }
};

/* =========================================================
   CLEAR TOKEN
========================================================= */

export const clearSmsToken = (
  req,
  res
) => {
  try {
    clearHutchSmsToken();

    return res.status(200).json({
      success: true,

      message:
        "Hutch SMS token cleared.",
    });
  } catch (error) {
    return res
      .status(500)
      .json({
        success: false,

        message:
          error.message,
      });
  }
};






/* =========================================================
   SEND TEMPLATE SMS
========================================================= */

export const sendTemplateSMS = async (req, res) => {
  try {
    const {
      mobile,
      template,
      data,
    } = req.body;

    /* =====================================================
       Validation
    ===================================================== */

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required",
      });
    }

    if (!template) {
      return res.status(400).json({
        success: false,
        message: "SMS template is required",
      });
    }

    const normalizedMobile = String(mobile)
      .replace(/\s+/g, "")
      .trim();

    if (!/^0\d{9}$/.test(normalizedMobile)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mobile number",
      });
    }

    /* =====================================================
       Find template
    ===================================================== */

    const templateFunction =
      SMS_TEMPLATES[template];

    if (!templateFunction) {
      return res.status(400).json({
        success: false,
        message: `Invalid SMS template: ${template}`,
      });
    }

    /* =====================================================
       Generate message
    ===================================================== */

    const smsMessage = templateFunction(
      data || {},
    );

    if (!smsMessage) {
      return res.status(400).json({
        success: false,
        message: "Failed to generate SMS message",
      });
    }

    /* =====================================================
       Send SMS
    ===================================================== */

    const smsResponse = await sendSMS({
      numbers: normalizedMobile,
      content: smsMessage,
    });

    return res.status(200).json({
      success: true,
      message: "SMS sent successfully",

      data: {
        numbers: normalizedMobile,
        template,
        content: smsMessage,
        provider_response: smsResponse,
      },
    });
  } catch (error) {
    console.error(
      "sendTemplateSMS error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to send SMS",
    });
  }
};