const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authMiddleware } = require("../middlewares/auth");
const { validateUser } = require("../utils/validation");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const passport = require("passport");
const jwt = require("jsonwebtoken");
require("../lib/passport");
const { setTokenCookie, clearTokenCookie } = require("../utils/token");
const { getFrontendBaseUrl } = require("../utils/environment");

// Initialize Passport
router.use(passport.initialize());

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const isValid = await user.validatePassword(password);
    if (!isValid) return res.status(401).send("Invalid password");

    const token = await user.getJWT();
    setTokenCookie(res, token);

    const { password: _, ...userData } = user.toObject();
    res.status(200).json({ message: "Logged in", user: userData });
  } catch (err) {
    res.status(400).send("Error: " + err.message);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 */
router.post("/logout", (req, res) => {
  try {
    clearTokenCookie(res);
    res.status(200).send("Logged out successfully");
  } catch (error) {
    res.status(400).send("Error: " + error.message);
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post("/register", async (req, res) => {
  try {
    const { password, ...otherData } = req.body;

    // Validate user input
    try {
      validateUser(req);
    } catch (validationError) {
      return res.status(400).json({ error: validationError.message });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: otherData.email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save new user
    const user = new User({ ...otherData, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: "User registered successfully!" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "An error occurred during registration." });
  }
});

/**
 * @route   POST /api/auth/change-password
 * @desc    Change Password
 */
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send("User not found");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).send("Old password is incorrect");

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.send("Password updated successfully");
  } catch (err) {
    res.status(500).send("Error: " + err.message);
  }
});

/** ---------- GOOGLE AUTH ---------- */
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    setTokenCookie(res, token);
    res.redirect(`${getFrontendBaseUrl()}/login-success`);
  }
);

/** ---------- LINKEDIN AUTH ---------- */
router.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    setTokenCookie(res, token);
    res.redirect(`${getFrontendBaseUrl()}/login-success`);
  }
);

module.exports = router;
