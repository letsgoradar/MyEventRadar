import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add startup timing logging
const startTime = Date.now();
log('Server starting initialization...');

// Add minimal request logging middleware
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
  }
  next();
});

(async () => {
  try {
    log('Registering routes...');
    const server = await registerRoutes(app);

    // Add error handling middleware
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
      console.error('Server error:', err);
    });

    log('Setting up Vite/Static serving...');
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Listen only on port 5000
    log('Starting server...');
    server.listen(5000, "0.0.0.0", () => {
      const startupDuration = Date.now() - startTime;
      log(`Server started on port 5000 (startup took ${startupDuration}ms)`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();