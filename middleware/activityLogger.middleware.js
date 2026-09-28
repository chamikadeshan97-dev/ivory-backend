import { writeActivityLog } from "../services/googleSheetsLogger.service.js";

const METHOD_ACTIONS = {
  POST: "CREATE",
  PUT: "UPDATE",
  PATCH: "UPDATE",
  DELETE: "DELETE",
};

export function activityLogger(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }

  const startedAt = Date.now();

  res.on("finish", async () => {
    try {
      const module =
        req.baseUrl?.split("/").filter(Boolean).pop()?.toUpperCase() ||
        "SYSTEM";

      const action = METHOD_ACTIONS[req.method] || req.method;

      const user =
        req.user?.username ||
        req.headers["x-user-name"] ||
        "Unknown";

      const status =
        res.statusCode >= 200 && res.statusCode < 400
          ? "SUCCESS"
          : "FAILED";

      const duration = Date.now() - startedAt;

      const details =
        `${req.method} ${req.originalUrl} (${duration}ms)`;

      const ipAddress =
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress ||
        "";

      await writeActivityLog({
        user,
        method: req.method,
        module,
        action,
        details,
        ipAddress,
        status,
      });
    } catch {
      // Activity logging failure must not affect the main request.
    }
  });

  next();
}