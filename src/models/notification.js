const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "message",
        "group_invite",
        "friend_request",
        "group_message",
        "message_reaction",
        "message_reply",
        "group_admin",
        "system",
      ],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 100,
    },
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    data: {
      // Flexible data object for different notification types
      messageId: mongoose.Schema.Types.ObjectId,
      groupId: mongoose.Schema.Types.ObjectId,
      senderId: mongoose.Schema.Types.ObjectId,
      actionUrl: String,
      metadata: mongoose.Schema.Types.Mixed,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    expiresAt: Date,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Method to mark as read
notificationSchema.methods.markAsRead = function () {
  this.read = true;
  this.readAt = new Date();
  return this.save();
};

// Static method to create notification
notificationSchema.statics.createNotification = async function (
  userId,
  type,
  title,
  message,
  data = {}
) {
  const notification = new this({
    user: userId,
    type,
    title,
    message,
    data,
  });

  return await notification.save();
};

module.exports = mongoose.model("Notification", notificationSchema);
