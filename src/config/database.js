const mongoose = require("mongoose");
const URI = process.env.MONGO_URI || "mongodb://localhost:27017/quickchat";

const connectDB = async () => {
  try {
    await mongoose.connect(URI);
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection error:", error);
    console.log("📝 Using memory store for user data");
  }
};

module.exports = connectDB;
