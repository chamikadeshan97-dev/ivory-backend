/* ========================================================
   ORTHO CASE PERMANENT DELETION SERVICE
======================================================== */

import {
  getOrthoCaseByIdService,
  deleteOrthoCaseRecordService,
} from "./orthoCase.service.js";

import {
  deleteOrthoVisitsByCaseService,
} from "./orthoVisit.service.js";

import {
  deleteOrthoPaymentsByCaseService,
} from "./orthoPayment.service.js";

import {
  deleteAllOrthoMediaByCaseService,
} from "./orthoMedia.service.js";

/* ========================================================
   HELPERS
======================================================== */

const normalize = (value) =>
  String(value ?? "").trim();

/* ========================================================
   PERMANENTLY DELETE FULL ORTHO CASE
======================================================== */

export const permanentlyDeleteOrthoCaseService = async (
  caseId
) => {
  /* ----------------------------------------------------
     VALIDATE
  ---------------------------------------------------- */

  const normalizedCaseId = normalize(caseId);

  if (!normalizedCaseId) {
    const error = new Error(
      "Ortho case ID is required"
    );

    error.status = 400;

    throw error;
  }

  /* ----------------------------------------------------
     CHECK PERMANENT DELETE CONFIGURATION
  ---------------------------------------------------- */

  if (
    process.env.ENABLE_ORTHO_MEDIA_PERMANENT_DELETE !==
    "true"
  ) {
    const error = new Error(
      "Permanent Ortho deletion is disabled"
    );

    error.status = 403;

    throw error;
  }

  /* ----------------------------------------------------
     VERIFY CASE EXISTS
  ---------------------------------------------------- */

  const orthoCase = await getOrthoCaseByIdService(
    normalizedCaseId
  );

  if (!orthoCase) {
    const error = new Error(
      "Ortho case not found"
    );

    error.status = 404;

    throw error;
  }

  /* ----------------------------------------------------
     TRACK DELETION RESULTS
  ---------------------------------------------------- */

  const result = {
    case_id: orthoCase.ortho_case_id,

    patient_id: orthoCase.patient_id,

    deleted_at: "",

    media: null,

    payments: null,

    visits: null,

    case: null,
  };

  /* =====================================================
     STEP 1 — DELETE ALL MEDIA AND PHYSICAL FILES
  ===================================================== */

  result.media = await deleteAllOrthoMediaByCaseService(
    normalizedCaseId
  );

  /* =====================================================
     STEP 2 — DELETE ALL PAYMENTS
  ===================================================== */

  result.payments = await deleteOrthoPaymentsByCaseService(
    normalizedCaseId
  );

  /* =====================================================
     STEP 3 — DELETE ALL VISITS
  ===================================================== */

  result.visits = await deleteOrthoVisitsByCaseService(
    normalizedCaseId
  );

  /* =====================================================
     STEP 4 — DELETE ORTHO CASE RECORD
  ===================================================== */

  result.case = await deleteOrthoCaseRecordService(
    normalizedCaseId
  );

  if (!result.case?.deleted) {
    throw new Error(
      "Ortho case record could not be deleted"
    );
  }

  /* =====================================================
     COMPLETE
  ===================================================== */

  result.deleted_at = new Date().toISOString();

  return {
    success: true,

    message:
      "Ortho case and all related records permanently deleted",

    ...result,

    summary: {
      cases_deleted: 1,

      visits_deleted:
        result.visits?.deleted_count || 0,

      payments_deleted:
        result.payments?.deleted_count || 0,

      media_deleted:
        result.media?.deleted_count || 0,

      payment_amount_deleted:
        result.payments?.deleted_total_amount || 0,
    },
  };
};