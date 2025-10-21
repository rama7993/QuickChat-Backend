const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { authMiddleware } = require("../middlewares/auth");
const { validateUser } = require("../utils/validation");

/**
 * @route   GET /api/users
 * @desc    Get all users
 */
router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (error) {
    res.status(400).send("Error: " + error.message);
  }
});

/**
 * @route   GET /api/users/me
 * @desc    Get current authenticated user
 */
router.get("/me", authMiddleware, async (req, res) => {
  res.status(200).json(req.user);
});

/**
 * @route   GET /api/users/:id
 * @desc    Get a user by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).send("User not found");
    res.status(200).json(user);
  } catch (error) {
    res.status(400).send("Error: " + error.message);
  }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Update user profile (authenticated users only)
 */
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    // Check if user is updating their own profile
    if (req.user._id.toString() !== req.params.id) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only update your own profile",
      });
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
    });

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "Profile updated successfully!",
      user,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
});

/**
 * @route   PATCH /api/users/:id
 * @desc    Partially update a user by ID (admin only)
 */
router.patch("/:id", authMiddleware, async (req, res) => {
  try {
    // Only allow admins or the user themselves to patch
    if (req.user._id.toString() !== req.params.id && !req.user.isAdmin) {
      return res.status(403).json({
        error: "Forbidden",
        message: "You can only update your own profile",
      });
    }

    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return res.status(404).json({
        error: "Not Found",
        message: "User not found",
      });
    }

    res.status(200).json({
      message: "User updated!",
      user,
    });
  } catch (error) {
    console.error("User patch error:", error);
    res.status(400).json({
      error: "Bad Request",
      message: error.message,
    });
  }
});

module.exports = router;
