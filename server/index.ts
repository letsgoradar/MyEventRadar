// Set development mode by default
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}
console.log("Starting server with NODE_ENV:", process.env.NODE_ENV);

import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import session from "express-session";
import cookieParser from "cookie-parser";
import path from "path";
import { attachUser } from "./middleware/auth";
import { autoLoginTestUser } from "./middleware/auto-login";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { startNotificationScheduler } from "./notification-scheduler";
import { startRssScheduler } from "./rss-scheduler";

const app = express();

// Serve static files from public folder (for logo and other assets)
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));
app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));

// Security: Essential security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Voor Vite development
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false // Voor compatibiliteit
}));

// Enhanced error handling middleware
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
};

// Setup middleware
app.use(express.json({ limit: '10mb' })); // Verhoog de limiet voor JSON verzoeken
app.use(express.urlencoded({ extended: false, limit: '10mb' })); // Verhoog de limiet voor urlencoded verzoeken
app.use(cookieParser());

// Setup session with forced reset
app.use(session({
  secret: process.env.SESSION_SECRET || 'eventapp-session-secret-new-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  name: 'eventapp.sid', // Use a specific session name
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    httpOnly: true
  }
}));

// Auto-login testuser for development
app.use(autoLoginTestUser);

// Attach user to request if authenticated
app.use(attachUser);

// Add startup timestamp
const startTime = Date.now();
console.log('Server starting...');

// Required port configuration
const PORT = 5000;
const HOST = '0.0.0.0';

// Improved async server startup
(async () => {
  try {
    console.log('Initializing server configuration...');

    // Register routes first for faster API availability
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

    // Start notification scheduler for upcoming events
    startNotificationScheduler();
    console.log('Notification scheduler started');

    // Start RSS feed scheduler
    startRssScheduler();
    console.log('RSS feed scheduler started');

    // Add error handling middleware
    app.use(errorHandler);

    if (process.env.NODE_ENV === "development") {
      console.log('Setting up Vite in development mode...');
      await setupVite(app, server);
      console.log('Vite setup complete');
    } else {
      console.log('Setting up static serving...');
      serveStatic(app);
      console.log('Static serving setup complete');
    }

    // Enhanced error handling for server startup
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please ensure port ${PORT} is free before starting the server.`);
        process.exit(1);
      } else {
        console.error('Server failed to start:', error);
        process.exit(1);
      }
    });

    // Start listening with enhanced logging
    server.listen({
      port: PORT,
      host: HOST,
    }, () => {
      const setupTime = Date.now() - startTime;
      log(`Server started successfully on http://${HOST}:${PORT} (setup took ${setupTime}ms)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();