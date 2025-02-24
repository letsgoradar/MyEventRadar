import express from "express";
import { createServer } from "http";

// Initialize express and create server
const app = express();
app.use(express.json());

// Basic request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Enable CORS for API access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// API routes
app.get("/ping", (req, res) => {
  console.log("Received ping request");
  res.status(200).json({ message: "pong" });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Create HTTP server
const server = createServer(app);

// Use environment variable for port with fallback to 5000
const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;

// Start server with proper error handling
console.log(`Starting server on port ${port}...`);
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
  console.log('Use /ping endpoint to test server functionality');
}).on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});