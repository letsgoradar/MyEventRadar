import express, { type Request, Response, NextFunction } from "express";
import { setupVite, log } from "./vite";
import { createServer } from "http";

// Initialize express and create server
const app = express();
const server = createServer(app);

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple request logging with detailed information
app.use((req, res, next) => {
  const start = Date.now();
  log(`${req.method} ${req.path} - Starting`);

  if (req.body && Object.keys(req.body).length > 0) {
    log(`Request body: ${JSON.stringify(req.body, null, 2)}`);
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  log(`Error: ${message}`);
  if (err.stack) {
    log(`Stack trace: ${err.stack}`);
  }
  res.status(status).json({ message });
});

// Start server
async function startServer() {
  try {
    log('Starting server initialization...');

    // Add diagnostic endpoint directly
    app.get("/ping", (req, res) => {
      log("Received ping request");
      res.status(200).json({ message: "pong" });
    });
    log('Diagnostic endpoint added');

    // Start listening
    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      log(`Server running on port ${port}`);
    });

  } catch (error) {
    log(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

startServer();