const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { verifyToken } = require("../utils/jwt");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Access denied. No token provided.",
      });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token format.",
      });
    }

    // Verify token
    const decoded = verifyToken(token);
    // Extract userId from token (supports both userId and id fields)
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token structure.",
      });
    }

    // Find the user by ID
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found.",
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Forbidden",
        message: "User account is deactivated.",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token.",
      });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Token has expired.",
      });
    }
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication failed.",
    });
  }
};

module.exports = { authMiddleware };
