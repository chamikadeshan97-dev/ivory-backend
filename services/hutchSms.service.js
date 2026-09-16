import axios from "axios";

/* =========================================================
   CONFIGURATION
========================================================= */

const HUTCH_BASE_URL =
  process.env.HUTCH_SMS_BASE_URL ||
  "https://bsms.hutch.lk/api";

const HUTCH_USERNAME =
  process.env.HUTCH_SMS_USERNAME;

const HUTCH_PASSWORD =
  process.env.HUTCH_SMS_PASSWORD;

const HUTCH_MASK =
  process.env.HUTCH_SMS_MASK;

const DEFAULT_CAMPAIGN_NAME =
  process.env.HUTCH_SMS_CAMPAIGN_NAME ||
  "Dental Clinic";

/*
 * Hutch documentation:
 * Maximum 20 SMS messages per bulk request.
 */
const BULK_LIMIT = 20;

/* =========================================================
   TOKEN CACHE
========================================================= */

let accessToken = null;
let refreshToken = null;

/* =========================================================
   NUMBER NORMALIZATION
========================================================= */

export const normalizeSriLankanNumber = (value) => {
  if (!value) {
    return null;
  }

  let number = String(value)
    .trim()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/\(/g, "")
    .replace(/\)/g, "");

  /*
   * +94771234567
   * ->
   * 94771234567
   */
  if (number.startsWith("+")) {
    number = number.substring(1);
  }

  /*
   * 0771234567
   * ->
   * 94771234567
   */
  if (/^0\d{9}$/.test(number)) {
    return `94${number.substring(1)}`;
  }

  /*
   * Already Hutch-compatible
   *
   * 94771234567
   */
  if (/^94\d{9}$/.test(number)) {
    return number;
  }

  /*
   * 771234567
   * ->
   * 94771234567
   */
  if (/^\d{9}$/.test(number)) {
    return `94${number}`;
  }

  return null;
};

/* =========================================================
   HEADERS
========================================================= */

const getBasicHeaders = () => ({
  "Content-Type": "application/json",
  Accept: "*/*",
  "X-API-VERSION": "v1",
});

const getAuthorizedHeaders = () => {
  if (!accessToken) {
    throw new Error(
      "Hutch SMS access token is not available."
    );
  }

  return {
    ...getBasicHeaders(),

    Authorization: `Bearer ${accessToken}`,
  };
};

/* =========================================================
   LOGIN
========================================================= */

export const loginHutchSMS = async () => {
  try {
    if (!HUTCH_USERNAME) {
      throw new Error(
        "HUTCH_SMS_USERNAME is not configured."
      );
    }

    if (!HUTCH_PASSWORD) {
      throw new Error(
        "HUTCH_SMS_PASSWORD is not configured."
      );
    }

    const response = await axios.post(
      `${HUTCH_BASE_URL}/login`,
      {
        username: HUTCH_USERNAME,
        password: HUTCH_PASSWORD,
      },
      {
        headers: getBasicHeaders(),
        timeout: 15000,
      }
    );

    const data = response.data || {};

    if (!data.accessToken) {
      throw new Error(
        "Hutch login response did not contain accessToken."
      );
    }

    accessToken = data.accessToken;

    refreshToken =
      data.refreshToken || null;

    console.log(
      "[Hutch SMS] Login successful"
    );

    return {
      success: true,

      accessTokenReceived:
        Boolean(accessToken),

      refreshTokenReceived:
        Boolean(refreshToken),
    };
  } catch (error) {
    console.error(
      "[Hutch SMS] Login failed:",
      error.response?.data ||
        error.message
    );

    throw error;
  }
};

/* =========================================================
   TOKEN MANAGEMENT
========================================================= */

const ensureAccessToken = async () => {
  if (!accessToken) {
    await loginHutchSMS();
  }

  return accessToken;
};

/*
 * The PDF provides a refreshToken but does not document
 * a refresh-token endpoint.
 *
 * Therefore:
 *
 * 1. Use existing access token
 * 2. If Hutch returns 401
 * 3. Login again
 * 4. Retry request once
 */

const executeAuthorizedRequest =
  async (requestFunction) => {
    await ensureAccessToken();

    try {
      return await requestFunction();
    } catch (error) {
      if (
        error.response?.status === 401
      ) {
        console.log(
          "[Hutch SMS] Access token rejected. Re-authenticating..."
        );

        accessToken = null;
        refreshToken = null;

        await loginHutchSMS();

        return await requestFunction();
      }

      throw error;
    }
  };

/* =========================================================
   SEND SMS
========================================================= */

export const sendSMS = async ({
  numbers,
  content,
  campaignName =
    DEFAULT_CAMPAIGN_NAME,
  mask = HUTCH_MASK,
}) => {
  try {
    if (!content) {
      throw new Error(
        "SMS content is required."
      );
    }

    if (!mask) {
      throw new Error(
        "HUTCH_SMS_MASK is not configured."
      );
    }

    let numberList = [];

    if (Array.isArray(numbers)) {
      numberList = numbers;
    } else {
      numberList = [numbers];
    }

    const normalizedNumbers =
      numberList
        .map(
          normalizeSriLankanNumber
        )
        .filter(Boolean);

    if (
      normalizedNumbers.length === 0
    ) {
      throw new Error(
        "No valid mobile numbers were provided."
      );
    }

    const payload = {
      campaignName,

      mask,

      numbers:
        normalizedNumbers.join(","),

      content: String(
        content
      ).trim(),
    };

    const response =
      await executeAuthorizedRequest(
        () =>
          axios.post(
            `${HUTCH_BASE_URL}/sendsms`,
            payload,
            {
              headers:
                getAuthorizedHeaders(),

              timeout: 20000,
            }
          )
      );

    return {
      success: true,

      numbers:
        normalizedNumbers,

      serverRef:
        response.data?.serverRef ||
        null,

      data: response.data,
    };
  } catch (error) {
    console.error(
      "[Hutch SMS] Send failed:",
      error.response?.data ||
        error.message
    );

    return {
      success: false,

      serverRef: null,

      error:
        error.response?.data
          ?.message ||
        error.response?.data
          ?.error ||
        error.message ||
        "SMS sending failed.",
    };
  }
};

/* =========================================================
   SEND BULK SMS
========================================================= */

export const sendBulkSMS = async (
  messages,
  {
    campaignName =
      DEFAULT_CAMPAIGN_NAME,

    mask = HUTCH_MASK,
  } = {}
) => {
  try {
    if (
      !Array.isArray(messages)
    ) {
      throw new Error(
        "messages must be an array."
      );
    }

    if (
      messages.length === 0
    ) {
      throw new Error(
        "No SMS messages were provided."
      );
    }

    if (!mask) {
      throw new Error(
        "HUTCH_SMS_MASK is not configured."
      );
    }

    /* =============================================
       VALIDATE & PREPARE
    ============================================= */

    const validMessages =
      messages
        .map((message) => {
          const number =
            normalizeSriLankanNumber(
              message.number ||
                message.numbers ||
                message.mobile ||
                message.phone
            );

          const content =
            String(
              message.content ||
                ""
            ).trim();

          if (
            !number ||
            !content
          ) {
            return null;
          }

          return {
            campaignName:
              message.campaignName ||
              campaignName,

            mask:
              message.mask ||
              mask,

            numbers: number,

            content,
          };
        })
        .filter(Boolean);

    if (
      validMessages.length === 0
    ) {
      throw new Error(
        "No valid SMS messages remained after validation."
      );
    }

    /* =============================================
       CREATE BATCHES OF MAXIMUM 20
    ============================================= */

    const batches = [];

    for (
      let i = 0;
      i < validMessages.length;
      i += BULK_LIMIT
    ) {
      batches.push(
        validMessages.slice(
          i,
          i + BULK_LIMIT
        )
      );
    }

    const allResults = [];

    /* =============================================
       SEND EACH BATCH
    ============================================= */

    for (
      let batchIndex = 0;
      batchIndex <
      batches.length;
      batchIndex++
    ) {
      const batch =
        batches[batchIndex];

      try {
        const response =
          await executeAuthorizedRequest(
            () =>
              axios.post(
                `${HUTCH_BASE_URL}/sendsms/bulk`,
                batch,
                {
                  headers:
                    getAuthorizedHeaders(),

                  timeout: 30000,
                }
              )
          );

        const responseData =
          Array.isArray(
            response.data
          )
            ? response.data
            : [response.data];

        responseData.forEach(
          (result) => {
            allResults.push({
              success:
                !result.error,

              serverRef:
                result.serverRef ||
                null,

              number:
                result.numbers ||
                null,

              error:
                result.error ||
                null,
            });
          }
        );
      } catch (error) {
        console.error(
          `[Hutch SMS] Bulk batch ${
            batchIndex + 1
          } failed:`,
          error.response?.data ||
            error.message
        );

        /*
         * If whole batch fails,
         * record every item as failed.
         */

        batch.forEach(
          (message) => {
            allResults.push({
              success: false,

              serverRef: null,

              number:
                message.numbers,

              error:
                error.response
                  ?.data?.message ||
                error.response
                  ?.data?.error ||
                error.message ||
                "Bulk SMS request failed.",
            });
          }
        );
      }
    }

    /* =============================================
       SUMMARY
    ============================================= */

    const successful =
      allResults.filter(
        (result) =>
          result.success
      );

    const failed =
      allResults.filter(
        (result) =>
          !result.success
      );

    return {
      success:
        failed.length === 0,

      total:
        validMessages.length,

      successful:
        successful.length,

      failed:
        failed.length,

      batches:
        batches.length,

      results:
        allResults,
    };
  } catch (error) {
    console.error(
      "[Hutch SMS] Bulk send failed:",
      error.response?.data ||
        error.message
    );

    return {
      success: false,

      total: 0,

      successful: 0,

      failed: 0,

      batches: 0,

      results: [],

      error:
        error.message ||
        "Bulk SMS sending failed.",
    };
  }
};

/* =========================================================
   TOKEN UTILITIES
========================================================= */

export const clearHutchSmsToken =
  () => {
    accessToken = null;
    refreshToken = null;

    return {
      success: true,
    };
  };

export const getHutchTokenStatus =
  () => ({
    hasAccessToken:
      Boolean(accessToken),

    hasRefreshToken:
      Boolean(refreshToken),
  });