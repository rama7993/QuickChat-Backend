const Group = require("../models/groups");
const User = require("../models/user");
const Notification = require("../models/notification");

/**
 * @desc    Create a new group
 * @route   POST /api/groups
 */
exports.createGroup = async (req, res) => {
  try {
    const { name, description, members, groupType, settings } = req.body;
    const createdBy = req.user._id;

    const allMembers = [...new Set([createdBy, ...(members || [])])];

    const group = new Group({
      name,
      description: description || "",
      members: allMembers,
      admins: [createdBy],
      createdBy,
      groupType: groupType || "private",
      settings: {
        allowMemberInvite: true,
        allowMemberAdd: true,
        allowMessageEdit: true,
        allowMessageDelete: true,
        allowFileSharing: true,
        maxFileSize: 10 * 1024 * 1024,
        allowedFileTypes: ["image", "video", "audio", "document"],
        ...settings,
      },
    });

    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email")
      .populate("createdBy", "firstName lastName photoUrl email");

    const notificationPromises = allMembers
      .filter((memberId) => memberId.toString() !== createdBy.toString())
      .map((memberId) =>
        Notification.createNotification(
          memberId,
          "group_invite",
          "Added to Group",
          `You have been added to the group "${name}"`,
          { groupId: group._id, createdBy },
          req.io
        )
      );

    await Promise.all(notificationPromises);

    res.status(201).json(fullGroup);
  } catch (err) {
    console.error("Failed to create group:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Get groups the user is a member of
 * @route   GET /api/groups/my
 */
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({
      members: req.user._id,
      isActive: true,
    })
      .populate("members", "firstName lastName photoUrl status lastSeen")
      .populate("admins", "firstName lastName photoUrl")
      .populate("createdBy", "firstName lastName photoUrl")
      .sort({ lastActivity: -1 });

    res.json(groups);
  } catch (err) {
    console.error("Failed to fetch groups:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Get group details by ID
 * @route   GET /api/groups/:groupId
 */
exports.getGroupDetails = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate("members", "firstName lastName photoUrl email status lastSeen")
      .populate("admins", "firstName lastName photoUrl email")
      .populate("createdBy", "firstName lastName photoUrl email")
      .populate("pinnedMessages.message", "content sender timestamp")
      .populate("pinnedMessages.pinnedBy", "firstName lastName");

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isMember = group.members.some(
      (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "Access denied. You are not a member of this group." });
    }

    res.json(group);
  } catch (err) {
    console.error("Failed to fetch group:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Update group details
 * @route   PUT /api/groups/:groupId
 */
exports.updateGroup = async (req, res) => {
  try {
    const { name, description, settings } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (settings) group.settings = { ...group.settings, ...settings };

    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email")
      .populate("createdBy", "firstName lastName photoUrl email");

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to update group:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Add members to a group
 * @route   POST /api/groups/:groupId/members
 */
exports.addMembers = async (req, res) => {
  try {
    const { memberIds } = req.body;
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    memberIds.forEach((memberId) => {
      group.addMember(memberId);
    });

    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email");

    const notificationPromises = memberIds.map((memberId) =>
      Notification.createNotification(
        memberId,
        "group_invite",
        "Added to Group",
        `You have been added to the group "${group.name}"`,
        { groupId: group._id, addedBy: req.user._id },
        req.io
      )
    );

    await Promise.all(notificationPromises);

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to add members:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Remove member from a group
 * @route   DELETE /api/groups/:groupId/members/:memberId
 */
exports.removeMember = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.isAdmin(req.user._id) && req.user._id.toString() !== memberId) {
      return res.status(403).json({ error: "Access denied" });
    }

    group.removeMember(memberId);
    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email");

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to remove member:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Manage group admins (add/remove)
 * @route   PUT /api/groups/:groupId/admins/:memberId
 */
exports.manageAdmins = async (req, res) => {
  try {
    const { groupId, memberId } = req.params;
    const { action } = req.body; // 'add' or 'remove'
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (action === "add") {
      if (!group.admins.includes(memberId)) {
        group.admins.push(memberId);
      }
    } else if (action === "remove") {
      group.admins = group.admins.filter(
        (admin) => admin.toString() !== memberId
      );
    }

    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email");

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to update admin:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Join a group by invite code
 * @route   POST /api/groups/join/:inviteCode
 */
exports.joinGroupByInvite = async (req, res) => {
  try {
    const { inviteCode } = req.params;
    const group = await Group.findOne({
      inviteCode,
      inviteExpiry: { $gt: new Date() },
    });

    if (!group) {
      return res.status(404).json({ error: "Invalid or expired invite code" });
    }

    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ error: "Already a member of this group" });
    }

    group.addMember(req.user._id);
    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email");

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to join group:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Pin or unpin a message in a group
 * @route   PUT /api/groups/:groupId/pin/:messageId
 */
exports.pinMessage = async (req, res) => {
  try {
    const { groupId, messageId } = req.params;
    const { action } = req.body; // 'pin' or 'unpin'
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.isAdmin(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (action === "pin") {
      const alreadyPinned = group.pinnedMessages.some(
        (pin) => pin.message.toString() === messageId
      );

      if (!alreadyPinned) {
        group.pinnedMessages.push({
          message: messageId,
          pinnedBy: req.user._id,
        });
      }
    } else if (action === "unpin") {
      group.pinnedMessages = group.pinnedMessages.filter(
        (pin) => pin.message.toString() !== messageId
      );
    }

    await group.save();

    const fullGroup = await Group.findById(group._id)
      .populate("members", "firstName lastName photoUrl email")
      .populate("admins", "firstName lastName photoUrl email")
      .populate("pinnedMessages.message", "content sender timestamp")
      .populate("pinnedMessages.pinnedBy", "firstName lastName");

    res.json(fullGroup);
  } catch (err) {
    console.error("Failed to pin/unpin message:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Soft delete a group
 * @route   DELETE /api/groups/:groupId
 */
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId);

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (group.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Access denied" });
    }

    group.isActive = false;
    await group.save();

    res.json({ message: "Group deleted successfully" });
  } catch (err) {
    console.error("Failed to delete group:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Get group members
 * @route   GET /api/groups/:groupId/members
 */
exports.getGroupMembers = async (req, res) => {
  try {
    const group = await Group.findById(req.params.groupId)
      .populate("members", "firstName lastName photoUrl email status lastSeen")
      .populate("admins", "firstName lastName photoUrl email");

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    if (!group.members.includes(req.user._id)) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({
      members: group.members,
      admins: group.admins,
      totalMembers: group.members.length,
    });
  } catch (err) {
    console.error("Failed to fetch group members:", err);
    res.status(500).json({ error: err.message });
  }
};

/**
 * @desc    Get available users to add to a group
 * @route   GET /api/groups/users/available
 */
exports.getAvailableUsers = async (req, res) => {
  try {
    const users = await User.find(
      { _id: { $ne: req.user._id } },
      "firstName lastName photoUrl email status"
    ).sort({ firstName: 1 });

    res.json(users);
  } catch (err) {
    console.error("Failed to fetch users:", err);
    res.status(500).json({ error: err.message });
  }
};
