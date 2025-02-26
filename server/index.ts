// Set development mode by default
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}
console.log("Starting server with NODE_ENV:", process.env.NODE_ENV);

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// Enhanced error handling middleware
const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
};

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Add startup timestamp
const startTime = Date.now();
console.log('Server starting...');

// Use required port 5000
const PORT = 5000;
const HOST = '0.0.0.0';

// Improved async server startup
(async () => {
  try {
    console.log('Initializing server configuration...');

    // Register routes first for faster API availability
    const server = await registerRoutes(app);
    console.log('Routes registered successfully');

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
        console.error(`Port ${PORT} is already in use. Please free up the port and try again.`);
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