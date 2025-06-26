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
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.RESET_TOKEN_EXPIRATION || "7d",
  });
};

//  Password validation
userSchema.methods.validatePassword = function (inputPassword) {
  return bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
