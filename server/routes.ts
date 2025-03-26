import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertEventSchema, insertParticipantSchema, insertSavedSearchSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { isAuthenticated, isAdmin } from "./middleware/auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Hash the password before storing
      const passwordHash = await bcrypt.hash(req.body.password, 10);
      
      const data = insertUserSchema.parse({
        ...req.body,
        password: passwordHash
      });
      
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      const user = await storage.createUser(data);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Login route
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Store user in session
      req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });
  
  // Get current user
  app.get("/api/auth/me", isAuthenticated, (req, res) => {
    res.json(req.user);
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

      // Set a timeout for the fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
        {
          headers: {
            'User-Agent': 'EventApp/1.0 (https://replit.com/@user/EventApp)',
            'Accept': 'application/json',
            'Accept-Language': 'en'
          },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);

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


  // User's hosted events
  app.get('/api/users/:userId/hosted-events', async (req, res) => {
    const userId = Number(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
      const events = await storage.getEventsByHost(userId);
      return res.json(events);
    } catch (error) {
      console.error('Error fetching user\'s hosted events:', error);
      return res.status(500).json({ error: 'Failed to fetch hosted events' });
    }
  });

  // User's participating events
  app.get('/api/users/:userId/participating-events', async (req, res) => {
    const userId = Number(req.params.userId);

    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
      // Get the events where the user is a participant
      const participantEvents = await storage.getEventsForParticipant(userId);
      return res.json(participantEvents);
    } catch (error) {
      console.error('Error fetching user\'s participating events:', error);
      return res.status(500).json({ error: 'Failed to fetch participating events' });
    }
  });
  
  // ====== ADMIN ROUTES ======
  
  // Get all users (admin only)
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove passwords from the response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get all events (admin only)
  app.get('/api/admin/events', isAdmin, async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Update event (admin only)
  app.put('/api/admin/events/:id', isAdmin, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const updatedEvent = await storage.updateEvent(eventId, req.body);
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Delete event (admin only)
  app.delete('/api/admin/events/:id', isAdmin, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      await storage.deleteEvent(eventId);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting event:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Get statistics (admin only)
  app.get('/api/admin/statistics', isAdmin, async (req, res) => {
    try {
      const userCount = await storage.getUserCount();
      const eventCount = await storage.getEventCount();
      const participantCount = await storage.getParticipantCount();
      
      const statistics = {
        users: userCount,
        events: eventCount,
        participants: participantCount,
      };
      
      res.json(statistics);
    } catch (error) {
      console.error('Error fetching statistics:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}