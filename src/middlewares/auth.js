const jwt = require("jsonwebtoken");
const User = require("../models/user");

const SECRET_KEY = process.env.JWT_SECRET;

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check if header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).send("Access denied. No token provided.");
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, SECRET_KEY);
    const { id: userId } = decoded;

    // Find the user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    return res.status(401).send("Invalid token or user not authenticated.");
  }
};

module.exports = { authMiddleware };
