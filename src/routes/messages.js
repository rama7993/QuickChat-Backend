const express = require("express");
const router = express.Router();
const Message = require("../models/message");
const Group = require("../models/groups");
const Notification = require("../models/notification");
const {
  getFileType,
  formatFileSize,
  generateImageThumbnail,
  generateVideoThumbnail,
  getVideoDuration,
  getAudioDuration,
  compressImage,
  compressVideo,
  cloudinary,
} = require("../utils/fileUpload");
const { authMiddleware } = require("../middlewares/auth");

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET messages between two users with pagination
router.get("/private/:userId", async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  try {
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
      deleted: false,
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl")
      .populate("replyTo", "content sender")
      .populate("reactions.user", "firstName lastName");

    // Mark messages as read
    await Message.updateMany(
      {
        sender: userId,
        receiver: currentUserId,
        readBy: { $ne: currentUserId },
      },
      {
        $push: { readBy: { user: currentUserId, readAt: new Date() } },
        $set: { status: "read" },
      }
    );

    res.json(messages.reverse());
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET group messages with pagination
router.get("/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  try {
    // Check if user is member of group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const messages = await Message.find({
      group: groupId,
      deleted: false,
    })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sender", "firstName lastName photoUrl")
      .populate("replyTo", "content sender")
      .populate("reactions.user", "firstName lastName");

    res.json(messages.reverse());
  } catch (err) {
    console.error("Failed to fetch group messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST send private message
router.post("/private", async (req, res) => {
  const { receiverId, content, replyTo } = req.body;
  const senderId = req.user._id;

  try {
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      replyTo,
      messageType: "text",
    });

    await message.save();

    const fullMessage = await message
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl")
      .populate("replyTo", "content sender");

    // Create notification
    await Notification.createNotification(
      receiverId,
      "message",
      "New Message",
      `You have a new message from ${req.user.firstName}`,
      { messageId: message._id, senderId }
    );

    // Emit to socket
    req.io.to(receiverId).emit("newMessage", fullMessage);
    req.io.to(senderId).emit("messageSent", fullMessage);

    res.status(201).json(fullMessage);
  } catch (err) {
    console.error("Failed to send message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST send group message
router.post("/group", async (req, res) => {
  const { groupId, content, replyTo } = req.body;
  const senderId = req.user._id;

  try {
    // Check if user is member of group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(senderId)) {
      return res.status(403).json({ error: "Access denied" });
    }

    const message = new Message({
      sender: senderId,
      group: groupId,
      content,
      replyTo,
      messageType: "text",
    });

    await message.save();

    const fullMessage = await message
      .populate("sender", "firstName lastName photoUrl")
      .populate("replyTo", "content sender");

    // Create notifications for all group members except sender
    const notificationPromises = group.members
      .filter((memberId) => memberId.toString() !== senderId.toString())
      .map((memberId) =>
        Notification.createNotification(
          memberId,
          "group_message",
          "New Group Message",
          `${req.user.firstName} sent a message in ${group.name}`,
          { messageId: message._id, groupId, senderId }
        )
      );

    await Promise.all(notificationPromises);

    // Emit to all group members
    group.members.forEach((memberId) => {
      req.io.to(memberId.toString()).emit("newGroupMessage", fullMessage);
    });

    res.status(201).json(fullMessage);
  } catch (err) {
    console.error("Failed to send group message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// File uploads are now handled via Socket.IO for real-time communication
// See socket.js for the upload_file event handler

// Multiple file uploads are also handled via Socket.IO

// POST add reaction to message
router.post("/:messageId/reaction", async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Remove existing reaction from this user
    message.reactions = message.reactions.filter(
      (reaction) => reaction.user.toString() !== userId.toString()
    );

    // Add new reaction
    message.reactions.push({
      user: userId,
      emoji,
    });

    await message.save();

    const fullMessage = await Message.findById(message._id)
      .populate("sender", "firstName lastName photoUrl")
      .populate("reactions.user", "firstName lastName");

    // Emit reaction update
    if (message.group) {
      const group = await Group.findById(message.group);
      group.members.forEach((memberId) => {
        req.io.to(memberId.toString()).emit("messageReaction", fullMessage);
      });
    } else if (message.receiver) {
      req.io
        .to(message.receiver.toString())
        .emit("messageReaction", fullMessage);
      req.io.to(message.sender.toString()).emit("messageReaction", fullMessage);
    }

    res.json(fullMessage);
  } catch (err) {
    console.error("Failed to add reaction:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT edit message
router.put("/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    message.content = content;
    message.edited = true;
    message.editedAt = new Date();

    await message.save();

    const fullMessage = await message
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl")
      .populate("group", "name");

    // Emit message edit
    if (message.group) {
      const group = await Group.findById(message.group);
      group.members.forEach((memberId) => {
        req.io.to(memberId.toString()).emit("messageEdited", fullMessage);
      });
    } else if (message.receiver) {
      req.io.to(message.receiver.toString()).emit("messageEdited", fullMessage);
      req.io.to(message.sender.toString()).emit("messageEdited", fullMessage);
    }

    res.json(fullMessage);
  } catch (err) {
    console.error("Failed to edit message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE message
router.delete("/:messageId", async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    message.deleted = true;
    message.deletedAt = new Date();
    message.content = "This message was deleted";

    await message.save();

    // Emit message deletion
    if (message.group) {
      const group = await Group.findById(message.group);
      group.members.forEach((memberId) => {
        req.io.to(memberId.toString()).emit("messageDeleted", message);
      });
    } else if (message.receiver) {
      req.io.to(message.receiver.toString()).emit("messageDeleted", message);
      req.io.to(message.sender.toString()).emit("messageDeleted", message);
    }

    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Failed to delete message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET search messages
router.get("/search/:query", async (req, res) => {
  const { query } = req.params;
  const userId = req.user._id;
  const { groupId, userId: otherUserId } = req.query;

  try {
    let searchQuery = {
      $or: [
        { sender: userId },
        { receiver: userId },
        {
          group: { $in: await Group.find({ members: userId }).distinct("_id") },
        },
      ],
      content: { $regex: query, $options: "i" },
      deleted: false,
    };

    if (groupId) {
      searchQuery.group = groupId;
    } else if (otherUserId) {
      searchQuery = {
        $or: [
          { sender: userId, receiver: otherUserId },
          { sender: otherUserId, receiver: userId },
        ],
        content: { $regex: query, $options: "i" },
        deleted: false,
      };
    }

    const messages = await Message.find(searchQuery)
      .sort({ timestamp: -1 })
      .limit(50)
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl")
      .populate("group", "name");

    res.json(messages);
  } catch (err) {
    console.error("Failed to search messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
