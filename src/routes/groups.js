const express = require("express");
const router = express.Router();
const Message = require("../models/message");

// Create group
router.post("/", async (req, res) => {
  try {
    const { name, members } = req.body;

    const group = await Group.create({
      name,
      members,
      createdBy: req.user._id,
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get groups user is a member of
router.get("/my", async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user._id });
    res.json(groups);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Private chat
router.get("/private/:userId", async (req, res) => {
  const { userId } = req.params;
  const userA = req.user._id;
  try {
    const messages = await Message.find({
      $or: [
        { sender: userA, receiver: userId },
        { sender: userId, receiver: userA },
      ],
    })
      .sort({ timestamp: 1 })
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Group chat
router.get("/group/:groupId", async (req, res) => {
  try {
    const messages = await Message.find({ group: req.params.groupId })
      .sort({ timestamp: 1 })
      .populate("sender", "firstName lastName photoUrl");

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send group message
router.post("/group", async (req, res) => {
  const { groupId, content } = req.body;
  try {
    const message = await Message.create({
      sender: req.user._id,
      group: groupId,
      content,
    });

    const fullMessage = await message.populate(
      "sender",
      "firstName lastName photoUrl"
    );

    res.status(201).json(fullMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send private message
router.post("/private", async (req, res) => {
  const { receiverId, content } = req.body;
  try {
    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      content,
    });

    const fullMessage = await message
      .populate("sender", "firstName lastName photoUrl")
      .populate("receiver", "firstName lastName photoUrl");

    res.status(201).json(fullMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
