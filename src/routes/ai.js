const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/errorHandler");
const aiController = require("../controllers/ai.controller");

router.use(authMiddleware);

// Get 3 smart replies for a conversation
router.get(
  "/smart-replies/:conversationId",
  asyncHandler(aiController.getSmartReplies),
);

module.exports = router;
