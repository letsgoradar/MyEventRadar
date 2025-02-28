import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertEventSchema, insertParticipantSchema, insertSavedSearchSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const user = await storage.createUser(data);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Event routes
  app.post("/api/events", async (req, res) => {
    try {
      console.log("Received event data:", req.body);
      const data = insertEventSchema.parse({
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: req.body.endTime ? new Date(req.body.endTime) : null,
      });
      console.log("Parsed event data:", data);
      const event = await storage.createEvent(data);
      console.log("Created event:", event);
      res.json(event);
    } catch (error) {
      console.error("Error creating event:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
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

      console.log('GET /api/events/nearby params:', { lat, lng, radius });
      const events = await storage.getEventsByRadius(lat, lng, radius);
      console.log('Found events:', events.length);
      res.json(events);
    } catch (error) {
      console.error('Error in /api/events/nearby:', error);
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

  // Participants routes
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

  // Favorites routes
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

  // Saved searches routes
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

  // Geocoding endpoint with rate limiting
  const GEOCODING_CACHE = new Map();
  const CACHE_DURATION = 1000 * 60 * 60; // 1 hour
  const RATE_LIMIT_DELAY = 1100; // 1.1 seconds between requests
  let lastRequestTime = 0;
  
  app.get("/api/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;
      if (!lat || !lng) {
        return res.status(400).json({ city: "Unknown location" });
      }

      const cacheKey = `${lat},${lng}`;
      const cached = GEOCODING_CACHE.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return res.json({ city: cached.city });
      }

      // Ensure minimum delay between requests
      const now = Date.now();
      const timeSinceLastRequest = now - lastRequestTime;
      if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest));
      }
      lastRequestTime = Date.now();
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
        {
          headers: {
            'User-Agent': 'EventApp/1.0 (https://replit.com/@user/EventApp)',
            'Accept': 'application/json',
            'Accept-Language': 'en'
          },
          timeout: 5000
        }
      );

      if (!response.ok) {
        console.error("Geocoding error status:", response.status);
        return res.json({ city: "Unknown location" });
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error("Invalid content type:", contentType);
        return res.json({ city: "Unknown location" });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Geocoding error:", response.status, response.statusText, errorText);
        return res.status(500).json({ city: "Unknown location" });
      }
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse geocoding response:", text.substring(0, 100));
        return res.status(500).json({ city: "Unknown location" });
      }
      
      const city = data.address?.city || 
                   data.address?.town || 
                   data.address?.village || 
                   data.address?.municipality ||
                   "Unknown location";
      
      // Cache the result
      GEOCODING_CACHE.set(cacheKey, {
        city,
        timestamp: Date.now()
      });
      
      res.json({ city });
    } catch (error) {
      console.error("Geocoding error:", error);
      res.status(500).json({ city: "Unknown location" });
    }
  });

  const httpServer = createServer(app);
  // My events route
  app.get('/api/events/my-events', async (req, res) => {
    const userId = req.header('X-User-ID'); // In a real app, this would come from authentication
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Get events where hostId matches the current user
      const myEvents = await storage.getEventsByHostId(parseInt(userId));
      
      return res.status(200).json(myEvents);
    } catch (error) {
      console.error('Error fetching my events:', error);
      return res.status(500).json({ error: 'Failed to fetch my events' });
    }
  });

  // Favorite events routes
  app.get('/api/events/favorites', async (req, res) => {
    const userId = req.header('X-User-ID'); // In a real app, this would come from authentication
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Get favorite events for the current user
      const favoriteEvents = await storage.getFavoritesByUserId(parseInt(userId));
      
      // Map the results with isFavorite flag
      const events = favoriteEvents.map(event => ({
        ...event,
        isFavorite: true
      }));
      
      return res.status(200).json(events);
    } catch (error) {
      console.error('Error fetching favorite events:', error);
      return res.status(500).json({ error: 'Failed to fetch favorite events' });
    }
  });

  // Toggle favorite status
  app.post('/api/events/:id/favorite', async (req, res) => {
    const eventId = parseInt(req.params.id);
    const userId = req.header('X-User-ID'); // In a real app, this would come from authentication
    const { isFavorite } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      if (isFavorite) {
        // Add to favorites
        await storage.addFavorite({
          userId: parseInt(userId),
          eventId: eventId
        });
      } else {
        // Remove from favorites
        await storage.removeFavorite(parseInt(userId), eventId);
      }
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating favorite status:', error);
      return res.status(500).json({ error: 'Failed to update favorite status' });
    }
  });

  // Update event route
  app.put('/api/events/:id', async (req, res) => {
    const eventId = parseInt(req.params.id);
    const userId = req.header('X-User-ID'); // In a real app, this would come from authentication
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Verify the user owns this event
      const event = await storage.getEvent(eventId);
      
      if (!event || event.hostId !== parseInt(userId)) {
        return res.status(403).json({ error: 'You do not have permission to edit this event' });
      }
      
      // Update the event
      const updatedEvent = await storage.updateEvent({
        id: eventId,
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: req.body.endTime ? new Date(req.body.endTime) : null,
        maxParticipants: parseInt(req.body.maxParticipants),
        notificationReach: parseInt(req.body.notificationReach),
        hostId: parseInt(userId)
      });
      
      return res.status(200).json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      return res.status(500).json({ error: 'Failed to update event' });
    }
  });

  // Delete event route
  app.delete('/api/events/:id', async (req, res) => {
    const eventId = parseInt(req.params.id);
    const userId = req.header('X-User-ID'); // In a real app, this would come from authentication
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      // Verify the user owns this event
      const event = await storage.getEvent(eventId);
      
      if (!event || event.hostId !== parseInt(userId)) {
        return res.status(403).json({ error: 'You do not have permission to delete this event' });
      }
      
      // Delete the event
      await storage.deleteEvent(eventId);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting event:', error);
      return res.status(500).json({ error: 'Failed to delete event' });
    }
  });

  return httpServer;
}
