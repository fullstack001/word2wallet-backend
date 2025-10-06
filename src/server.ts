import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import path from "path";
import { createServer } from "http";

import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { notFound } from "./middleware/notFound";
import { createAdminUserFromEnv } from "./utils/createAdminUser";
import WebSocketManager from "./services/websocketServer";
import { AuctionScheduler } from "./services/auctionScheduler";
// Job service removed - no longer needed for simple book operations

// Import routes
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import subjectRoutes from "./routes/subjects";
import courseRoutes from "./routes/courses";
import contentGenerationRoutes from "./routes/contentGeneration";
import subscriptionRoutes from "./routes/subscriptions";
import webhookRoutes from "./routes/webhooks";
import dashboardRoutes from "./routes/dashboard";
import translationRoutes from "./routes/translation";
import auctionRoutes from "./routes/auctions";
// Demo routes removed
import bookRoutes from "./routes/books";
import fileRoutes from "./routes/files";
// New book delivery routes
import deliveryLinkRoutes from "./routes/deliveryLinkRoutes";
import landingPageRoutes from "./routes/landingPageRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import emailCaptureRoutes from "./routes/emailCaptureRoutes";
// Email marketing and payment gateway routes
import emailMarketingRoutes from "./routes/emailMarketingRoutes";
import paymentGatewayRoutes from "./routes/paymentGatewayRoutes";
import { setWebSocketManager } from "./controllers/auctionController";

// Load environment variables
dotenv.config();

// Redis/Job services removed - no longer needed for simple operations

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000; // Server port

// Initialize WebSocket server
const wsManager = new WebSocketManager(server);

// Set WebSocket manager for auction controller
setWebSocketManager(wsManager);

// Security middleware
app.use(helmet());
// Compression - but exclude webhook endpoints to preserve raw body
app.use(
  compression({
    filter: (req, res) => {
      // Don't compress webhook endpoints
      if (req.path.startsWith("/api/webhooks")) {
        return false;
      }
      return compression.filter(req, res);
    },
  })
);

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "1000"), // limit each IP to 1000 requests per windowMs (increased for development)
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for localhost in development
  skip: (req) => {
    if (process.env.NODE_ENV === "development") {
      return (
        req.ip === "127.0.0.1" ||
        req.ip === "::1" ||
        req.ip === "::ffff:127.0.0.1"
      );
    }
    return false;
  },
});
app.use(limiter);

// Manual CORS headers for development
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Range, Accept, Origin, X-Requested-With"
  );
  res.header(
    "Access-Control-Expose-Headers",
    "Content-Range, Content-Length, Accept-Ranges"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// CORS configuration - Locked to EPUB viewer origins in production
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((origin) => origin.trim())
  : true; // Allow all origins in development

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Range",
      "Accept",
      "Origin",
      "X-Requested-With",
    ],
    exposedHeaders: ["Content-Range", "Content-Length", "Accept-Ranges"],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  })
);

// Raw body parsing for Stripe webhooks - MUST be before express.json()
// This captures the raw body as a Buffer for signature verification
app.use(
  "/api/webhooks/stripe",
  express.raw({
    type: "application/json",
    verify: (req: any, res, buf) => {
      // Store raw body for Stripe signature verification
      req.rawBody = buf;
    },
  })
);

// Body parsing middleware
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

// Logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Static files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/content-generation", contentGenerationRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/translation", translationRoutes);
app.use("/api/auctions", auctionRoutes);
// Demo routes removed
app.use("/api/books", bookRoutes);
app.use("/files", fileRoutes);
// New book delivery routes
app.use("/api/delivery-links", deliveryLinkRoutes);
app.use("/api/landing-pages", landingPageRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/email-captures", emailCaptureRoutes);
// Email marketing and payment gateway routes
app.use("/api/email-marketing", emailMarketingRoutes);
app.use("/api/payment-gateway", paymentGatewayRoutes);

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Connect to database and start server
const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MongoDB");

    // Create admin user if it doesn't exist
    console.log("🔧 Setting up admin user...");
    await createAdminUserFromEnv();

    // Start auction scheduler
    console.log("⏰ Starting auction scheduler...");
    AuctionScheduler.start();

    // Job workers removed - no longer needed

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/health`);
      console.log(`🔌 WebSocket server: ws://localhost:${PORT}/ws`);
      console.log(`🏆 Auction system: Active with real data integration`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  console.error("Unhandled Promise Rejection:", err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  console.error("Uncaught Exception:", err.message);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  AuctionScheduler.stop();
  wsManager.cleanup();
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  AuctionScheduler.stop();
  wsManager.cleanup();
  server.close(() => {
    console.log("Process terminated");
    process.exit(0);
  });
});

startServer();
