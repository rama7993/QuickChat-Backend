const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/auth");
const groupController = require("../controllers/groupController");

router.use(authMiddleware);

router.post("/", groupController.createGroup);

router.get("/my", groupController.getMyGroups);

router.get("/:groupId", groupController.getGroupDetails);

router.put("/:groupId", groupController.updateGroup);

router.post("/:groupId/members", groupController.addMembers);

router.delete("/:groupId/members/:memberId", groupController.removeMember);

router.put("/:groupId/admins/:memberId", groupController.manageAdmins);

router.post("/join/:inviteCode", groupController.joinGroupByInvite);

router.put("/:groupId/pin/:messageId", groupController.pinMessage);

router.delete("/:groupId", groupController.deleteGroup);

router.get("/:groupId/members", groupController.getGroupMembers);

router.get("/users/available", groupController.getAvailableUsers);

module.exports = router;
