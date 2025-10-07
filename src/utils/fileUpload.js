const cloudinary = require("cloudinary").v2;

// Optional dependencies for enhanced media processing
let sharp, ffmpeg;
try {
  sharp = require("sharp");
} catch (err) {
  console.warn("Sharp not available - image processing will be limited");
}

try {
  ffmpeg = require("fluent-ffmpeg");
} catch (err) {
  console.warn("FFmpeg not available - video/audio processing will be limited");
}

// Configure Cloudinary - Required for file uploads
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validate Cloudinary configuration
const isCloudinaryConfigured =
  cloudinaryConfig.cloud_name &&
  cloudinaryConfig.api_key &&
  cloudinaryConfig.api_secret &&
  cloudinaryConfig.cloud_name !== "demo" &&
  cloudinaryConfig.api_key !== "demo" &&
  cloudinaryConfig.api_secret !== "demo";

if (!isCloudinaryConfigured) {
  console.warn(
    "⚠️ Cloudinary not properly configured - using local storage fallback"
  );
  console.warn(
    "⚠️ Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file"
  );
} else {
  // console.log("✅ Cloudinary configured successfully"); // Commented for production
  // console.log("🔍 Cloud Name:", cloudinaryConfig.cloud_name); // Commented for production
  // console.log("🔍 API Key:", cloudinaryConfig.api_key); // Commented for production
  // console.log("🔍 API Secret:", "***" + cloudinaryConfig.api_secret.slice(-4)); // Commented for production
  cloudinary.config(cloudinaryConfig);
}

// File type validation
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

// File type detection
function getFileType(mimeType) {
  if (allowedImageTypes.includes(mimeType)) return "image";
  if (allowedVideoTypes.includes(mimeType)) return "video";
  if (allowedAudioTypes.includes(mimeType)) return "audio";
  if (allowedDocumentTypes.includes(mimeType)) return "file";
  return "file";
}

// Generate image thumbnail using Sharp
async function generateImageThumbnail(imagePath) {
  if (!sharp) {
    console.warn("Sharp not available for thumbnail generation");
    return null;
  }

  try {
    const thumbnailBuffer = await sharp(imagePath)
      .resize(300, 300, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const result = await cloudinary.uploader
      .upload_stream(
        {
          folder: "quickchat/thumbnails",
          resource_type: "image",
          public_id: `thumb_${Date.now()}_${Math.round(Math.random() * 1e9)}`,
        },
        (error, result) => {
          if (error) throw error;
        }
      )
      .end(thumbnailBuffer);

    return result.secure_url;
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    return null;
  }
}

// Generate video thumbnail using FFmpeg
async function generateVideoThumbnail(videoPath) {
  if (!ffmpeg) {
    console.warn("FFmpeg not available for video thumbnail generation");
    return null;
  }

  try {
    return new Promise((resolve, reject) => {
      const thumbnailPath = `/tmp/thumb_${Date.now()}.jpg`;

      ffmpeg(videoPath)
        .screenshots({
          timestamps: ["10%"],
          filename: thumbnailPath,
          size: "300x300",
        })
        .on("end", async () => {
          try {
            const result = await cloudinary.uploader.upload(thumbnailPath, {
              folder: "quickchat/thumbnails",
              resource_type: "image",
            });
            resolve(result.secure_url);
          } catch (error) {
            reject(error);
          }
        })
        .on("error", reject);
    });
  } catch (error) {
    console.error("Video thumbnail generation error:", error);
    return null;
  }
}

// Get video duration using FFmpeg
async function getVideoDuration(videoPath) {
  if (!ffmpeg) {
    console.warn("FFmpeg not available for duration extraction");
    return null;
  }

  try {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          reject(err);
        } else {
          const duration = metadata.format.duration;
          resolve(Math.round(duration));
        }
      });
    });
  } catch (error) {
    console.error("Duration extraction error:", error);
    return null;
  }
}

// Get audio duration using FFmpeg
async function getAudioDuration(audioPath) {
  return getVideoDuration(audioPath); // Same function for audio
}

// Compress image using Sharp
async function compressImage(imagePath) {
  if (!sharp) {
    console.warn("Sharp not available for image compression");
    return imagePath;
  }

  try {
    const compressedBuffer = await sharp(imagePath)
      .jpeg({ quality: 80 })
      .png({ compressionLevel: 8 })
      .toBuffer();

    const result = await cloudinary.uploader
      .upload_stream(
        {
          folder: "quickchat/compressed",
          resource_type: "image",
          public_id: `compressed_${Date.now()}_${Math.round(
            Math.random() * 1e9
          )}`,
        },
        (error, result) => {
          if (error) throw error;
        }
      )
      .end(compressedBuffer);

    return result.secure_url;
  } catch (error) {
    console.error("Image compression error:", error);
    return imagePath;
  }
}

// Compress video using FFmpeg
async function compressVideo(videoPath) {
  if (!ffmpeg) {
    console.warn("FFmpeg not available for video compression");
    return videoPath;
  }

  try {
    return new Promise((resolve, reject) => {
      const compressedPath = `/tmp/compressed_${Date.now()}.mp4`;

      ffmpeg(videoPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .size("1280x720")
        .videoBitrate("1000k")
        .audioBitrate("128k")
        .output(compressedPath)
        .on("end", async () => {
          try {
            const result = await cloudinary.uploader.upload(compressedPath, {
              folder: "quickchat/compressed",
              resource_type: "video",
            });
            resolve(result.secure_url);
          } catch (error) {
            reject(error);
          }
        })
        .on("error", reject)
        .run();
    });
  } catch (error) {
    console.error("Video compression error:", error);
    return videoPath;
  }
}

module.exports = {
  cloudinary,
  generateImageThumbnail,
  generateVideoThumbnail,
  getVideoDuration,
  getAudioDuration,
  compressImage,
  compressVideo,
  getFileType,
  allowedImageTypes,
  allowedVideoTypes,
  allowedAudioTypes,
  allowedDocumentTypes,
};
