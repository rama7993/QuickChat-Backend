const { cloudinary, isCloudinaryConfigured } = require("../utils/fileUpload");

/**
 * @desc    Upload profile picture to Cloudinary
 * @route   POST /api/upload/profile-picture
 */
exports.uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "Bad Request",
        message: "No file uploaded",
      });
    }

    const file = req.file;
    const userId = req.user._id;

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        error: "Bad Request",
        message: "File size must be less than 5MB",
      });
    }

    if (!isCloudinaryConfigured) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "File upload service is not configured. Please contact support.",
      });
    }

    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: "quickchat/profile-pictures",
            resource_type: "image",
            public_id: `profile_${userId}_${Date.now()}`,
            transformation: [
              { width: 300, height: 300, crop: "fill", gravity: "face" },
              { quality: "auto" },
            ],
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              if (error.message && error.message.includes("Invalid Signature")) {
                reject(new Error("Cloudinary authentication failed. Please check your API credentials."));
              } else if (error.message && error.message.includes("Invalid cloud_name")) {
                reject(new Error("Invalid Cloudinary cloud name configuration."));
              } else {
                reject(error);
              }
            } else {
              resolve(result);
            }
          }
        )
        .end(file.buffer);
    });

    res.status(200).json({
      message: "Profile picture uploaded successfully",
      url: result.secure_url,
      imageUrl: result.secure_url,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to upload profile picture: " + error.message,
    });
  }
};
