import express from "express";
import { createServer } from "http";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize express and create server
const app = express();
app.use(express.json());


// Security headers middleware
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Diagnostic endpoint
app.get("/ping", (req, res) => {
  console.log("Received ping request");
  res.status(200).json({ message: "pong" });
});


// Serve static files from the client build directory
app.use(express.static(path.join(__dirname, '../client/build')));

// Root route handler (Fallback for SPA)
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
});


// Basic error handling
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Create HTTP server
const server = createServer(app);
const port = 5000;

// Start server
server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});