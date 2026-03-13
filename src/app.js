require("dotenv").config();

const { validateEnvironment } = require("./utils/envValidator");
validateEnvironment();

const http = require("http");
const socketIO = require("socket.io");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/database");
const cookieParser = require("cookie-parser");
const { configureCors } = require("./utils/environment");

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

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(compression());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(configureCors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 10000 : 100,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS",
});

app.use("/api/", limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 1000 : 5,
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
  skip: (req) => req.method === "OPTIONS",
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many password reset requests, please try again later.",
  skip: (req) => req.method === "OPTIONS",
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);
app.use(cookieParser());
app.use(passport.initialize());

const server = http.createServer(app);
const allowedOrigins =
  process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) || [];
const defaultOrigins = [
  "http://localhost:4200",
  "http://localhost:3000",
  "http://127.0.0.1:4200",
  "http://127.0.0.1:3000",
];
const allAllowedOrigins = [...new Set([...allowedOrigins, ...defaultOrigins])];

const io = socketIO(server, {
  cors: {
    origin: process.env.NODE_ENV === "production" ? allAllowedOrigins : true, // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST"],
  },
});
require("./lib/socket")(io);

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", chatRouter);
app.use("/api/groups", groupRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/upload", uploadRouter);

const { globalErrorHandler } = require("./utils/errorHandler");
app.use(globalErrorHandler);

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
