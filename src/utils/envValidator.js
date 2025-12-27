/**
 * Validates required environment variables on startup
 */
const validateEnvironment = () => {
  const required = {
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  const optional = {
    PORT: process.env.PORT || "3000",
    NODE_ENV: process.env.NODE_ENV || "development",
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    JWT_EXPIRATION: process.env.JWT_EXPIRATION || "7d",
    SALT_ROUNDS: process.env.SALT_ROUNDS || "10",
  };

  const missing = [];
  const warnings = [];

  // Check required variables
  for (const [key, value] of Object.entries(required)) {
    if (!value) {
      missing.push(key);
    }
  }

  // Check for default/placeholder values
  if (
    required.JWT_SECRET ===
    "your-super-secret-jwt-key-change-this-in-production"
  ) {
    warnings.push(
      "JWT_SECRET is using default value. Please change it in production!"
    );
  }

  // Check optional but recommended
  if (!process.env.CORS_ORIGIN) {
    warnings.push(
      "CORS_ORIGIN not set. Defaulting to allow all origins (not recommended for production)"
    );
  }

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach((key) => console.error(`   - ${key}`));
    console.error("\nPlease set these in your .env file");
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn("⚠️  Environment warnings:");
    warnings.forEach((warning) => console.warn(`   - ${warning}`));
  }

  console.log("✅ Environment variables validated");
  return { required, optional };
};

module.exports = { validateEnvironment };
