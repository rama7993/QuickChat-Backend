const express = require("express");
const router = express.Router();
const Notification = require("../models/notification");
const { authMiddleware } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET user notifications with pagination
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { type, read } = req.query;

    let query = { user: req.user._id };

    if (type) {
      query.type = type;
    }

    if (read !== undefined) {
      query.read = read === "true";
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("data.senderId", "firstName lastName photoUrl")
      .populate("data.groupId", "name avatar");

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET unread notifications count
router.get("/unread-count", async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      read: false,
    });

    res.json({ count });
  } catch (err) {
    console.error("Failed to get unread count:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT mark notification as read
router.put("/:notificationId/read", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    await notification.markAsRead();

    res.json(notification);
  } catch (err) {
    console.error("Failed to mark notification as read:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT mark all notifications as read
router.put("/mark-all-read", async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true, readAt: new Date() }
    );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Failed to mark all notifications as read:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE notification
router.delete("/:notificationId", async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    if (notification.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    await Notification.findByIdAndDelete(req.params.notificationId);

    res.json({ message: "Notification deleted successfully" });
  } catch (err) {
    console.error("Failed to delete notification:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE all notifications
router.delete("/", async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    res.json({ message: "All notifications deleted successfully" });
  } catch (err) {
    console.error("Failed to delete all notifications:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET notification settings
router.get("/settings", async (req, res) => {
  try {
    const user = req.user;
    res.json(user.notificationSettings);
  } catch (err) {
    console.error("Failed to get notification settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT update notification settings
router.put("/settings", async (req, res) => {
  try {
    const { notificationSettings } = req.body;
    const user = req.user;

    user.notificationSettings = {
      ...user.notificationSettings,
      ...notificationSettings,
    };

    await user.save();

    res.json(user.notificationSettings);
  } catch (err) {
    console.error("Failed to update notification settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
