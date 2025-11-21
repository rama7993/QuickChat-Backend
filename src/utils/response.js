/**
 * Response Utility Functions
 * Standardized API response formatting
 */

/**
 * Send success response
 */
const sendSuccess = (
  res,
  data = null,
  message = "Success",
  statusCode = 200
) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send error response
 */
const sendError = (
  res,
  message = "An error occurred",
  statusCode = 500,
  error = null
) => {
  const response = {
    success: false,
    error: message,
    message,
  };

  if (error && process.env.NODE_ENV === "development") {
    response.details = error.message;
  }

  return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 */
const sendValidationError = (res, errors, message = "Validation failed") => {
  return res.status(400).json({
    success: false,
    error: "Validation error",
    message,
    errors: Array.isArray(errors) ? errors : [errors],
  });
};

/**
 * Send not found response
 */
const sendNotFound = (res, resource = "Resource") => {
  return res.status(404).json({
    success: false,
    error: "Not found",
    message: `${resource} not found`,
  });
};

/**
 * Send unauthorized response
 */
const sendUnauthorized = (res, message = "Unauthorized access") => {
  return res.status(401).json({
    success: false,
    error: "Unauthorized",
    message,
  });
};

/**
 * Send forbidden response
 */
const sendForbidden = (res, message = "Forbidden") => {
  return res.status(403).json({
    success: false,
    error: "Forbidden",
    message,
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
  sendForbidden,
};
