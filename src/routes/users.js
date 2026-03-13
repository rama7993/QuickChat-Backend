const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/auth");
const { asyncHandler } = require("../utils/errorHandler");
const userController = require("../controllers/userController");

router.get("/", asyncHandler(userController.getUsers));

router.get("/me", authMiddleware, asyncHandler(userController.getMe));

router.get("/:id", asyncHandler(userController.getUserById));

router.put("/:id", authMiddleware, asyncHandler(userController.updateProfile));

router.patch("/:id", authMiddleware, asyncHandler(userController.patchUser));

module.exports = router;
