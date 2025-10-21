const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Schema } = mongoose;

const GENDERS = ["Male", "Female", "Others"];

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      trim: true,
      sparse: true, // Allows null but enforces uniqueness if value exists
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
    },
    provider: {
      type: String,
      enum: ["local", "google", "linkedin"],
      default: "local",
    },
    providerId: {
      type: String,
      default: null,
    },
    password: {
      type: String,
      minlength: 8,
      required: function () {
        return this.provider === "local";
      },
    },
    gender: {
      type: String,
      enum: GENDERS,
    },
    photoUrl: {
      type: String,
      default: "",
      trim: true,
    },
    bio: {
      type: String,
      maxlength: 2000,
    },
    age: {
      type: Number,
      min: 18,
    },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["online", "away", "busy", "offline"],
      default: "offline",
    },
    statusMessage: {
      type: String,
      maxlength: 100,
      default: "",
    },
    notificationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      pushNotifications: {
        type: Boolean,
        default: true,
      },
      soundNotifications: {
        type: Boolean,
        default: true,
      },
      messagePreview: {
        type: Boolean,
        default: true,
      },
      groupNotifications: {
        type: Boolean,
        default: true,
      },
    },
    privacySettings: {
      showLastSeen: {
        type: Boolean,
        default: true,
      },
      showStatus: {
        type: Boolean,
        default: true,
      },
      showOnlineStatus: {
        type: Boolean,
        default: true,
      },
      allowGroupInvites: {
        type: Boolean,
        default: true,
      },
      allowFriendRequests: {
        type: Boolean,
        default: true,
      },
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    preferences: {
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: {
        type: String,
        default: "UTC",
      },
    },
  },
  { timestamps: true }
);

//  Pre-save hook to hash password only for local strategy
userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.provider === "local") {
    const saltRounds = parseInt(process.env.SALT_ROUNDS, 10) || 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
  }
  next();
});

//  JWT generator method
userSchema.methods.getJWT = function () {
  return jwt.sign(
    {
      userId: this._id,
      id: this._id, // Keep both for compatibility
      email: this.email,
    },
    process.env.JWT_SECRET ||
      "your-super-secret-jwt-key-change-this-in-production",
    {
      expiresIn: process.env.JWT_EXPIRATION || "7d",
    }
  );
};

//  Password validation
userSchema.methods.validatePassword = function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
