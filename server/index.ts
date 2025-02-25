import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add startup timestamp
const startTime = Date.now();
console.log('Server starting...');

(async () => {
  try {
    // Register routes first for faster API availability
    const server = await registerRoutes(app);

    // Basic error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json({ message: "Internal Server Error" });
    });

    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }

    // Start listening immediately
    server.listen({
      port: 5000,
      host: "0.0.0.0",
    }, () => {
      const setupTime = Date.now() - startTime;
      log(`Server started on port 5000 (setup took ${setupTime}ms)`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();