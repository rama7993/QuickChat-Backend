const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authMiddleware } = require("../middlewares/auth");
const { validateUser } = require("../utils/validation");
const bcrypt = require("bcrypt");
const saltRounds = parseInt(process.env.SALT_ROUNDS, 10) || 10; // Use same salt rounds as User model
const passport = require("passport");
const jwt = require("jsonwebtoken");
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

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "No account found with this email address",
      });
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return res.status(401).json({
        error: "Invalid password",
        message: "The password you entered is incorrect",
      });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET ||
        "your-super-secret-jwt-key-change-this-in-production",
      { expiresIn: process.env.JWT_EXPIRATION || "7d" }
    );

    const { password: _, ...userData } = user;
    res.status(200).json({ message: "Logged in", user: userData, token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(400).json({
      error: "Login failed",
      message: "An error occurred during login: " + err.message,
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 */
router.post("/refresh", authMiddleware, async (req, res) => {
  try {
    // Generate new token with same user data
    const token = jwt.sign(
      { userId: req.user._id, email: req.user.email },
      process.env.JWT_SECRET ||
        "your-super-secret-jwt-key-change-this-in-production",
      { expiresIn: process.env.JWT_EXPIRATION || "7d" }
    );

    res.status(200).json({
      message: "Token refreshed successfully",
      token,
      user: {
        id: req.user._id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
        photoUrl: req.user.photoUrl,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Error refreshing token" });
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
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token
 */
router.get("/validate", authMiddleware, (req, res) => {
  res.json({
    valid: true,
    user: {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    },
  });
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

    // Create user in database
    const user = new User({ ...otherData, password: password }); // Let the model handle hashing
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

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account not found",
      });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid old password",
        message: "The current password you entered is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, saltRounds);
    await user.save();

    res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
  } catch (err) {
    res.status(500).json({
      error: "Password update failed",
      message: "An error occurred while updating password: " + err.message,
    });
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
    // Always create a new token for OAuth login
    // This ensures the token has the current expiration time
    const token = req.user.getJWT();
    res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
  }
);

/** ---------- LINKEDIN AUTH ---------- */
router.get("/linkedin", passport.authenticate("linkedin", { session: false }));

router.get(
  "/linkedin/callback",
  (req, res, next) => {
    // Check for OAuth errors first
    if (req.query.error) {
      return res.redirect(
        `${getFrontendBaseUrl()}/login?error=linkedin_oauth_error&message=${encodeURIComponent(
          req.query.error_description || req.query.error
        )}`
      );
    }
    next();
  },
  passport.authenticate("linkedin", {
    session: false,
    failureRedirect: `${getFrontendBaseUrl()}/login?error=linkedin_auth_failed`,
  }),
  (req, res) => {
    const token = req.user.getJWT();
    res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
  }
);

module.exports = router;
