const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authMiddleware } = require("../middlewares/auth");
const {
  validateUser,
  validateForgotPassword,
  validateResetPassword,
} = require("../utils/validation");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const saltRounds = parseInt(process.env.SALT_ROUNDS, 10) || 10;
const passport = require("passport");
const { getFrontendBaseUrl } = require("../utils/environment");
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
} = require("../utils/response");
const { asyncHandler } = require("../utils/errorHandler");

// Initialize Passport
router.use(passport.initialize());

/**
 * @route   POST /api/auth/login
 * @desc    Login user and return JWT
 */
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return sendNotFound(res, "User");
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      return sendUnauthorized(res, "The password you entered is incorrect");
    }

    const { signToken } = require("../utils/jwt");
    const token = signToken({ userId: user._id, email: user.email });

    const { password: _, ...userData } = user.toObject();
    sendSuccess(res, { user: userData, token }, "Logged in successfully");
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh JWT token
 */
router.post(
  "/refresh",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { signToken } = require("../utils/jwt");
    const token = signToken({ userId: req.user._id, email: req.user.email });

    const userData = {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      username: req.user.username,
      photoUrl: req.user.photoUrl,
    };

    sendSuccess(res, { token, user: userData }, "Token refreshed successfully");
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Dummy logout (frontend clears localStorage)
 */
router.post("/logout", (_req, res) => {
  sendSuccess(res, null, "Logged out successfully");
});

/**
 * @route   GET /api/auth/validate
 * @desc    Validate JWT token
 */
router.get(
  "/validate",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userData = {
      id: req.user._id,
      email: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
    };
    sendSuccess(res, { valid: true, user: userData }, "Token is valid");
  })
);

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 */
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { password, ...otherData } = req.body;

    // Validate user input
    try {
      validateUser(req);
    } catch (validationError) {
      return sendValidationError(res, validationError.message);
    }

    const existingUser = await User.findOne({ email: otherData.email });

    if (existingUser) {
      return sendError(res, "Email already registered.", 409);
    }

    // Create user in database (password will be hashed by pre-save hook)
    const user = new User({ ...otherData, password });
    await user.save();

    sendSuccess(res, null, "User registered successfully!", 201);
  })
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change user password
 */
router.post(
  "/change-password",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return sendNotFound(res, "User");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return sendError(
        res,
        "The current password you entered is incorrect",
        400
      );
    }

    // Validate new password length
    if (!newPassword || newPassword.length < 8) {
      return sendValidationError(
        res,
        "Password must be at least 8 characters long"
      );
    }

    user.password = newPassword; // Will be hashed by pre-save hook
    await user.save();

    sendSuccess(res, null, "Password updated successfully");
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 */
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    // Validate request
    try {
      validateForgotPassword(req);
    } catch (validationError) {
      return sendValidationError(res, validationError.message);
    }

    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration
    if (!user) {
      return sendSuccess(
        res,
        null,
        "If an account with that email exists, a password reset link has been sent."
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // In development, log the reset link
    const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;
    if (process.env.NODE_ENV === "development") {
      console.log("Password reset link:", resetUrl);
    }

    // TODO: Send email with reset link in production
    // await sendPasswordResetEmail(user.email, resetUrl);

    sendSuccess(
      res,
      null,
      "If an account with that email exists, a password reset link has been sent."
    );
  })
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 */
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    // Validate request
    try {
      validateResetPassword(req);
    } catch (validationError) {
      return sendValidationError(res, validationError.message);
    }

    const { token, password } = req.body;

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return sendError(
        res,
        "The password reset link is invalid or has expired. Please request a new one.",
        400
      );
    }

    // Update password (will be hashed by pre-save hook)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    sendSuccess(res, null, "Password has been reset successfully");
  })
);

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
