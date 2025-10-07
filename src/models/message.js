const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    content: {
      type: String,
      required: function () {
        return !this.attachments || this.attachments.length === 0;
      },
    },
    type: {
      type: String,
      enum: [
        "text",
        "image",
        "file",
        "audio",
        "video",
        "location",
        "contact",
        "system",
      ],
      default: "text",
    },
    messageType: {
      type: String,
      enum: [
        "text",
        "image",
        "file",
        "voice",
        "video",
        "location",
        "contact",
        "system",
      ],
      default: "text",
    },
    attachments: [
      {
        type: {
          type: String,
          enum: ["image", "file", "voice", "video"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        filename: {
          type: String,
          required: true,
        },
        size: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        thumbnail: String, // For videos and images
        duration: Number, // For voice and video messages
      },
    ],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        emoji: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: Date,
    deleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
    forwarded: {
      type: Boolean,
      default: false,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ group: 1, timestamp: -1 });
messageSchema.index({ "readBy.user": 1 });

module.exports = mongoose.model("Message", messageSchema);
