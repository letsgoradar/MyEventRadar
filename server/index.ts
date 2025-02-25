import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add startup timestamp
const startTime = Date.now();
console.log('Server starting...');

// Use required port 5000
const PORT = 5000;
const HOST = '0.0.0.0';

(async () => {
  try {
    console.log('Initializing server configuration...');
    // Register routes first for faster API availability
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

    // Basic error handler
    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('Server error:', err);
      res.status(500).json({ message: "Internal Server Error" });
    });

    if (app.get("env") === "development") {
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
      console.error('Server failed to start:', error);
      process.exit(1);
    });

    console.log(`Attempting to start server on port ${PORT}...`);
    // Start listening with proper error handling
    server.listen({
      port: PORT,
      host: HOST,
    }, () => {
      const setupTime = Date.now() - startTime;
      log(`Server started on port ${PORT} (setup took ${setupTime}ms)`);
    });

  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
})();