const cloudinary = require("cloudinary").v2;

const validateCloudinaryConfig = () => {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;

  if (!cloud_name || !api_key || !api_secret) {
    console.warn(
      "⚠️  Cloudinary credentials not configured. File uploads will fail."
    );
    console.warn(
      "Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file"
    );
    return false;
  }

  return true;
};

const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

const isCloudinaryConfigured = validateCloudinaryConfig();
if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryConfig);
} else {
  console.error(
    "❌ Cloudinary not configured. File uploads will not work until credentials are set."
  );
}

const allowedImageTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

const allowedVideoTypes = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/avi",
  "video/mov",
];

const allowedAudioTypes = [
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/m4a",
  "audio/webm",
];

const allowedDocumentTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
];

function getFileType(mimeType) {
  if (allowedImageTypes.includes(mimeType)) return "image";
  if (allowedVideoTypes.includes(mimeType)) return "video";
  if (allowedAudioTypes.includes(mimeType)) return "audio";
  if (allowedDocumentTypes.includes(mimeType)) return "file";
  return "file";
}

module.exports = {
  cloudinary,
  getFileType,
  allowedImageTypes,
  allowedVideoTypes,
  allowedAudioTypes,
  allowedDocumentTypes,
  isCloudinaryConfigured,
  validateCloudinaryConfig,
};
