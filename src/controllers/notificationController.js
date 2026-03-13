const Notification = require("../models/notification");

/**
 * @desc    Get user notifications with pagination
 * @route   GET /api/notifications
 */
exports.getNotifications = async (req, res) => {
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
};

/**
 * @desc    Get unread notifications count
 * @route   GET /api/notifications/unread-count
 */
exports.getUnreadCount = async (req, res) => {
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
};

/**
 * @desc    Mark a notification as read
 * @route   PUT /api/notifications/:notificationId/read
 */
exports.markAsRead = async (req, res) => {
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
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/mark-all-read
 */
exports.markAllRead = async (req, res) => {
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
};

/**
 * @desc    Delete a notification
 * @route   DELETE /api/notifications/:notificationId
 */
exports.deleteNotification = async (req, res) => {
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
};

/**
 * @desc    Delete all notifications for the user
 * @route   DELETE /api/notifications
 */
exports.deleteAllNotifications = async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id });

    res.json({ message: "All notifications deleted successfully" });
  } catch (err) {
    console.error("Failed to delete all notifications:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @desc    Get notification settings
 * @route   GET /api/notifications/settings
 */
exports.getSettings = async (req, res) => {
  try {
    const user = req.user;
    res.json(user.notificationSettings);
  } catch (err) {
    console.error("Failed to get notification settings:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * @desc    Update notification settings
 * @route   PUT /api/notifications/settings
 */
exports.updateSettings = async (req, res) => {
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
};
