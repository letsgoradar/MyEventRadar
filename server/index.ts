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
import { startNotificationScheduler, notificationSyncMiddleware } from "./notification-scheduler";
import { startRssScheduler, rssSyncMiddleware } from "./rss-scheduler";
import { expirePromotions } from "./routes/advertiser-routes";
import { randomBytes } from "crypto";
import { closePool } from "./db";
let lastPromotionCheck: number | null = null;

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET) {
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET environment variable is required in production');
  }
  const devSecret = randomBytes(64).toString('hex');
  console.warn('[Dev] No SESSION_SECRET set, using randomly generated secret. Sessions will not persist across restarts.');
  return devSecret;
}

const app = express();

// Serve static files from public folder (for logo and other assets)
app.use('/images', express.static(path.join(process.cwd(), 'public', 'images')));
app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets')));
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads')));

// Traffic monitoring with email alerts and circuit breaker
import { trafficMonitor } from "./middleware/traffic-monitor";
app.use(trafficMonitor);

// CORS: Allow Capacitor native app origins
import cors from "cors";
app.use(cors({
  origin: [
    /\.replit\.dev$/,
    /\.replit\.app$/,
    'capacitor://localhost',
    'https://localhost',
    'http://localhost',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// Security: Essential security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      connectSrc: ["'self'", "ws:", "wss:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
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
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

// Setup session with forced reset
app.use(session({
  secret: getSessionSecret(),
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

if (process.env.NODE_ENV === 'development' && process.env.ENABLE_AUTO_LOGIN === 'true') {
  console.warn('[SECURITY] Auto-login middleware is active - ONLY for development');
  app.use(autoLoginTestUser);
}

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

    try {
      const bcrypt = await import('bcryptjs');
      const { db: migrateDb } = await import('./db');
      const { users: usersTable, passwordResetTokens: prtTable } = await import('@shared/schema');
      const { eq, sql } = await import('drizzle-orm');
      
      await migrateDb.execute(sql`CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`);
      
      const adminEmail = 'info@letsgoradar.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'LetsGo1234';
      const hash = await bcrypt.default.hash(adminPassword, 10);
      
      const [adminUser] = await migrateDb.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).where(eq(usersTable.email, adminEmail));
      if (adminUser) {
        await migrateDb.update(usersTable).set({ password: hash }).where(eq(usersTable.id, adminUser.id));
        console.log('[Migration] Admin password synced');
      } else {
        const existingAdmin = await migrateDb.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, 'admin'));
        if (existingAdmin.length > 0) {
          await migrateDb.update(usersTable).set({ email: adminEmail, password: hash }).where(eq(usersTable.id, existingAdmin[0].id));
          console.log('[Migration] Admin credentials updated');
        } else {
          await migrateDb.insert(usersTable).values({ username: 'admin', email: adminEmail, password: hash, role: 'admin' });
          console.log('[Migration] Admin user created');
        }
      }
    } catch (e: any) {
      console.error('[Migration] Admin update failed:', e.message);
    }

    // Register routes first for faster API availability
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

    startNotificationScheduler();
    startRssScheduler();
    expirePromotions().catch(console.error);

    app.use(rssSyncMiddleware);
    app.use(notificationSyncMiddleware);
    app.use((req: Request, res: Response, next: NextFunction) => {
      next();
      const now = Date.now();
      if (!lastPromotionCheck || (now - lastPromotionCheck) >= 5 * 60 * 1000) {
        lastPromotionCheck = now;
        expirePromotions().catch(console.error);
      }
    });
    console.log('Request-triggered schedulers registered (RSS 24h, notifications 1h, promotions 5min)');

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

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully...`);

  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10000);

  try {
    await closePool();
    console.log('[Shutdown] Cleanup complete');
    process.exit(0);
  } catch (err) {
    console.error('[Shutdown] Error during cleanup:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});