const Message = require("../models/message");
const User = require("../models/user");
const jwt = require("jsonwebtoken");

// Store active users and their socket connections
const activeUsers = new Map();
const typingUsers = new Map();

module.exports = (io) => {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const { verifyToken } = require("../utils/jwt");
      const decoded = verifyToken(token);

      // Extract userId from token (supports both userId and id fields)
      const userId = decoded.userId || decoded.id;

      if (!userId) {
        return next(new Error("Authentication error: Invalid token structure"));
      }

      const user = await User.findById(userId).select("-password");

      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    // Store user connection
    activeUsers.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      isOnline: true,
      lastSeen: new Date(),
    });

    // Notify other users that this user is online
    socket.broadcast.emit("user_online", {
      userId: socket.userId,
      username: socket.user.username,
      isOnline: true,
      lastSeen: new Date(),
    });

    // Send authenticated user data to the connected user
    socket.emit("authenticated", socket.user);

    // Send list of online users
    const onlineUsersList = Array.from(activeUsers.values()).map((user) => ({
      userId: user.user._id,
      username: user.user.username,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
    }));
    socket.emit("online_users", onlineUsersList);

    // Handle joining chat rooms
    socket.on("join_room", ({ roomId, roomType, userId }) => {
      socket.join(roomId);
      // Load recent messages for the room
      loadRecentMessages(socket, roomId, roomType);
    });

    // Handle leaving chat rooms
    socket.on("leave_room", ({ roomId, userId }) => {
      socket.leave(roomId);
    });

    // Send message functionality
    socket.on(
      "send_message",
      async ({
        content,
        receiverId,
        groupId,
        type = "text",
        replyTo,
        timestamp,
      }) => {
        try {
          const newMessage = new Message({
            sender: socket.userId,
            receiver: receiverId || null,
            group: groupId || null,
            content: content,
            type: type,
            replyTo: replyTo || null,
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            isRead: false,
          });

          await newMessage.save();

          // Populate message with sender details
          const populatedMessage = await Message.findById(newMessage._id)
            .populate("sender", "_id username firstName lastName photoUrl")
            .populate("receiver", "_id username firstName lastName photoUrl")
            .populate("group", "_id name avatar");

          // Determine room ID for broadcasting
          let roomId;
          if (groupId) {
            roomId = `group_${groupId}`;
          } else if (receiverId) {
            roomId = [socket.userId, receiverId].sort().join("_");
          }

          if (roomId) {
            // Broadcast message to all users in the room
            io.to(roomId).emit("message_received", populatedMessage);
          }
        } catch (err) {
          socket.emit("error", { message: "Failed to send message" });
        }
      }
    );

    // Typing indicators
    socket.on("start_typing", ({ receiverId, groupId, userId, username }) => {
      const roomId = groupId
        ? `group_${groupId}`
        : [socket.userId, receiverId].sort().join("_");

      typingUsers.set(socket.userId, {
        userId: socket.userId,
        username: username,
        isTyping: true,
        timestamp: new Date(),
        roomId: roomId,
      });

      socket.to(roomId).emit("user_typing", {
        userId: socket.userId,
        username: username,
        isTyping: true,
        timestamp: new Date(),
      });
    });

    socket.on("stop_typing", ({ receiverId, groupId, userId, username }) => {
      const roomId = groupId
        ? `group_${groupId}`
        : [socket.userId, receiverId].sort().join("_");

      typingUsers.delete(socket.userId);

      socket.to(roomId).emit("user_stopped_typing", {
        userId: socket.userId,
        username: username,
        isTyping: false,
        timestamp: new Date(),
      });
    });

    // File upload functionality
    socket.on("upload_file", async (data) => {
      let uploadId = null;
      try {
        const {
          uploadId: id,
          fileData,
          fileName,
          fileSize,
          fileType,
          roomId,
          messageType,
          userId,
          isGroupChat,
        } = data;
        uploadId = id;

        // Validation
        if (!fileData) {
          throw new Error("No file data received");
        }

        // Validate file size (max 10MB)
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(
            `File size exceeds maximum limit of ${
              MAX_FILE_SIZE / (1024 * 1024)
            }MB`
          );
        }

        // Validate file type
        const {
          getFileType,
          allowedImageTypes,
          allowedVideoTypes,
          allowedAudioTypes,
          allowedDocumentTypes,
        } = require("../utils/fileUpload");
        const allAllowedTypes = [
          ...allowedImageTypes,
          ...allowedVideoTypes,
          ...allowedAudioTypes,
          ...allowedDocumentTypes,
        ];

        if (!allAllowedTypes.includes(fileType)) {
          throw new Error("File type not allowed");
        }

        // Emit initial progress
        socket.emit(`upload_progress_${uploadId}`, 10);

        // Handle base64 file upload
        const uploadResult = await handleSocketFileUpload(
          fileData,
          fileName,
          fileSize,
          fileType,
          socket.userId,
          roomId,
          messageType
        );

        // Emit progress updates
        socket.emit(`upload_progress_${uploadId}`, 50);
        socket.emit(`upload_progress_${uploadId}`, 75);
        socket.emit(`upload_progress_${uploadId}`, 100);

        // Create message record in database
        const Message = require("../models/message");

        // Use the isGroupChat parameter to determine message type
        const isGroupMessage = isGroupChat || roomId.startsWith("group_");

        // Use message helpers for content formatting
        const { formatMessageContent } = require("../utils/messageHelpers");

        // Create appropriate content based on file type
        const content = formatMessageContent(messageType, fileName, fileSize);
        const messageTypeForDB =
          messageType === "audio" ? "voice" : messageType;

        const newMessage = new Message({
          sender: socket.userId,
          receiver: isGroupMessage ? null : roomId,
          group: isGroupMessage ? roomId.replace("group_", "") : null,
          content: content,
          messageType: messageTypeForDB,
          attachments: [
            {
              type: messageTypeForDB,
              url: uploadResult.fileUrl,
              filename: uploadResult.fileName,
              size: uploadResult.fileSize,
              mimeType: fileType,
            },
          ],
          timestamp: new Date(),
          isRead: false,
        });

        const savedMessage = await newMessage.save();
        await savedMessage.populate(
          "sender",
          "_id username firstName lastName photoUrl"
        );
        await savedMessage.populate(
          "receiver",
          "_id username firstName lastName photoUrl"
        );
        await savedMessage.populate("group", "_id name avatar");

        // Broadcast the new message to the room
        const broadcastRoomId = isGroupMessage
          ? `group_${roomId}`
          : [socket.userId, roomId].sort().join("_");
        io.to(broadcastRoomId).emit("new_message", savedMessage);

        // Emit upload completion
        socket.emit(`upload_complete_${uploadId}`, {
          success: true,
          fileUrl: uploadResult.fileUrl,
          fileName: uploadResult.fileName,
          fileSize: uploadResult.fileSize,
          fileType: uploadResult.fileType,
          message: "File uploaded successfully",
          messageId: savedMessage._id,
        });

        console.log(
          `File upload completed: ${fileName} -> ${uploadResult.fileUrl}`
        );
        // File upload completed successfully
      } catch (error) {
        console.error("File upload error:", error);
        if (uploadId) {
          // Provide user-friendly error message
          let errorMessage = "File upload failed";

          if (error.message) {
            if (error.message.includes("Cloudinary")) {
              errorMessage = error.message;
            } else if (error.message.includes("not configured")) {
              errorMessage =
                "File upload service is not configured. Please contact support.";
            } else if (error.message.includes("File size exceeds")) {
              errorMessage = error.message;
            } else if (error.message.includes("File type not allowed")) {
              errorMessage = "This file type is not supported.";
            } else {
              errorMessage = `Upload failed: ${error.message}`;
            }
          }

          socket.emit(`upload_error_${uploadId}`, {
            message: errorMessage,
            error: {
              name: error.name || "UploadError",
              message: error.message || "Unknown error",
            },
          });
        }
      }
    });

    // Mark message as read
    socket.on("mark_message_read", async ({ messageId, roomId, userId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, { isRead: true });

        // Notify sender that message was read
        socket.to(roomId).emit("message_read", {
          messageId: messageId,
          readBy: userId,
          readAt: new Date(),
        });

        // Message marked as read
      } catch (error) {
        // Handle error silently
      }
    });

    // Update message
    socket.on("update_message", async ({ messageId, content, userId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message || message.sender.toString() !== userId) {
          throw new Error("Unauthorized to edit this message");
        }

        const updatedMessage = await Message.findByIdAndUpdate(
          messageId,
          {
            content: content,
            edited: true,
            editedAt: new Date(),
          },
          { new: true }
        )
          .populate("sender", "_id username firstName lastName photoUrl")
          .populate("receiver", "_id username firstName lastName photoUrl")
          .populate("group", "_id name avatar");

        // Broadcast updated message
        const roomId = message.group
          ? `group_${message.group}`
          : [message.sender.toString(), message.receiver.toString()]
              .sort()
              .join("_");

        io.to(roomId).emit("message_updated", updatedMessage);

        // Message updated successfully
      } catch (error) {
        socket.emit("error", { message: "Failed to update message" });
      }
    });

    // Delete message
    socket.on("delete_message", async ({ messageId, userId }) => {
      try {
        const message = await Message.findById(messageId);

        if (!message || message.sender.toString() !== userId) {
          throw new Error("Unauthorized to delete this message");
        }

        await Message.findByIdAndUpdate(messageId, {
          deleted: true,
          deletedAt: new Date(),
        });

        // Broadcast message deletion
        const roomId = message.group
          ? `group_${message.group}`
          : [message.sender.toString(), message.receiver.toString()]
              .sort()
              .join("_");

        io.to(roomId).emit("message_deleted", { messageId: messageId });

        // Message deleted successfully
      } catch (error) {
        socket.emit("error", { message: "Failed to delete message" });
      }
    });

    // Video call events
    socket.on(
      "video_call_offer",
      async ({ roomId, offer, callerId, receiverId }) => {
        try {
          // Forward the offer to the receiver
          io.to(receiverId).emit("video_call_offer", {
            roomId,
            offer,
            callerId,
          });
        } catch (error) {
          socket.emit("error", { message: "Failed to send video call offer" });
        }
      }
    );

    socket.on("video_call_answer", async ({ roomId, answer, receiverId }) => {
      try {
        // Forward the answer to the caller
        io.to(receiverId).emit("video_call_answer", {
          roomId,
          answer,
          receiverId: socket.userId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to send video call answer" });
      }
    });

    socket.on(
      "video_call_ice_candidate",
      async ({ roomId, candidate, receiverId }) => {
        try {
          // Forward ICE candidate to the other peer
          io.to(receiverId).emit("video_call_ice_candidate", {
            roomId,
            candidate,
            senderId: socket.userId,
          });
        } catch (error) {
          socket.emit("error", { message: "Failed to send ICE candidate" });
        }
      }
    );

    socket.on("video_call_end", async ({ roomId, userId }) => {
      try {
        // Notify all participants that the call has ended
        io.to(roomId).emit("video_call_ended", {
          roomId,
          endedBy: userId,
        });
      } catch (error) {
        socket.emit("error", { message: "Failed to end video call" });
      }
    });

    // Handle user disconnection
    socket.on("disconnect", () => {
      // Remove from active users
      activeUsers.delete(socket.userId);
      typingUsers.delete(socket.userId);

      // Notify other users that this user went offline
      socket.broadcast.emit("user_offline", socket.userId);

      // Update user's last seen timestamp
      User.findByIdAndUpdate(socket.userId, { lastSeen: new Date() }).exec();
    });
  });

  // Helper function to load recent messages
  async function loadRecentMessages(socket, roomId, roomType) {
    try {
      let query = {};

      if (roomType === "group") {
        const groupId = roomId.replace("group_", "");
        query = { group: groupId };
      } else {
        const userIds = roomId.split("_");
        query = {
          $or: [
            { sender: userIds[0], receiver: userIds[1] },
            { sender: userIds[1], receiver: userIds[0] },
          ],
        };
      }

      const messages = await Message.find(query)
        .populate("sender", "_id username firstName lastName photoUrl")
        .populate("receiver", "_id username firstName lastName photoUrl")
        .populate("group", "_id name avatar")
        .sort({ timestamp: -1 })
        .limit(50);

      // Send messages to the socket
      socket.emit("load_messages", messages.reverse());
    } catch (error) {
      // Handle error silently
    }
  }

  // Helper function to handle file uploads - Cloudinary only
  async function handleSocketFileUpload(
    fileData,
    fileName,
    fileSize,
    fileType,
    userId,
    roomId,
    messageType
  ) {
    try {
      const {
        getFileType,
        cloudinary,
        isCloudinaryConfigured,
      } = require("../utils/fileUpload");

      // Check if Cloudinary is configured
      if (!isCloudinaryConfigured) {
        throw new Error(
          "Cloudinary is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables."
        );
      }

      // Convert base64 to buffer
      let base64Data;
      if (fileData.includes(",")) {
        base64Data = fileData.split(",")[1]; // Remove data:image/jpeg;base64, prefix
      } else {
        base64Data = fileData; // Already just the base64 data
      }

      const buffer = Buffer.from(base64Data, "base64");

      // Validate buffer
      if (!buffer || buffer.length === 0) {
        throw new Error("Invalid file data: empty buffer");
      }

      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadOptions = {
          folder: "quickchat/uploads",
          resource_type: "auto",
          public_id: `${Date.now()}_${Math.round(Math.random() * 1e9)}`,
        };

        cloudinary.uploader
          .upload_stream(uploadOptions, (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              // Provide more helpful error messages
              if (
                error.message &&
                error.message.includes("Invalid Signature")
              ) {
                reject(
                  new Error(
                    "Cloudinary authentication failed. Please check your CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET environment variables."
                  )
                );
              } else if (
                error.message &&
                error.message.includes("Invalid cloud_name")
              ) {
                reject(
                  new Error(
                    "Invalid Cloudinary cloud name. Please check your CLOUDINARY_CLOUD_NAME environment variable."
                  )
                );
              } else {
                reject(
                  new Error(
                    `Cloudinary upload failed: ${
                      error.message || "Unknown error"
                    }`
                  )
                );
              }
            } else {
              resolve(result);
            }
          })
          .end(buffer);
      });

      if (!result || !result.secure_url) {
        throw new Error("Upload succeeded but no URL returned from Cloudinary");
      }

      return {
        fileUrl: result.secure_url,
        fileName: fileName || "upload",
        fileSize: fileSize,
        fileType: getFileType(fileType || "application/octet-stream"),
      };
    } catch (error) {
      console.error("File upload error details:", {
        fileName,
        fileSize,
        fileType,
        error: error.message,
      });
      throw error;
    }
  }
};
