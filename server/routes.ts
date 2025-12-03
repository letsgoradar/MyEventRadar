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
import themeHandler from "./theme-handler";

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
  app.use("/api", themeHandler);
  
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
  
  // Gebruiker verwijderen - alleen admin
  app.delete("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ongeldig gebruikers-ID" });
      }
      
      // Voorkom dat admin zichzelf verwijdert
      if (req.user?.id === userId) {
        return res.status(400).json({ message: "Je kunt jezelf niet verwijderen" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Gebruiker niet gevonden" });
      }
      
      await storage.deleteUser(userId);
      
      console.log(`Admin ${req.user?.username} deleted user ${user.username} (ID: ${userId})`);
      
      res.json({ message: "Gebruiker succesvol verwijderd" });
    } catch (error) {
      console.error('Error in DELETE /api/admin/users/:id:', error);
      res.status(500).json({ message: "Er is iets misgegaan bij het verwijderen" });
    }
  });
  
  // Gebruiker bewerken (rol wijzigen) - alleen admin
  app.patch("/api/admin/users/:id", isAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Ongeldig gebruikers-ID" });
      }
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Gebruiker niet gevonden" });
      }
      
      const { role, isPremium, name, email } = req.body;
      
      // Update alleen toegestane velden
      const updateData: Record<string, any> = {};
      if (role !== undefined) updateData.role = role;
      if (isPremium !== undefined) updateData.isPremium = isPremium;
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Verwijder wachtwoord uit de response
      const { password, ...userWithoutPassword } = updatedUser;
      
      console.log(`Admin ${req.user?.username} updated user ${user.username} (ID: ${userId}):`, updateData);
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in PATCH /api/admin/users/:id:', error);
      res.status(500).json({ message: "Er is iets misgegaan bij het bijwerken" });
    }
  });
  
  // Nieuwe gebruiker aanmaken - alleen admin
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const { username, email, password, role, name } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Gebruikersnaam, email en wachtwoord zijn verplicht" });
      }
      
      // Check of gebruiker al bestaat
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Er bestaat al een gebruiker met dit e-mailadres" });
      }
      
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Deze gebruikersnaam is al in gebruik" });
      }
      
      // Hash het wachtwoord
      const bcrypt = await import('bcryptjs');
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Maak de gebruiker aan
      const newUser = await storage.createUser({
        username,
        email,
        password: hashedPassword,
        role: role || 'user',
        name: name || username,
      });
      
      // Verwijder wachtwoord uit de response
      const { password: _, ...userWithoutPassword } = newUser;
      
      console.log(`Admin ${req.user?.username} created new user ${username} (ID: ${newUser.id})`);
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Error in POST /api/admin/users:', error);
      res.status(500).json({ message: "Er is iets misgegaan bij het aanmaken" });
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
  
  // Intelligente zoekterm generator - vertaalt Nederlandse titels naar Engelse Unsplash zoektermen
  app.post("/api/generate-search-term", async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1),
        excludeTerms: z.array(z.string()).optional().default([]),
      });
      
      const { title, excludeTerms } = schema.parse(req.body);
      
      // Gebruik OpenAI om een Engelse zoekterm te genereren
      const openaiKey = process.env.OPENAI_API_KEY;
      
      if (!openaiKey) {
        // Fallback: eenvoudige vertaling met hardcoded mappings
        const fallbackTerm = generateFallbackSearchTerm(title, excludeTerms);
        return res.json({ searchTerm: fallbackTerm, source: 'fallback' });
      }
      
      const excludeClause = excludeTerms.length > 0 
        ? `Do NOT use these terms: ${excludeTerms.join(', ')}.` 
        : '';
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert at generating English search terms for Unsplash photos. 
Given a Dutch event title, generate a single, simple English search term (1-3 words) that would find relevant photos.
Focus on the core activity or subject. Be specific but not too narrow.
${excludeClause}
Respond with ONLY the search term, nothing else.`
            },
            {
              role: 'user',
              content: title
            }
          ],
          max_tokens: 20,
          temperature: 0.7,
        }),
      });
      
      if (!response.ok) {
        console.error('OpenAI API error:', response.status);
        const fallbackTerm = generateFallbackSearchTerm(title, excludeTerms);
        return res.json({ searchTerm: fallbackTerm, source: 'fallback' });
      }
      
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const searchTerm = data.choices?.[0]?.message?.content?.trim() || generateFallbackSearchTerm(title, excludeTerms);
      
      console.log(`Generated search term for "${title}": "${searchTerm}"`);
      res.json({ searchTerm, source: 'openai' });
    } catch (error) {
      console.error('Error generating search term:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  // Fallback functie voor zoekterm generatie zonder OpenAI
  function generateFallbackSearchTerm(title: string, excludeTerms: string[]): string {
    // Nederlandse naar Engelse vertalingen voor veelvoorkomende event woorden
    const translations: Record<string, string[]> = {
      'voetbal': ['soccer', 'football match', 'sports field'],
      'basketbal': ['basketball', 'basketball court', 'sports'],
      'tennis': ['tennis', 'tennis court', 'racket sport'],
      'yoga': ['yoga class', 'meditation', 'fitness outdoor'],
      'muziek': ['music concert', 'live music', 'musicians playing'],
      'concert': ['live concert', 'music performance', 'stage'],
      'dans': ['dancing', 'dance class', 'dancers'],
      'kunst': ['art exhibition', 'gallery', 'artwork'],
      'schilderen': ['painting class', 'art studio', 'canvas'],
      'fotografie': ['photography', 'camera', 'photo walk'],
      'wandeling': ['hiking', 'nature walk', 'trail walking'],
      'hardlopen': ['running', 'jogging', 'marathon'],
      'fietsen': ['cycling', 'bicycle', 'bike ride'],
      'zwemmen': ['swimming', 'pool', 'swimmers'],
      'koken': ['cooking class', 'chef', 'kitchen'],
      'eten': ['food', 'dining', 'meal'],
      'bbq': ['barbecue', 'grill', 'outdoor cooking'],
      'barbecue': ['barbecue party', 'grill outdoors', 'summer bbq'],
      'picknick': ['picnic', 'outdoor lunch', 'park blanket'],
      'park': ['park', 'green space', 'outdoor'],
      'natuur': ['nature', 'outdoors', 'landscape'],
      'kinderen': ['children playing', 'kids activity', 'family fun'],
      'speeltuin': ['playground', 'children park', 'kids outdoor'],
      'hond': ['dog walking', 'dogs', 'pet walk'],
      'honden': ['dogs playing', 'dog park', 'pet community'],
      'koffie': ['coffee meeting', 'cafe', 'coffee shop'],
      'borrel': ['drinks', 'social gathering', 'happy hour'],
      'feest': ['party', 'celebration', 'festive'],
      'markt': ['market', 'outdoor market', 'street fair'],
      'bingo': ['bingo night', 'game night', 'community event'],
      'quiz': ['pub quiz', 'trivia night', 'game night'],
      'theater': ['theater', 'stage performance', 'drama'],
      'film': ['movie night', 'cinema', 'film screening'],
      'boek': ['book club', 'reading', 'library'],
      'taal': ['language class', 'learning', 'conversation'],
      'vrijwilliger': ['volunteering', 'community help', 'charity'],
      'opruimen': ['cleanup', 'community service', 'volunteers'],
      'planten': ['planting trees', 'gardening', 'green initiative'],
      'tuin': ['garden', 'gardening', 'plants'],
      'repair': ['repair cafe', 'fixing items', 'sustainability'],
      'sinterklaas': ['dutch celebration', 'winter festival', 'holiday parade'],
      'kerst': ['christmas', 'winter holiday', 'festive'],
      'ouderen': ['seniors', 'elderly community', 'retirement'],
      'buurt': ['neighborhood', 'community', 'local gathering'],
    };
    
    const titleLower = title.toLowerCase();
    const availableTerms: string[] = [];
    
    // Zoek matches in de titel
    for (const [dutch, english] of Object.entries(translations)) {
      if (titleLower.includes(dutch)) {
        for (const term of english) {
          if (!excludeTerms.includes(term)) {
            availableTerms.push(term);
          }
        }
      }
    }
    
    // Return een willekeurige term die nog niet gebruikt is
    if (availableTerms.length > 0) {
      return availableTerms[Math.floor(Math.random() * availableTerms.length)];
    }
    
    // Fallback: generieke community event termen
    const genericTerms = ['community event', 'people gathering', 'social activity', 'group activity', 'local event'];
    const available = genericTerms.filter(t => !excludeTerms.includes(t));
    return available.length > 0 ? available[0] : 'community';
  }

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
  
  // Eigen profiel bijwerken (voor de ingelogde gebruiker)
  app.patch("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Je moet ingelogd zijn" });
      }
      
      const userId = req.user.id;
      const { name, phone, location, bio } = req.body;
      
      // Update alleen toegestane velden
      const updateData: Record<string, string> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (location !== undefined) updateData.location = location;
      if (bio !== undefined) updateData.bio = bio;
      
      console.log(`Updating profile for user ${userId}:`, updateData);
      
      const updatedUser = await storage.updateUser(userId, updateData);
      
      // Verwijder wachtwoord uit de response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in PATCH /api/user/profile:', error);
      res.status(500).json({ message: "Er is iets misgegaan bij het opslaan van je profiel" });
    }
  });
  
  // Gebruikersprofiel bijwerken (via ID)
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
  
  // Evenement aanmaken - alleen voor ingelogde gebruikers
  app.post("/api/events", isAuthenticated, async (req, res) => {
    try {
      // Controleer of de gebruiker is ingelogd
      if (!req.user?.id) {
        return res.status(401).json({ message: "Je moet ingelogd zijn om een evenement aan te maken" });
      }
      
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
        hostId: req.user.id, // Gebruik de ingelogde gebruiker als host
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
  
  // Evenement bijwerken - alleen admin of eigenaar (PUT en PATCH)
  const handleEventUpdate = async (req: any, res: any) => {
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
      
      // Converteer datum strings naar Date objecten voor Drizzle
      const updateData = { ...req.body };
      if (typeof updateData.startTime === 'string') {
        updateData.startTime = new Date(updateData.startTime);
      }
      if (typeof updateData.endTime === 'string') {
        updateData.endTime = new Date(updateData.endTime);
      }
      
      const updatedEvent = await storage.updateEvent(eventId, updateData);
      
      // Broadcast de update
      broadcastEventUpdate(updatedEvent, 'update');
      
      res.json(updatedEvent);
    } catch (error) {
      console.error('Error updating event:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  };

  app.put("/api/events/:id", isAuthenticated, handleEventUpdate);
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
      
      // Converteer datum strings naar Date objecten voor Drizzle
      const updateData = { ...req.body };
      if (typeof updateData.startTime === 'string') {
        updateData.startTime = new Date(updateData.startTime);
      }
      if (typeof updateData.endTime === 'string') {
        updateData.endTime = new Date(updateData.endTime);
      }
      
      const updatedEvent = await storage.updateEvent(eventId, updateData);
      
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