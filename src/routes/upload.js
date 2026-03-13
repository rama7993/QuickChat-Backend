const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middlewares/auth");
const uploadController = require("../controllers/uploadController");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed for profile pictures"), false);
    }
  },
});

router.use(authMiddleware);

router.post(
  "/profile-picture",
  upload.single("profilePicture"),
  uploadController.uploadProfilePicture
);

module.exports = router;
