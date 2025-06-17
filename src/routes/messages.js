const express = require("express");
const router = express.Router();
const Message = require("../models/message");

// GET messages between two users
// URL: /api/messages/:userId1/:userId2
router.get("/:userId1/:userId2", async (req, res) => {
  const { userId1, userId2 } = req.params;

  try {
    const messages = await Message.find({
      $or: [
        { sender: userId1, receiver: userId2 },
        { sender: userId2, receiver: userId1 },
      ],
    })
      .sort({ timestamp: 1 })
      .populate("sender", "_id photoUrl")
      .populate("receiver", "_id photoUrl");

    res.json(messages);
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST a new message and broadcast
// URL: /api/messages
router.post("/", async (req, res) => {
  try {
    const { sender, receiver, group, content, timestamp } = req.body;

    if (!sender || !content) {
      return res.status(400).json({ error: "Sender and content are required" });
    }

    const newMessage = new Message({
      sender,
      receiver: receiver || null,
      group: group || null,
      content,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await newMessage.save();

    // Generate roomId
    const roomId = receiver
      ? [sender, receiver].sort().join("_")
      : `group-${group}`;

    // Emit to the correct room if Socket.IO is attached
    if (req.io) {
      req.io.to(roomId).emit("chat message", {
        ...newMessage.toObject(),
      });
    }

    return res.status(201).json(newMessage);
  } catch (err) {
    console.error("Failed to save or emit message:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
