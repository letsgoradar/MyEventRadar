import type { Express } from "express";
import { storage } from "./storage";
import { insertEventSchema } from "@shared/schema";
import { z } from "zod";
import { log } from "./vite";

export async function registerRoutes(app: Express): Promise<void> {
  // Diagnostic endpoint
  app.get("/ping", (req, res) => {
    log("Received ping request");
    res.status(200).json({ message: "pong" });
  });

  // Event routes
  app.post("/api/events", async (req, res) => {
    try {
      log("Received event creation request");
      log("Request body:", JSON.stringify(req.body, null, 2));

      // Pre-validate required fields
      if (!req.body.title || !req.body.description || !req.body.location) {
        log("Missing required fields in request");
        return res.status(400).json({
          message: "Missing required fields",
          errors: ["title, description, and location are required"]
        });
      }

      // Pre-validate recurrence
      if (!['once', 'daily', 'weekly', 'monthly'].includes(req.body.recurrence)) {
        log("Invalid recurrence value:", req.body.recurrence);
        return res.status(400).json({
          message: "Invalid recurrence value. Must be one of: once, daily, weekly, monthly"
        });
      }

      // Parse dates before schema validation
      const eventData = {
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: req.body.endTime ? new Date(req.body.endTime) : null,
      };

      log("Attempting to parse event data:", JSON.stringify(eventData, null, 2));
      const data = insertEventSchema.parse(eventData);

      log("Successfully parsed event data, creating event");
      const event = await storage.createEvent(data);
      log("Event created successfully:", JSON.stringify(event, null, 2));

      res.json(event);
    } catch (error) {
      log("Error in event creation:", error);
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }));
        log("Validation errors:", JSON.stringify(formattedErrors, null, 2));
        res.status(400).json({ 
          message: "Validation error",
          errors: formattedErrors
        });
      } else {
        log("Internal server error:", error instanceof Error ? error.stack : String(error));
        res.status(500).json({ 
          message: "Internal server error",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  app.get("/api/events/nearby", async (req, res) => {
    try {
      const schema = z.object({
        lat: z.coerce.number(),
        lng: z.coerce.number(),
        radius: z.coerce.number(),
      });

      const { lat, lng, radius } = schema.parse({
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius,
      });

      const events = await storage.getEventsByRadius(lat, lng, radius);
      res.json(events);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    const event = await storage.getEvent(parseInt(req.params.id));
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }
    res.json(event);
  });

  app.post("/api/events/:id/participants", async (req, res) => {
    try {
      const data = insertParticipantSchema.parse({
        ...req.body,
        eventId: parseInt(req.params.id),
      });
      const participant = await storage.addParticipant(data);
      res.json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.delete("/api/events/:eventId/participants/:userId", async (req, res) => {
    try {
      await storage.removeParticipant(
        parseInt(req.params.userId),
        parseInt(req.params.eventId)
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/favorites", async (req, res) => {
    try {
      const favorite = await storage.addFavorite(req.body);
      res.json(favorite);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/favorites/:userId/:eventId", async (req, res) => {
    try {
      await storage.removeFavorite(
        parseInt(req.params.userId),
        parseInt(req.params.eventId)
      );
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/saved-searches", async (req, res) => {
    try {
      const data = insertSavedSearchSchema.parse(req.body);
      const savedSearch = await storage.saveSavedSearch(data);
      res.json(savedSearch);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.get("/api/users/:userId/saved-searches", async (req, res) => {
    try {
      const searches = await storage.getSavedSearchesByUser(parseInt(req.params.userId));
      res.json(searches);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
}