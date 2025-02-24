import express, { type Request, Response, NextFunction } from "express";
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
  console.log(`${req.method} ${req.path} - Starting`);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`Request body: ${JSON.stringify(req.body, null, 2)}`);
  }

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });

  next();
});

// Error handling
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error(`Error: ${message}`);
  if (err.stack) {
    console.error(`Stack trace: ${err.stack}`);
  }
  res.status(status).json({ message });
});

// Start server
async function startServer() {
  try {
    console.log('Starting server initialization...');

    // Add diagnostic endpoint directly
    app.get("/ping", (req, res) => {
      console.log("Received ping request");
      res.status(200).json({ message: "pong" });
    });
    console.log('Diagnostic endpoint added');

    // Start listening
    const port = 5000;
    server.listen(port, "0.0.0.0", () => {
      console.log(`Server running on port ${port}`);
    });

  } catch (error) {
    console.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

startServer();