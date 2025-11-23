/**
 * Message Helper Functions
 * Utility functions for message operations
 */

/**
 * Format message content based on type
 */
function formatMessageContent(messageType, fileName, fileSize) {
  // Return just the filename. The frontend UI will handle showing the file type icon and size.
  return fileName;
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get message type from file MIME type
 */
function getMessageTypeFromMime(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "voice";
  return "file";
}

/**
 * Validate message content
 */
function validateMessage(message) {
  if (!message.sender) {
    throw new Error("Message sender is required");
  }

  if (
    !message.content &&
    (!message.attachments || message.attachments.length === 0)
  ) {
    throw new Error("Message must have content or attachments");
  }

  return true;
}

/**
 * Create message notification content
 */
function createNotificationContent(message, senderName) {
  if (message.attachments && message.attachments.length > 0) {
    const attachment = message.attachments[0];
    const typeLabels = {
      image: "sent an image",
      video: "sent a video",
      audio: "sent a voice message",
      voice: "sent a voice message",
      file: "sent a file",
    };
    return `${senderName} ${typeLabels[attachment.type] || "sent a file"}`;
  }
  return `${senderName}: ${message.content}`;
}

module.exports = {
  formatMessageContent,
  formatFileSize,
  getMessageTypeFromMime,
  validateMessage,
  createNotificationContent,
};
