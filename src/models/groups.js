const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupType: {
      type: String,
      enum: ["public", "private", "secret"],
      default: "private",
    },
    settings: {
      allowMemberInvite: {
        type: Boolean,
        default: true,
      },
      allowMemberAdd: {
        type: Boolean,
        default: true,
      },
      allowMessageEdit: {
        type: Boolean,
        default: true,
      },
      allowMessageDelete: {
        type: Boolean,
        default: true,
      },
      allowFileSharing: {
        type: Boolean,
        default: true,
      },
      maxFileSize: {
        type: Number,
        default: 10 * 1024 * 1024, // 10MB
      },
      allowedFileTypes: [
        {
          type: String,
        },
      ],
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    inviteExpiry: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
    pinnedMessages: [
      {
        message: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
        },
        pinnedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        pinnedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
groupSchema.index({ members: 1 });
groupSchema.index({ createdBy: 1 });
groupSchema.index({ inviteCode: 1 });
groupSchema.index({ lastActivity: -1 });

// Pre-save middleware to generate invite code
groupSchema.pre("save", function (next) {
  if (this.isNew && this.groupType === "public" && !this.inviteCode) {
    this.inviteCode = Math.random().toString(36).substring(2, 15);
    this.inviteExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  }
  next();
});

// Method to check if user is admin
groupSchema.methods.isAdmin = function (userId) {
  return (
    this.admins.includes(userId) ||
    this.createdBy.toString() === userId.toString()
  );
};

// Method to check if user is member
groupSchema.methods.isMember = function (userId) {
  return this.members.includes(userId);
};

// Method to add member
groupSchema.methods.addMember = function (userId) {
  if (!this.members.includes(userId)) {
    this.members.push(userId);
    this.lastActivity = new Date();
  }
};

// Method to remove member
groupSchema.methods.removeMember = function (userId) {
  this.members = this.members.filter(
    (member) => member.toString() !== userId.toString()
  );
  this.admins = this.admins.filter(
    (admin) => admin.toString() !== userId.toString()
  );
  this.lastActivity = new Date();
};

module.exports = mongoose.model("Group", groupSchema);
