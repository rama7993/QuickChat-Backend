const User = require("../models/user");
const { sendSuccess, sendNotFound, sendForbidden } = require("../utils/response");

/**
 * @desc    Get all users (filtered to exclude sensitive data)
 * @route   GET /api/users
 */
exports.getUsers = async (req, res) => {
  const users = await User.find()
    .select("-password -friendRequests -blockedUsers")
    .limit(100)
    .lean();
  sendSuccess(res, users, "Users retrieved successfully");
};

/**
 * @desc    Get current authenticated user
 * @route   GET /api/users/me
 */
exports.getMe = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select("-password -friendRequests -blockedUsers")
    .lean();
  if (!user) {
    return sendNotFound(res, "User");
  }
  sendSuccess(res, user, "User retrieved successfully");
};

/**
 * @desc    Get a user by ID
 * @route   GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  const user = await User.findById(req.params.id)
    .select("-password -friendRequests -blockedUsers")
    .lean();
  if (!user) {
    return sendNotFound(res, "User");
  }
  sendSuccess(res, user, "User retrieved successfully");
};

/**
 * @desc    Update user profile (authenticated users only)
 * @route   PUT /api/users/:id
 */
exports.updateProfile = async (req, res) => {
  if (req.user._id.toString() !== req.params.id) {
    return sendForbidden(res, "You can only update your own profile");
  }

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
};

/**
 * @desc    Partially update a user by ID (admin only)
 * @route   PATCH /api/users/:id
 */
exports.patchUser = async (req, res) => {
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
};
