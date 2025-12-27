/**
 * Error Handler Utility
 * Centralized error handling and logging
 */

const logger = {
  error: (message, error) => {
    console.error(`[ERROR] ${message}`, error);
  },
  warn: (message) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`);
    }
  },
  info: (message) => {
    if (process.env.NODE_ENV === "development") {
      console.log(`[INFO] ${message}`);
    }
  },
};

/**
 * Handle async route errors
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Global error handler middleware
 */
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    logger.error("Error occurred:", err);
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      stack: err.stack,
    });
  }

  // Production error handling
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Unknown errors
  logger.error("Unexpected error:", err);
  return res.status(500).json({
    success: false,
    error: "Something went wrong",
  });
};

module.exports = {
  logger,
  asyncHandler,
  AppError,
  globalErrorHandler,
};
