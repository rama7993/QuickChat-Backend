const cors = require("cors");

const getBackendBaseUrl = () => {
  const backends = process.env.BACKEND_BASE_URL?.split(",") || [];
  const isProduction = process.env.NODE_ENV === "production";

  const selected = isProduction ? backends[1] : backends[0];

  if (!selected && !isProduction) {
    console.warn("⚠️ BACKEND_BASE_URL is not properly set.");
  }

  return selected || "http://localhost:3000";
};

const getFrontendBaseUrl = () => {
  const origins = process.env.CORS_ORIGIN?.split(",") || [];
  const isProduction = process.env.NODE_ENV === "production";

  const selected = isProduction ? origins[1] : origins[0];

  if (!selected && !isProduction) {
    console.warn("⚠️ CORS_ORIGIN is not properly set.");
  }

  return selected || "http://localhost:4200";
};

const configureCors = () => {
  const allowedOrigins =
    process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) || [];

  // Default allowed origins for development
  const defaultOrigins = [
    "http://localhost:4200",
    "http://localhost:3000",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:3000",
  ];

  // Combine environment origins with defaults (remove duplicates)
  const allAllowedOrigins = [
    ...new Set([...allowedOrigins, ...defaultOrigins]),
  ];

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allAllowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // In development, be more permissive
        if (process.env.NODE_ENV === "development") {
          console.warn(`⚠️ Allowing CORS for ${origin} in development mode`);
          callback(null, true);
        } else {
          console.warn(`❌ Blocked by CORS: ${origin}`);
          callback(new Error("Not allowed by CORS"));
        }
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
};

module.exports = {
  getBackendBaseUrl,
  getFrontendBaseUrl,
  configureCors,
};
