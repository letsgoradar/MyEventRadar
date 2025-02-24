import express from "express";
import { createServer } from "http";

// Initialize express and create server
const app = express();
app.use(express.json());

// Diagnostic endpoint
app.get("/ping", (req, res) => {
  console.log("Received ping request");
  res.status(200).json({ message: "pong" });
});

// Create HTTP server and listen on port 5000
const server = createServer(app);
const port = 5000;

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});