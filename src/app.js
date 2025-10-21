require("dotenv").config();
const http = require("http");
const socketIO = require("socket.io");
const express = require("express");
const path = require("path");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const { configureCors } = require("./utils/environment");

// Import passport configuration
const passport = require("passport");
require("./lib/passport");

const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const chatRouter = require("./routes/messages");
const groupRouter = require("./routes/groups");
const notificationRouter = require("./routes/notifications");
const uploadRouter = require("./routes/upload");

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use(configureCors());
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

// HTTP Server + Socket.IO with CORS
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()),
    credentials: true,
  },
});
require("./lib/socket")(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Register routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", chatRouter);
app.use("/api/groups", groupRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/upload", uploadRouter);

//  Connect to DB and start server
connectDB()
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
  });
