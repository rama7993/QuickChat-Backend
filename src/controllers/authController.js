const User = require("../models/user");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const passport = require("passport");
const { getFrontendBaseUrl } = require("../utils/environment");
const { signToken } = require("../utils/jwt");
const sendEmail = require("../utils/email");
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
  sendUnauthorized,
} = require("../utils/response");
const {
  validateUser,
  validateForgotPassword,
  validateResetPassword,
} = require("../utils/validation");

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 */
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    return sendNotFound(res, "User");
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    return sendUnauthorized(res, "The password you entered is incorrect");
  }

  const token = signToken({ userId: user._id, email: user.email });

  const { password: _, ...userData } = user.toObject();
  sendSuccess(res, { user: userData, token }, "Logged in successfully");
};

/**
 * @desc    Login as demo user
 * @route   POST /api/auth/demo
 */
exports.loginDemo = async (req, res) => {
  let user = await User.findOne({ email: "guest@quickchat.com" });

  if (!user) {
    const randomPassword = crypto.randomBytes(16).toString("hex");
    user = new User({
      firstName: "Guest",
      lastName: "User",
      email: "guest@quickchat.com",
      password: randomPassword,
      username: "guest_user",
      status: "online",
    });
    await user.save();
  }

  const token = signToken({ userId: user._id, email: user.email });

  const { password: _, ...userData } = user.toObject();
  sendSuccess(
    res,
    { user: userData, token },
    "Logged in as Guest User successfully"
  );
};

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh
 */
exports.refreshToken = async (req, res) => {
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
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 */
exports.logout = (_req, res) => {
  sendSuccess(res, null, "Logged out successfully");
};

/**
 * @desc    Validate token
 * @route   GET /api/auth/validate
 */
exports.validateToken = async (req, res) => {
  const userData = {
    id: req.user._id,
    email: req.user.email,
    firstName: req.user.firstName,
    lastName: req.user.lastName,
  };
  sendSuccess(res, { valid: true, user: userData }, "Token is valid");
};

/**
 * @desc    Register user
 * @route   POST /api/auth/register
 */
exports.register = async (req, res) => {
  const { password, ...otherData } = req.body;

  try {
    validateUser(req);
  } catch (validationError) {
    return sendValidationError(res, validationError.message);
  }

  const existingUser = await User.findOne({ email: otherData.email });

  if (existingUser) {
    return sendError(res, "Email already registered.", 409);
  }

  const user = new User({ ...otherData, password });
  await user.save();

  sendSuccess(res, null, "User registered successfully!", 201);
};

/**
 * @desc    Change password
 * @route   POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
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

  if (!newPassword || newPassword.length < 8) {
    return sendValidationError(
      res,
      "Password must be at least 8 characters long"
    );
  }

  user.password = newPassword;
  await user.save();

  sendSuccess(res, null, "Password updated successfully");
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    validateForgotPassword(req);
  } catch (validationError) {
    return sendValidationError(res, validationError.message);
  }

  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return sendSuccess(
      res,
      null,
      "If an account with that email exists, a password reset link has been sent."
    );
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  user.resetPasswordToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  user.resetPasswordExpires = Date.now() + 3600000;
  await user.save();

  const resetUrl = `${getFrontendBaseUrl()}/reset-password?token=${resetToken}`;

  const message = `
    <h1>You have requested a password reset</h1>
    <p>Please go to this link to reset your password:</p>
    <a href=${resetUrl} clicktracking=off>${resetUrl}</a>
    <p>This link will expire in 1 hour.</p>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "QuickChat Password Reset Token",
      html: message,
    });

    if (process.env.NODE_ENV === "development") {
      console.log("Password reset link sent to email and logged:", resetUrl);
    }

    sendSuccess(
      res,
      null,
      "Email sent! Please check your inbox for the password reset link."
    );
  } catch (err) {
    console.error("Email send error:", err);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return sendError(res, "Email could not be sent", 500);
  }
};

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  const { token, password } = req.body;

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

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  sendSuccess(res, null, "Password has been reset successfully");
};

/**
 * @desc    Google OAuth Callback
 * @route   GET /api/auth/google/callback
 */
exports.googleCallback = (req, res) => {
  const token = req.user.getJWT();
  res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
};

/**
 * @desc    LinkedIn OAuth Callback
 * @route   GET /api/auth/linkedin/callback
 */
exports.linkedinCallback = (req, res) => {
  const token = req.user.getJWT();
  res.redirect(`${getFrontendBaseUrl()}/login-success?token=${token}`);
};
