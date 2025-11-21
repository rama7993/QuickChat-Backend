require("dotenv").config();

// Validate environment variables first
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

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Disable CSP for Socket.IO compatibility
  })
);

// Compression middleware
app.use(compression());

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS must be applied early, before rate limiting
app.use(configureCors());

// Rate limiting (skip OPTIONS requests for CORS preflight)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS", // Skip preflight requests
});

// Apply rate limiting to API routes
app.use("/api/", limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: "Too many authentication attempts, please try again later.",
  skipSuccessfulRequests: true,
  skip: (req) => req.method === "OPTIONS", // Skip preflight requests
});

// Rate limiting for password reset (more lenient)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Allow more attempts for password reset
  message: "Too many password reset requests, please try again later.",
  skip: (req) => req.method === "OPTIONS", // Skip preflight requests
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", passwordResetLimiter);
app.use("/api/auth/reset-password", passwordResetLimiter);
app.use(cookieParser());
app.use(passport.initialize());

// HTTP Server + Socket.IO with CORS
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

// Register routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/messages", chatRouter);
app.use("/api/groups", groupRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/upload", uploadRouter);

// Global error handler (must be after all routes)
const { globalErrorHandler } = require("./utils/errorHandler");
app.use(globalErrorHandler);

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
