const jwt = require("jsonwebtoken");

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is required. Please set it in your .env file."
    );
  }
  return secret;
};

const getJWTExpiration = () => {
  return process.env.JWT_EXPIRATION || "7d";
};

const signToken = (payload) => {
  return jwt.sign(payload, getJWTSecret(), {
    expiresIn: getJWTExpiration(),
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, getJWTSecret());
};

module.exports = {
  getJWTSecret,
  getJWTExpiration,
  signToken,
  verifyToken,
};
