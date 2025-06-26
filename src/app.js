require("dotenv").config();
const http = require("http");
const socketIO = require("socket.io");
const express = require("express");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const { configureCors } = require("./utils/environment");

const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const chatRouter = require("./routes/messages");
const groupRouter = require("./routes/groups");

const app = express();
const port = process.env.PORT || 3000;

// Middlewares
app.use((req, res, next) => {
  console.log("🌍 Origin:", req.headers.origin);
  console.log("🍪 Cookie:", req.headers.cookie);
  next();
});

app.use(express.json());
app.use(cookieParser());
app.use(configureCors());

// HTTP Server
const server = http.createServer(app);
// Socket.IO Server
const io = socketIO(server, {
  cors: { origin: "*" },
});
require("./lib/socket")(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", chatRouter);
app.use("/api/groups", groupRouter);

// DB connection + server start
connectDB()
  .then(() => {
    console.log("Connected to MongoDB");
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("DB connection error:", err);
  });
