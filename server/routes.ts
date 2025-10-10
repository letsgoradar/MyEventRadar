import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";

import { setupAuth } from "./auth";
import { setupVite, serveStatic } from "./vite";
import { storage } from "./storage";
import { insertEventSchema, insertUserSchema, insertActivityLogSchema, insertSavedSearchSchema } from "@shared/schema";
import { isAdmin, isAuthenticated, attachUser } from "./middleware/auth";

// Routes voor profielfoto uploads
import profilePhotoRoutes from "./routes/profile-photo";
import generateImageRoutes from "./routes/generate-image";
import unsplashSearchRoutes from "./routes/unsplash-search";

// Query cache voor geocoding
const GEOCODING_CACHE = new Map();
const CACHE_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24 uur

export async function registerRoutes(app: Express): Promise<Server> {
  // Security: Rate limiting voor login/register endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuten
    max: 5, // Max 5 pogingen per 15 minuten
    message: { error: "Te veel inlogpogingen. Probeer over 15 minuten opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuten
    max: 100, // Max 100 requests per 15 minuten
    message: { error: "Te veel verzoeken. Probeer later opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Toepassen van rate limiting
  app.use("/api/login", authLimiter);
  app.use("/api/register", authLimiter);
  app.use("/api", generalLimiter);

  setupAuth(app);
  app.use("/api/profile-photo", profilePhotoRoutes);
  app.use("/api/generate-image", generateImageRoutes);
  app.use("/api/unsplash", unsplashSearchRoutes);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Serve static files (fix for build directory issue)
  try {
    serveStatic(app);
  } catch (error) {
    console.warn("Warning: Could not serve static files:", error.message);
    console.warn("This is expected in development mode.");
  }
  
  // WebSocket server voor realtime functionaliteit
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    
    // Send welcome message
    ws.send(JSON.stringify({ type: 'welcome', message: 'Welcome to the EventApp WebSocket Server' }));
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);
        
        // Handle different message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    });
    
    ws.on('close', () => {
      console.log('Client disconnected from WebSocket');
    });
  });
  
  // Broadcast event updates to all connected clients
  const broadcastEventUpdate = (event: any, action: 'create' | 'update' | 'delete') => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'event_update',
          action,
          data: event
        }));
      }
    });
  };
  
  // API endpoints
  // API health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  
  // Check if user is authenticated - voor alle gebruikers
  app.get("/api/auth/check", attachUser, (req, res) => {
    if (req.user) {
      res.json({
        authenticated: true,
        user: req.user
      });
    } else {
      res.json({
        authenticated: false,
        user: null
      });
    }
  });
  
  // Haal volledige gebruikersgegevens op inclusief profielfoto
  app.get("/api/current-user", attachUser, async (req, res) => {
    try {
      // Als een gebruiker is ingelogd, haal dan zijn/haar gegevens op
      if (req.user && req.user.id) {
        const userId = req.user.id;
        const user = await storage.getUser(userId);
        
        if (!user) {
          return res.status(404).json({ message: "Gebruiker niet gevonden" });
        }
        
        // Verwijder wachtwoord uit de response
        const { password, ...userWithoutPassword } = user;
        
        res.json(userWithoutPassword);
      } else {
        res.status(401).json({ message: "Niet geautoriseerd" });
      }
    } catch (error) {
      console.error('Error in /api/current-user:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Alle gebruikers ophalen - alleen admin
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      
      // Verwijder wachtwoorden uit de response
      const usersWithoutPasswords = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Error in /api/admin/users:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Specifieke gebruiker ophalen - alleen admin
  app.get("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Gebruiker niet gevonden" });
      }
      
      // Verwijder wachtwoord uit de response
      const { password, ...userWithoutPassword } = user;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in /api/admin/users/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Haal events op die binnen straal vallen
  app.get("/api/events/nearby", async (req, res) => {
    try {
      const schema = z.object({
        lat: z.coerce.number(),
        lng: z.coerce.number(),
        radius: z.coerce.number().default(10),
      });

      const { lat, lng, radius } = schema.parse({
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius,
      });

      console.log('GET /api/events/nearby params:', { lat, lng, radius });
      
      const events = await storage.getEventsByRadius(lat, lng, radius);
      
      // Sorteer events: highlights eerst (op priority), dan dichtstbij
      const sortedEvents = events.sort((a, b) => {
        // Check if events are highlighted and within highlight period
        const now = new Date();
        const aHighlighted = a.isHighlighted && 
          (!a.highlightStartDate || new Date(a.highlightStartDate) <= now) &&
          (!a.highlightEndDate || new Date(a.highlightEndDate) >= now);
        const bHighlighted = b.isHighlighted && 
          (!b.highlightStartDate || new Date(b.highlightStartDate) <= now) &&
          (!b.highlightEndDate || new Date(b.highlightEndDate) >= now);
        
        // Highlighted events first
        if (aHighlighted && !bHighlighted) return -1;
        if (!aHighlighted && bHighlighted) return 1;
        
        // If both highlighted, sort by priority
        if (aHighlighted && bHighlighted) {
          return (b.highlightPriority || 0) - (a.highlightPriority || 0);
        }
        
        // For non-highlighted events, maintain original order (by distance)
        return 0;
      });
      
      res.json(sortedEvents);
    } catch (error) {
      console.error('Error in /api/events/nearby:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Events zoeken op basis van een query string
  app.get("/api/events/search", async (req, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      });

      const { query, startDate, endDate } = schema.parse({
        query: req.query.query,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      });

      console.log('GET /api/events/search params:', { query, startDate, endDate });
      
      // Haal alle evenementen op
      const allEvents = await storage.getAllEvents();
      
      // Filter de evenementen op basis van de zoekterm
      let filteredEvents = allEvents.filter(event => {
        const title = event.title.toLowerCase();
        const description = event.description?.toLowerCase() || "";
        const category = event.category.toLowerCase();
        const address = event.address?.toLowerCase() || "";
        
        const searchQuery = query.toLowerCase();
        
        return title.includes(searchQuery) || 
               description.includes(searchQuery) || 
               category.includes(searchQuery) || 
               address.includes(searchQuery);
      });
      
      // Filter op datum als die is meegegeven
      if (startDate) {
        const startDateTime = new Date(startDate).getTime();
        filteredEvents = filteredEvents.filter(event => {
          const eventStartTime = new Date(event.startTime).getTime();
          return eventStartTime >= startDateTime;
        });
      }
      
      if (endDate) {
        const endDateTime = new Date(endDate).getTime();
        filteredEvents = filteredEvents.filter(event => {
          const eventStartTime = new Date(event.startTime).getTime();
          return eventStartTime <= endDateTime;
        });
      }
      
      res.json(filteredEvents);
    } catch (error) {
      console.error('Error in /api/events/search:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Events ophalen die door een specifieke gebruiker zijn aangemaakt
  app.get("/api/events/byuser/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const events = await storage.getEventsByHost(userId);
      res.json(events);
    } catch (error) {
      console.error('Error in /api/events/byuser/:userId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Events ophalen waar een gebruiker aan deelneemt
  app.get("/api/events/participation/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const events = await storage.getEventsForParticipant(userId);
      res.json(events);
    } catch (error) {
      console.error('Error in /api/events/participation/:userId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Favoriet evenement toevoegen voor een gebruiker
  app.post("/api/favorite", isAuthenticated, async (req, res) => {
    try {
      // Voeg de ingelogde gebruiker ID toe aan de data
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const eventId = parseInt(req.body.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Voeg de favoriet toe
      const favorite = await storage.addFavorite({
        userId,
        eventId
      });
      
      res.status(201).json(favorite);
    } catch (error) {
      console.error('Error in POST /api/favorite:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Favoriet verwijderen
  app.delete("/api/favorite/:eventId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Verwijder de favoriet
      await storage.removeFavorite(userId, eventId);
      
      res.status(200).json({ message: "Favorite removed" });
    } catch (error) {
      console.error('Error in DELETE /api/favorite/:eventId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Notificaties van ingelogde gebruiker ophalen
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error in GET /api/notifications:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Notificatie markeren als gelezen
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error('Error in PATCH /api/notifications/:id/read:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Favorieten van ingelogde gebruiker ophalen
  app.get("/api/events/favorites", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const favorites = await storage.getFavoritesByUser(userId);
      res.json(favorites);
    } catch (error) {
      console.error('Error in GET /api/events/favorites:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/favorites/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const favorites = await storage.getFavoritesByUser(userId);
      res.json(favorites);
    } catch (error) {
      console.error('Error in GET /api/favorites/:userId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Deelnemen aan een evenement
  app.post("/api/participate", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const eventId = parseInt(req.body.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Voeg de deelnemer toe
      const participant = await storage.addParticipant({
        userId,
        eventId,
        status: "confirmed"
      });
      
      res.status(201).json(participant);
    } catch (error) {
      console.error('Error in POST /api/participate:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Deelname aan een evenement annuleren
  app.delete("/api/participate/:eventId", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Verwijder de deelnemer
      await storage.removeParticipant(userId, eventId);
      
      res.status(200).json({ message: "Participation cancelled" });
    } catch (error) {
      console.error('Error in DELETE /api/participate/:eventId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Deelnemers van een evenement ophalen
  app.get("/api/participants/:eventId", async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const participants = await storage.getEventParticipants(eventId);
      
      // Verwijder gevoelige informatie
      const safeParticipants = participants.map(p => {
        const { password, ...safe } = p;
        return safe;
      });
      
      res.json(safeParticipants);
    } catch (error) {
      console.error('Error in GET /api/participants/:eventId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Opgeslagen zoekopdrachten voor een gebruiker
  app.post("/api/saved-search", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const searchData = insertSavedSearchSchema.parse({
        ...req.body,
        userId
      });
      
      const savedSearch = await storage.saveSavedSearch(searchData);
      
      res.status(201).json(savedSearch);
    } catch (error) {
      console.error('Error in POST /api/saved-search:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Opgeslagen zoekopdrachten van een gebruiker ophalen
  app.get("/api/saved-searches/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      const savedSearches = await storage.getSavedSearchesByUser(userId);
      res.json(savedSearches);
    } catch (error) {
      console.error('Error in GET /api/saved-searches/:userId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Specifiek evenement ophalen
  app.get("/api/events/:id", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      res.json(event);
    } catch (error) {
      console.error('Error in GET /api/events/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Activiteitenlog ophalen - alleen admin
  app.get("/api/admin/activity-logs", isAdmin, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : undefined;
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const activityType = req.query.type as string;
      
      const logs = await storage.getActivityLogs({
        limit,
        offset,
        userId,
        activityType
      });
      
      res.json(logs);
    } catch (error) {
      console.error('Error in GET /api/admin/activity-logs:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Activiteitenlog toevoegen
  app.post("/api/admin/activity-log", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id || 0;
      
      const logData = insertActivityLogSchema.parse({
        ...req.body,
        userId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'Unknown'
      });
      
      const log = await storage.logActivity(logData);
      
      res.status(201).json(log);
    } catch (error) {
      console.error('Error in POST /api/admin/activity-log:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Verkrijg locatie naam o.b.v. lat/lng
  app.get("/api/location/name", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      // Check cache
      const cacheKey = `${lat},${lng}`;
      const cached = GEOCODING_CACHE.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_EXPIRES_MS) {
        return res.json({ city: cached.city });
      }
      
      // Call OpenStreetMap Nominatim API
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'EventApp/1.0'
        }
      });
      
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
      console.error('Error in GET /api/location/name:', error);
      res.status(500).json({ city: "Unknown location" });
    }
  });
  
  // Gebruikersprofiel bijwerken
  app.patch("/api/users/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check of de gebruiker zichzelf bijwerkt of een admin is
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Update de gebruiker
      const updatedUser = await storage.updateUser(userId, req.body);
      
      // Verwijder wachtwoord uit de response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in PATCH /api/users/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Evenement aanmaken
  app.post("/api/events", async (req, res) => {
    try {
      // Parse de request body met het schema (verplichte velden)
      // We gebruiken een aangepast schema dat de locatie lat/lng verwerkt
      
      // Fix voor maxParticipants waarde - zorg ervoor dat een 0 wordt behandeld als een geldige waarde (geen null)
      if (req.body.maxParticipants === null || req.body.maxParticipants === undefined) {
        req.body.maxParticipants = 0; // Standaard waarde
      }
      
      // Stel notificationReach in als die niet wordt meegestuurd
      if (!req.body.notificationReach) {
        req.body.notificationReach = 1.5; // Standaard bereik in km
      }
      
      // Zorg ervoor dat latitude en longitude expliciet worden ingesteld
      // Ondersteuning voor zowel oude formaat (location object) als nieuwe formaat (directe velden)
      let latitude, longitude, address;
      
      if (req.body.location) {
        // Oud formaat - uit location object
        latitude = req.body.location.lat;
        longitude = req.body.location.lng;
        address = req.body.location.locationName;
      } else {
        // Nieuw formaat - directe velden
        latitude = req.body.latitude;
        longitude = req.body.longitude;
        address = req.body.address;
      }
      
      const eventData = {
        title: req.body.title,
        description: req.body.description,
        latitude: latitude,
        longitude: longitude,
        address: address,
        notificationReach: req.body.notificationReach,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        category: req.body.category,
        secondaryCategory: req.body.secondaryCategory,
        isPaid: req.body.isPaid,
        price: req.body.price,
        maxParticipants: req.body.maxParticipants,
        hostId: req.body.hostId,
        recurrence: req.body.recurrence || 'once',
        tags: req.body.tags || [],
        imageUrl: req.body.imageUrl,
      };
      
      console.log("Event data to be inserted:", eventData);
      
      // Valideer met Zod schema
      const validatedData = insertEventSchema.parse(eventData);
      
      // Sla op in de database
      const event = await storage.createEvent(validatedData);
      
      // Broadcast het nieuwe evenement
      broadcastEventUpdate(event, 'create');
      
      res.status(201).json(event);
    } catch (error) {
      console.error('Error in POST /api/events:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: error.errors });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // Evenement bijwerken - alleen admin of eigenaar
  app.patch("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Haal het bestaande evenement op
      const existingEvent = await storage.getEvent(eventId);
      
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check of de gebruiker de eigenaar is of een admin
      if (req.user?.id !== existingEvent.hostId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Update het evenement
      // Fix voor maxParticipants - zet op 0 als niet gespecificeerd
      if (req.body.maxParticipants === null) {
        req.body.maxParticipants = 0;
      }
      
      const updatedEvent = await storage.updateEvent(eventId, req.body);
      
      // Broadcast de update
      broadcastEventUpdate(updatedEvent, 'update');
      
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error in PATCH /api/events/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Evenement verwijderen - alleen admin of eigenaar
  app.delete("/api/events/:id", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      // Haal het bestaande evenement op
      const existingEvent = await storage.getEvent(eventId);
      
      if (!existingEvent) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Check of de gebruiker de eigenaar is of een admin
      if (req.user?.id !== existingEvent.hostId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      // Verwijder het evenement
      await storage.deleteEvent(eventId);
      
      // Broadcast de verwijdering
      broadcastEventUpdate({ id: eventId }, 'delete');
      
      res.status(200).json({ message: "Event deleted" });
    } catch (error) {
      console.error('Error in DELETE /api/events/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Alle evenementen ophalen - voor admin en testen
  app.get("/api/admin/events", async (req, res) => {
    try {
      const events = await storage.getAllEvents();
      res.json(events);
    } catch (error) {
      console.error('Error in GET /api/admin/events:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Notification API endpoints
  app.get("/api/notifications/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user can access these notifications
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const notifications = await storage.getNotificationsByUser(userId);
      res.json(notifications);
    } catch (error) {
      console.error('Error in GET /api/notifications/:userId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/notifications/:userId/unread-count", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Check if user can access these notifications
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
      }
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error in GET /api/notifications/:userId/unread-count:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      await storage.markNotificationAsRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error('Error in PATCH /api/notifications/:id/read:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Setup VITE server
  await setupVite(app, httpServer);
  
  return httpServer;
}