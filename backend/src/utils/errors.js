/**
 * Consistent error shape used across the whole API:
 *   { "error": { "message": "string", "code": "string" } }
 */

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { message, code } });
}

function notFound(res, message = "Resource not found") {
  return sendError(res, 404, "NOT_FOUND", message);
}

function badRequest(res, code, message) {
  return sendError(res, 400, code, message);
}

// Express error-handling middleware (must have 4 args to be recognized as such).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.code, err.message);
  }
  console.error("Unhandled error:", err);
  return sendError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
}

module.exports = { ApiError, sendError, notFound, badRequest, errorHandler };
