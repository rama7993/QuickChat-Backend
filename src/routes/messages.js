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

module.exports = router;
