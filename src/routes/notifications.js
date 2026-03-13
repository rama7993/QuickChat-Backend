const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/auth");
const notificationController = require("../controllers/notificationController");

router.use(authMiddleware);

router.get("/", notificationController.getNotifications);

router.get("/unread-count", notificationController.getUnreadCount);

router.put("/:notificationId/read", notificationController.markAsRead);

router.put("/mark-all-read", notificationController.markAllRead);

router.delete("/:notificationId", notificationController.deleteNotification);

router.delete("/", notificationController.deleteAllNotifications);

router.get("/settings", notificationController.getSettings);

router.put("/settings", notificationController.updateSettings);

module.exports = router;
