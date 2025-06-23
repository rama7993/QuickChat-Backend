const cors = require("cors");

const getBackendBaseUrl = () => {
  const backends = process.env.BACKEND_BASE_URL?.split(",") || [];
  const isProduction = process.env.NODE_ENV === "production";
  return isProduction ? backends[1] : backends[0];
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
  configureCors,
};
