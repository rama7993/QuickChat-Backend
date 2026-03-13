const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/errorHandler");
const messageController = require("../controllers/messageController");

router.use(authMiddleware);

router.get("/conversations", authMiddleware, asyncHandler(messageController.getConversations));

router.get("/private/:userId", asyncHandler(messageController.getPrivateMessages));

router.get("/group/:groupId", asyncHandler(messageController.getGroupMessages));

router.post("/private", asyncHandler(messageController.sendPrivateMessage));

router.post("/group", asyncHandler(messageController.sendGroupMessage));

router.post("/:messageId/reaction", messageController.addReaction);

router.put("/:messageId", messageController.editMessage);

router.delete("/:messageId", messageController.deleteMessage);

router.delete("/conversation/:userId", asyncHandler(messageController.deleteConversation));

router.delete("/group/:groupId", asyncHandler(messageController.deleteGroupConversation));

router.get("/search/:query", messageController.searchMessages);

module.exports = router;
