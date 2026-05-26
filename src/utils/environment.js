const cors = require("cors");

const getBackendBaseUrl = () =>
  process.env.BACKEND_URL || "http://localhost:3000";
const getFrontendBaseUrl = () =>
  process.env.FRONTEND_URL || "http://localhost:4200";

const configureCors = () => {
  const allowedOrigins = [
    ...(process.env.FRONTEND_URL?.split(",").map((o) => o.trim()) || []),
    "http://localhost:4200",
    "http://localhost:3000",
    "http://127.0.0.1:4200",
    "http://127.0.0.1:3000",
  ];

  return cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV === "development"
      ) {
        return callback(null, true);
      }
      console.warn(`❌ Blocked by CORS: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Range", "X-Content-Range"],
    optionsSuccessStatus: 204,
  });
};

module.exports = {
  getBackendBaseUrl,
  getFrontendBaseUrl,
  configureCors,
};
