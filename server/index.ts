import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add startup timing logging
const startTime = Date.now();
log('Server starting initialization...');

// Add request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        if (Array.isArray(capturedJsonResponse)) {
          logLine += ` :: Returned ${capturedJsonResponse.length} items`;
        } else {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

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

    // Try different ports if 5000 is in use
    const tryPort = (port: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        server.listen({
          port,
          host: "0.0.0.0",
          reusePort: true,
        })
        .on('listening', () => {
          const startupDuration = Date.now() - startTime;
          log(`Server started on port ${port} (startup took ${startupDuration}ms)`);
          resolve();
        })
        .on('error', (err: any) => {
          if (err.code === 'EADDRINUSE' && port < 5010) {
            log(`Port ${port} in use, trying ${port + 1}`);
            tryPort(port + 1).then(resolve).catch(reject);
          } else {
            reject(err);
          }
        });
      });
    };

    log('Starting server...');
    await tryPort(5000);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();