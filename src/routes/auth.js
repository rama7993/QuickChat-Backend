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
const { getFrontendBaseUrl } = require("../utils/environment");

// Initialize Passport
router.use(passport.initialize());

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).send("User not found");

    const isValid = await user.validatePassword(password);
    if (!isValid) return res.status(401).send("Invalid password");

    const token = await user.getJWT();

    const { password: _, ...userData } = user.toObject();
    res.status(200).json({ message: "Logged in", user: userData, token });
  } catch (err) {
    res.status(400).send("Error: " + err.message);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Dummy logout (frontend clears localStorage)
 */
router.post("/logout", (_req, res) => {
  res.status(200).send("Logged out successfully");
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

    const existingUser = await User.findOne({ email: otherData.email });
    if (existingUser) {
      return res.status(409).json({ error: "Email already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

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
 * @desc    Change user password
 */
router.post("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).send("User not found");

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) return res.status(400).send("Old password is incorrect");

    user.password = await bcrypt.hash(newPassword, saltRounds);
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
    const token = req.user.getJWT();
    res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
  }
);

/** ---------- LINKEDIN AUTH ---------- */
router.get("/linkedin", passport.authenticate("linkedin", { session: false }));

router.get(
  "/linkedin/callback",
  passport.authenticate("linkedin", {
    session: false,
    failureRedirect: "/login",
  }),
  (req, res) => {
    const token = req.user.getJWT();
    res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
  }
);

module.exports = router;
