import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Add kill signal handling and cleanup
function handleShutdown(server: any) {
  ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
    process.on(signal, () => {
      log(`Received ${signal}, shutting down gracefully`);
      server.close(() => {
        log('Server closed');
        process.exit(0);
      });
    });
  });
}

// Function to check if port is in use
async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = require('net').createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        tester.once('close', () => resolve(false));
        tester.close();
      })
      .listen(port, '0.0.0.0');
  });
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
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
    log('Starting server...');

    // Check if port is already in use
    const port = 5000;
    const portInUse = await isPortInUse(port);

    if (portInUse) {
      log('Port 5000 is already in use. Please ensure no other instance is running.');
      process.exit(1);
    }

    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      log(`Error: ${message}`);
      res.status(status).json({ message });
    });

    // Setup vite in development mode
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    const startServer = () => {
      server.listen({
        port,
        host: "0.0.0.0",
      }, () => {
        log(`Server started successfully on port ${port}`);
      });

      // Setup graceful shutdown
      handleShutdown(server);
    };

    startServer();

  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
})();