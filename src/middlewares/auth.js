const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { verifyToken } = require("../utils/jwt");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token format.",
      });
    }

    const decoded = verifyToken(token);
    const userId = decoded.userId || decoded.id;

    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token structure.",
      });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: "Forbidden",
        message: "User account is deactivated.",
      });
    }

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
