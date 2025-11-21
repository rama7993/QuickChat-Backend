const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authMiddleware } = require("../middlewares/auth");
const { validateUser } = require("../utils/validation");
const {
  sendSuccess,
  sendError,
  sendNotFound,
  sendForbidden,
} = require("../utils/response");
const { asyncHandler } = require("../utils/errorHandler");

/**
 * @route   GET /api/users
 * @desc    Get all users (filtered to exclude sensitive data)
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const users = await User.find()
      .select("-password -friendRequests -blockedUsers")
      .limit(100)
      .lean();
    sendSuccess(res, users, "Users retrieved successfully");
  })
);

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user
 */
router.get(
  "/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .select("-password -friendRequests -blockedUsers")
      .lean();
    if (!user) {
      return sendNotFound(res, "User");
    }
    sendSuccess(res, user, "User retrieved successfully");
  })
);

/**
 * @route   GET /api/users/:id
 * @desc    Get a user by ID
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id)
      .select("-password -friendRequests -blockedUsers")
      .lean();
    if (!user) {
      return sendNotFound(res, "User");
    }
    sendSuccess(res, user, "User retrieved successfully");
  })
);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile (authenticated users only)
 */
router.put(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    // Check if user is updating their own profile
    if (req.user._id.toString() !== req.params.id) {
      return sendForbidden(res, "You can only update your own profile");
    }

    // Define allowed fields for profile update
    const allowedFields = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      gender: req.body.gender,
      bio: req.body.bio,
      age: req.body.age,
      statusMessage: req.body.statusMessage,
      photoUrl: req.body.photoUrl,
      address: req.body.address,
      notificationSettings: req.body.notificationSettings,
      privacySettings: req.body.privacySettings,
      preferences: req.body.preferences,
    };

    // Remove undefined values
    Object.keys(allowedFields).forEach((key) => {
      if (allowedFields[key] === undefined) {
        delete allowedFields[key];
      }
    });

    const user = await User.findByIdAndUpdate(req.params.id, allowedFields, {
      new: true,
      runValidators: true,
    }).select("-password -friendRequests -blockedUsers");

    if (!user) {
      return sendNotFound(res, "User");
    }

    sendSuccess(res, user, "Profile updated successfully");
  })
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Partially update a user by ID (admin only)
 */
router.patch(
  "/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    // Only allow admins or the user themselves to patch
    if (req.user._id.toString() !== req.params.id && !req.user.isAdmin) {
      return sendForbidden(res, "You can only update your own profile");
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).select("-password -friendRequests -blockedUsers");

    if (!user) {
      return sendNotFound(res, "User");
    }

    sendSuccess(res, user, "User updated successfully");
  })
);

module.exports = router;
