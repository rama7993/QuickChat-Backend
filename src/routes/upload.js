const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middlewares/auth");
const { cloudinary } = require("../utils/fileUpload");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files for profile pictures
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for profile pictures"), false);
    }
  },
});

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * @route   POST /api/upload/profile-picture
 * @desc    Upload profile picture
 */
router.post(
  "/profile-picture",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Bad Request",
          message: "No file uploaded",
        });
      }

      const file = req.file;
      const userId = req.user._id;

      // Validate file size
      if (file.size > 5 * 1024 * 1024) {
        // 5MB
        return res.status(400).json({
          error: "Bad Request",
          message: "File size must be less than 5MB",
        });
      }

      // Upload to Cloudinary
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
              if (error) reject(error);
              else resolve(result);
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
  }
);

module.exports = router;
