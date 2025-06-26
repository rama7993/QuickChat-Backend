const cors = require("cors");

const getBackendBaseUrl = () => {
  const backends = process.env.BACKEND_BASE_URL?.split(",") || [];
  const isProduction = process.env.NODE_ENV === "production";

  const selected = isProduction ? backends[1] : backends[0];

  if (!selected && !isProduction) {
    console.warn("⚠️ BACKEND_BASE_URL is not properly set.");
  }

  return selected || "";
};

const getFrontendBaseUrl = () => {
  const origins = process.env.CORS_ORIGIN?.split(",") || [];
  const isProduction = process.env.NODE_ENV === "production";

  const selected = isProduction ? origins[1] : origins[0];

  if (!selected && !isProduction) {
    console.warn("⚠️ CORS_ORIGIN is not properly set.");
  }

  return selected || "";
};

const configureCors = () => {
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || [];

  return cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  });
};

module.exports = {
  getBackendBaseUrl,
  getFrontendBaseUrl,
  configureCors,
};
