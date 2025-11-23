const express = require("express");
const router = express.Router();
const Message = require("../models/message");
const Group = require("../models/groups");
const Notification = require("../models/notification");
const { getFileType, cloudinary } = require("../utils/fileUpload");
const { authMiddleware } = require("../middlewares/auth");
const {
  sendSuccess,
  sendError,
  sendValidationError,
  sendNotFound,
} = require("../utils/response");
const { asyncHandler } = require("../utils/errorHandler");

// Apply auth middleware to all routes
router.use(authMiddleware);

// GET messages between two users with pagination
router.get(
  "/conversations",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Aggregate private messages
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          group: null, // Exclude group messages (handled separately or mixed if needed)
          deleted: { $ne: true }, // Exclude deleted messages
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", userId] },
              "$receiver",
              "$sender",
            ],
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiver", userId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: "$userDetails",
      },
      {
        $project: {
          _id: 1,
          lastMessage: 1,
          unreadCount: 1,
          "userDetails.firstName": 1,
          "userDetails.lastName": 1,
          "userDetails.username": 1,
          "userDetails.email": 1,
          "userDetails.photoUrl": 1,
          "userDetails.status": 1,
          "userDetails.lastSeen": 1,
        },
      },
      {
        $sort: { "lastMessage.timestamp": -1 },
      },
    ]);

    res.json(conversations);
  })
);

router.get(
  "/private/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

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
      .populate("reactions.user", "firstName lastName")
      .lean();

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

    sendSuccess(res, messages.reverse(), "Messages retrieved successfully");
  })
);

// GET group messages with pagination
router.get(
  "/group/:groupId",
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    // Check if user is member of group
    const group = await Group.findById(groupId);
    if (!group || !group.members.includes(req.user._id)) {
      return sendError(res, "Access denied", 403);
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
      .populate("reactions.user", "firstName lastName")
      .lean();

    sendSuccess(
      res,
      messages.reverse(),
      "Group messages retrieved successfully"
    );
  })
);

// POST send private message
router.post(
  "/private",
  asyncHandler(async (req, res) => {
    const { receiverId, content, replyTo } = req.body;
    const senderId = req.user._id;

    // Validation
    if (!receiverId) {
      return sendValidationError(res, "Receiver ID is required");
    }

    if (!content && !replyTo) {
      return sendValidationError(res, "Message content is required");
    }

    // Validate receiverId is a valid ObjectId
    if (!require("mongoose").Types.ObjectId.isValid(receiverId)) {
      return sendValidationError(res, "Invalid receiver ID format");
    }

    // Check if user is trying to message themselves
    if (senderId.toString() === receiverId) {
      return sendError(res, "Cannot send message to yourself", 400);
    }

    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content: content || "",
      replyTo: replyTo || null,
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
      { messageId: message._id, senderId },
      req.io
    );

    // Emit to socket
    req.io.to(receiverId).emit("newMessage", fullMessage);
    req.io.to(senderId).emit("messageSent", fullMessage);

    sendSuccess(res, fullMessage, "Message sent successfully", 201);
  })
);

// POST send group message
router.post(
  "/group",
  asyncHandler(async (req, res) => {
    const { groupId, content, replyTo } = req.body;
    const senderId = req.user._id;

    // Validation
    if (!groupId) {
      return sendValidationError(res, "Group ID is required");
    }

    if (!content && !replyTo) {
      return sendValidationError(res, "Message content is required");
    }

    // Validate groupId format
    if (!require("mongoose").Types.ObjectId.isValid(groupId)) {
      return sendValidationError(res, "Invalid group ID format");
    }

    // Check if user is member of group
    const group = await Group.findById(groupId);
    if (!group) {
      return sendNotFound(res, "Group");
    }

    if (!group.members.includes(senderId)) {
      return sendError(
        res,
        "Access denied. You are not a member of this group.",
        403
      );
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
          { messageId: message._id, groupId, senderId },
          req.io
        )
      );

    await Promise.all(notificationPromises);

    // Emit to all group members
    group.members.forEach((memberId) => {
      req.io.to(memberId.toString()).emit("newGroupMessage", fullMessage);
    });

    sendSuccess(res, fullMessage, "Group message sent successfully", 201);
  })
);

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

  // Validation
  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: "Message content cannot be empty" });
  }

  // Validate messageId format
  if (!require("mongoose").Types.ObjectId.isValid(messageId)) {
    return res.status(400).json({ error: "Invalid message ID format" });
  }

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (message.deleted) {
      return res.status(400).json({ error: "Cannot edit deleted message" });
    }

    message.content = content.trim();
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

    await Message.findByIdAndDelete(messageId);

    const deletionPayload = { _id: messageId, deleted: true };

    // Emit message deletion
    if (message.group) {
      const group = await Group.findById(message.group);
      group.members.forEach((memberId) => {
        req.io.to(memberId.toString()).emit("messageDeleted", deletionPayload);
      });
    } else if (message.receiver) {
      req.io.to(message.receiver.toString()).emit("messageDeleted", deletionPayload);
      req.io.to(message.sender.toString()).emit("messageDeleted", deletionPayload);
    }

    res.json({ message: "Message deleted successfully" });
  } catch (err) {
    console.error("Failed to delete message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE all messages in a conversation (private chat)
router.delete(
  "/conversation/:userId",
  asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    try {
      // Delete all messages between current user and the other user
      const result = await Message.updateMany(
        {
          $or: [
            { sender: currentUserId, receiver: userId },
            { sender: userId, receiver: currentUserId },
          ],
        },
        {
          deleted: true,
          deletedAt: new Date(),
        }
      );

      // Emit deletion event to both users
      req.io.to(currentUserId.toString()).emit("conversationDeleted", {
        userId: userId,
      });
      req.io.to(userId.toString()).emit("conversationDeleted", {
        userId: currentUserId,
      });

      sendSuccess(res, {
        message: "Conversation deleted successfully",
        deletedCount: result.modifiedCount,
      });
    } catch (err) {
      console.error("Failed to delete conversation:", err);
      sendError(res, "Failed to delete conversation", 500);
    }
  })
);

// DELETE all messages in a group
router.delete(
  "/group/:groupId",
  asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    try {
      // Check if user is a member of the group
      const group = await Group.findById(groupId);
      if (!group) {
        return sendNotFound(res, "Group not found");
      }

      const isMember = group.members.some(
        (member) => member.toString() === currentUserId.toString()
      );
      if (!isMember) {
        return sendError(res, "Access denied", 403);
      }

      // Delete all messages in the group
      const result = await Message.updateMany(
        { group: groupId },
        {
          deleted: true,
          deletedAt: new Date(),
        }
      );

      // Emit deletion event to all group members
      group.members.forEach((memberId) => {
        req.io.to(memberId.toString()).emit("conversationDeleted", {
          groupId: groupId,
        });
      });

      sendSuccess(res, {
        message: "Group conversation deleted successfully",
        deletedCount: result.modifiedCount,
      });
    } catch (err) {
      console.error("Failed to delete group conversation:", err);
      sendError(res, "Failed to delete group conversation", 500);
    }
  })
);

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
