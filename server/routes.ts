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
import { AiProvider } from "./services/ai-provider";
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

// Progress tracking voor feed sync operaties
interface SyncProgress {
  feedId: number;
  feedName: string;
  status: 'pending' | 'fetching' | 'processing' | 'completed' | 'error';
  totalItems: number;
  processedItems: number;
  eventsCreated: number;
  eventsSkipped: number;
  eventsRejected: number;
  rejectionReasons: Record<string, number>;
  startTime: number;
  message?: string;
  error?: string;
}
const SYNC_PROGRESS = new Map<number, SyncProgress>();

// Progress tracking voor sync-all operatie
interface SyncAllProgress {
  isRunning: boolean;
  totalFeeds: number;
  completedFeeds: number;
  currentFeedId: number | null;
  currentFeedName: string | null;
  feedResults: Array<{
    feedId: number;
    feedName: string;
    status: 'success' | 'error' | 'skipped';
    eventsCreated: number;
    eventsSkipped?: number;
    eventsRejected?: number;
    rejectionReasons?: Record<string, number>;
    message?: string;
  }>;
  startTime: number;
  delayBetweenFeeds: number;
  nextFeedIn?: number;
  // Aggregate stats
  totalEventsCreated?: number;
  totalEventsSkipped?: number;
  totalEventsRejected?: number;
}
let SYNC_ALL_PROGRESS: SyncAllProgress | null = null;

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
    skip: (req) => {
      // Skip rate limiting for admin routes (admins are trusted)
      return req.path.startsWith('/api/admin');
    }
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
  
  // Admin statistieken ophalen
  app.get("/api/admin/statistics", isAdmin, async (req, res) => {
    try {
      // Haal alle data op
      const users = await storage.getAllUsers();
      const events = await storage.getAllEvents();
      const participants = await storage.getAllParticipants();
      const activityLogs = await storage.getActivityLogs({ limit: 100 });
      
      // Bereken statistieken
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Gebruikers per maand (laatste 6 maanden)
      const usersByMonth: { month: string; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthName = monthStart.toLocaleDateString('nl-NL', { month: 'short' });
        const count = users.filter(u => {
          const createdAt = u.createdAt ? new Date(u.createdAt) : null;
          return createdAt && createdAt >= monthStart && createdAt <= monthEnd;
        }).length;
        usersByMonth.push({ month: monthName, count });
      }
      
      // Evenementen per categorie
      const eventsByCategory: { category: string; count: number }[] = [];
      const categoryMap = new Map<string, number>();
      events.forEach(e => {
        const cat = e.category || 'Onbekend';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });
      categoryMap.forEach((count, category) => {
        eventsByCategory.push({ category, count });
      });
      eventsByCategory.sort((a, b) => b.count - a.count);
      
      // Recente evenementen (laatste 5)
      const recentEvents = events
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 5)
        .map(e => ({
          id: e.id,
          title: e.title,
          date: e.startTime ? new Date(e.startTime).toLocaleDateString('nl-NL') : 'Onbekend',
          category: e.category || 'Onbekend'
        }));
      
      // Top gebruikers (meeste evenementen gehost)
      const userEventCounts = new Map<number, { hosted: number; participated: number }>();
      events.forEach(e => {
        if (e.hostId) {
          const current = userEventCounts.get(e.hostId) || { hosted: 0, participated: 0 };
          current.hosted++;
          userEventCounts.set(e.hostId, current);
        }
      });
      participants.forEach(p => {
        const current = userEventCounts.get(p.userId) || { hosted: 0, participated: 0 };
        current.participated++;
        userEventCounts.set(p.userId, current);
      });
      
      const topUsers = Array.from(userEventCounts.entries())
        .sort((a, b) => b[1].hosted - a[1].hosted)
        .slice(0, 5)
        .map(([userId, counts]) => {
          const user = users.find(u => u.id === userId);
          return {
            id: userId,
            username: user?.name || user?.username || 'Onbekend',
            eventsHosted: counts.hosted,
            eventsParticipated: counts.participated
          };
        });
      
      // Nieuwe gebruikers deze week/maand
      const newUsersThisWeek = users.filter(u => {
        const createdAt = u.createdAt ? new Date(u.createdAt) : null;
        return createdAt && createdAt >= oneWeekAgo;
      }).length;
      
      const newUsersThisMonth = users.filter(u => {
        const createdAt = u.createdAt ? new Date(u.createdAt) : null;
        return createdAt && createdAt >= oneMonthAgo;
      }).length;
      
      // Komende evenementen
      const upcomingEvents = events.filter(e => {
        const startTime = e.startTime ? new Date(e.startTime) : null;
        return startTime && startTime >= now;
      }).length;
      
      // Voorbije evenementen
      const pastEvents = events.filter(e => {
        const startTime = e.startTime ? new Date(e.startTime) : null;
        return startTime && startTime < now;
      }).length;
      
      res.json({
        userCount: users.length,
        eventsCount: events.length,
        participantsCount: participants.length,
        activityLogsCount: activityLogs.length,
        newUsersThisWeek,
        newUsersThisMonth,
        upcomingEvents,
        pastEvents,
        usersByMonth,
        eventsByCategory: eventsByCategory.slice(0, 8),
        recentEvents,
        topUsers
      });
    } catch (error) {
      console.error('Error in /api/admin/statistics:', error);
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
        windowDays: z.union([z.coerce.number(), z.literal('all')]).optional().default(14),
      });

      const parsed = schema.parse({
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius,
        windowDays: req.query.windowDays,
      });
      
      const { lat, lng, radius } = parsed;
      // windowDays: standaard 14 dagen, 'all' betekent geen filter
      const windowDays = parsed.windowDays === 'all' ? null : parsed.windowDays;

      console.log('GET /api/events/nearby params:', { lat, lng, radius, windowDays });
      
      const events = await storage.getEventsByRadius(lat, lng, radius, windowDays);
      
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
      
      const excludeClause = excludeTerms.length > 0 
        ? `Do NOT use these terms: ${excludeTerms.join(', ')}.` 
        : '';
      
      const result = await AiProvider.complete({
        systemPrompt: `You are an expert at generating English search terms for Unsplash photos. 
Given a Dutch event title, generate a single, simple English search term (1-3 words) that would find relevant photos.
Focus on the core activity or subject. Be specific but not too narrow.
${excludeClause}
Respond with ONLY the search term, nothing else.`,
        userPrompt: title,
        maxTokens: 20,
        temperature: 0.7,
        jsonMode: false
      });
      
      if (!result.success || !result.content) {
        const fallbackTerm = generateFallbackSearchTerm(title, excludeTerms);
        return res.json({ searchTerm: fallbackTerm, source: 'fallback' });
      }
      
      const searchTerm = result.content.trim();
      
      console.log(`Generated search term for "${title}": "${searchTerm}"`);
      res.json({ searchTerm, source: 'gemini' });
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
      
      // Voeg de favoriet toe (returns null als deze al bestaat)
      const favorite = await storage.addFavorite({
        userId,
        eventId
      });
      
      if (favorite) {
        // Alleen counter verhogen als favoriet daadwerkelijk is toegevoegd
        await storage.incrementSavesCount(eventId);
        res.status(201).json(favorite);
      } else {
        // Favoriet bestaat al
        res.status(200).json({ message: "Already favorited" });
      }
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
      
      // Verwijder de favoriet (returns true als daadwerkelijk verwijderd)
      const wasDeleted = await storage.removeFavorite(userId, eventId);
      
      if (wasDeleted) {
        // Alleen counter verlagen als favoriet daadwerkelijk is verwijderd
        await storage.decrementSavesCount(eventId);
      }
      
      res.status(200).json({ message: "Favorite removed" });
    } catch (error) {
      console.error('Error in DELETE /api/favorite/:eventId:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track detail page views
  app.post("/api/events/:id/track-view", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      // Check if event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Increment the detail views counter
      await storage.incrementDetailViews(eventId);

      res.json({ 
        success: true, 
        message: "Detail view tracked" 
      });
    } catch (error) {
      console.error('Error in POST /api/events/:id/track-view:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track externe pagina openen (voor toekomstige monetisatie)
  app.post("/api/events/:id/track-external-open", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      // Check if event exists and has external URL
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      if (!event.externalUrl) {
        return res.status(400).json({ message: "Event has no external URL" });
      }

      // Increment the counter
      await storage.incrementExternalPageOpens(eventId);

      res.json({ 
        success: true, 
        externalUrl: event.externalUrl,
        message: "External page open tracked" 
      });
    } catch (error) {
      console.error('Error in POST /api/events/:id/track-external-open:', error);
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

  // RSS Feed API endpoints
  
  // Get feed import principles/rules documentation
  app.get("/api/admin/feed-import-principles", isAdmin, async (req, res) => {
    try {
      const { RssFeedService } = await import("./services/rss-feed-service");
      const principles = RssFeedService.getFeedImportPrinciples();
      res.json({ 
        principles,
        rules: {
          requireVerifiedLocation: true,
          requireDateBound: true,
          preferSourceImage: true,
          consolidateMultiDayEvents: true,
          skipDuplicates: true,
          useUnknownForMissingTime: true
        }
      });
    } catch (error) {
      console.error('Error in GET /api/admin/feed-import-principles:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/rss-feeds", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      res.json(feeds);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/rss-feeds/overview", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      const overview: Record<number, { 
        totalActive: number; 
        incomplete: number; 
        addedLastSync: number;
        lastSyncDate: string | null;
      }> = {};
      
      for (const feed of feeds) {
        const summary = await storage.getFeedItemsSummary(feed.id);
        
        const feedItems = await storage.getRssFeedItems(feed.id);
        // Count items that have a linked event (regardless of processingStatus)
        const activeEvents = feedItems.filter(item => item.eventId !== null).length;
        
        let addedLastSync = 0;
        if (feed.lastFetchedAt) {
          const lastSync = new Date(feed.lastFetchedAt);
          const oneHourBefore = new Date(lastSync.getTime() - 60 * 60 * 1000);
          addedLastSync = feedItems.filter(item => {
            if (!item.eventId) return false;
            const itemDate = item.createdAt ? new Date(item.createdAt) : null;
            return itemDate && itemDate >= oneHourBefore;
          }).length;
        }
        
        overview[feed.id] = {
          totalActive: activeEvents,
          incomplete: summary.incomplete,
          addedLastSync,
          lastSyncDate: feed.lastFetchedAt ? feed.lastFetchedAt.toISOString() : null,
        };
      }
      
      res.json(overview);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/overview:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Stats route - MUST be before :id route
  app.get("/api/admin/rss-feeds/stats", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      const itemsCount = await storage.getRssFeedItemsCount();
      
      const activeFeeds = feeds.filter(f => f.status === 'active').length;
      const errorFeeds = feeds.filter(f => f.status === 'error').length;
      const totalImported = feeds.reduce((sum, f) => sum + (f.itemsImported || 0), 0);

      res.json({
        totalFeeds: feeds.length,
        activeFeeds,
        errorFeeds,
        totalItems: itemsCount,
        totalImported
      });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/stats:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Municipalities route - MUST be before :id route
  app.get("/api/admin/rss-feeds/municipalities", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      
      const municipalityStatus: Record<string, {
        name: string;
        feeds: Array<{
          id: number;
          name: string;
          status: string;
          lastFetchedAt: string | null;
          itemsImported: number;
          lastErrorMessage: string | null;
        }>;
        activeCount: number;
        errorCount: number;
        totalImported: number;
      }> = {};

      for (const feed of feeds) {
        if (!feed.municipality) continue;
        
        const key = feed.municipality.toLowerCase().replace(/\s+/g, '-');
        
        if (!municipalityStatus[key]) {
          municipalityStatus[key] = {
            name: feed.municipality,
            feeds: [],
            activeCount: 0,
            errorCount: 0,
            totalImported: 0
          };
        }
        
        municipalityStatus[key].feeds.push({
          id: feed.id,
          name: feed.name,
          status: feed.status,
          lastFetchedAt: feed.lastFetchedAt ? feed.lastFetchedAt.toISOString() : null,
          itemsImported: feed.itemsImported || 0,
          lastErrorMessage: feed.lastErrorMessage || null
        });
        
        if (feed.status === 'active') municipalityStatus[key].activeCount++;
        if (feed.status === 'error') municipalityStatus[key].errorCount++;
        municipalityStatus[key].totalImported += feed.itemsImported || 0;
      }

      res.json(municipalityStatus);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/municipalities:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/rss-feeds/:id", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed not found" });
      }
      res.json(feed);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/rss-feeds", isAdmin, async (req, res) => {
    try {
      const { name, url, feedType, defaultCategory, defaultLatitude, defaultLongitude, defaultAddress, updateFrequencyMinutes, autoCreateEvents, municipality } = req.body;
      
      if (!name || !url || !defaultCategory) {
        return res.status(400).json({ message: "Name, URL, and default category are required" });
      }

      const feed = await storage.createRssFeed({
        name,
        url,
        feedType: feedType || 'rss',
        status: 'active',
        defaultCategory,
        defaultLatitude: defaultLatitude || null,
        defaultLongitude: defaultLongitude || null,
        defaultAddress: defaultAddress || null,
        updateFrequencyMinutes: updateFrequencyMinutes || 60,
        autoCreateEvents: autoCreateEvents !== false,
        municipality: municipality || null
      });

      res.status(201).json(feed);
    } catch (error) {
      console.error('Error in POST /api/admin/rss-feeds:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/admin/rss-feeds/:id", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      const existingFeed = await storage.getRssFeed(feedId);
      if (!existingFeed) {
        return res.status(404).json({ message: "Feed not found" });
      }

      const updatedFeed = await storage.updateRssFeed(feedId, req.body);
      res.json(updatedFeed);
    } catch (error) {
      console.error('Error in PATCH /api/admin/rss-feeds/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/rss-feeds/:id", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      await storage.deleteRssFeed(feedId);
      res.json({ message: "Feed deleted" });
    } catch (error) {
      console.error('Error in DELETE /api/admin/rss-feeds/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/rss-feeds/:id/items", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      const items = await storage.getRssFeedItems(feedId);
      res.json(items);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/items:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/rss-feeds/refresh", isAdmin, async (req, res) => {
    try {
      const { runManualFeedCheck } = await import('./rss-scheduler');
      const result = await runManualFeedCheck();
      res.json({ 
        message: "Feed refresh completed",
        processed: result.processed,
        errors: result.errors
      });
    } catch (error) {
      console.error('Error in POST /api/admin/rss-feeds/refresh:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/rss-feeds/analyze", isAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is verplicht" });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Ongeldige URL formaat" });
      }

      console.log(`[API] Starting feed analysis for: ${url}`);
      const { FeedAnalyzerService } = await import('./services/feed-analyzer-service');
      const result = await FeedAnalyzerService.analyzeUrl(url);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/analyze:', error);
      res.status(500).json({ 
        url: req.body.url || '',
        feedType: 'unknown',
        isViable: false,
        confidenceScore: 0,
        detectedFields: {},
        sampleItems: [],
        warnings: ["Er is een onverwachte fout opgetreden bij het analyseren van de feed. Probeer het later opnieuw."],
        missingRequiredFields: [],
        suggestions: ["Controleer of de URL correct en bereikbaar is"]
      });
    }
  });

  // Progressive feed analysis - checks methods in order and stops at first viable
  app.post("/api/admin/rss-feeds/analyze-progressive", isAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is verplicht" });
      }

      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      try {
        new URL(normalizedUrl);
      } catch {
        return res.status(400).json({ message: "Ongeldige URL formaat" });
      }

      console.log(`[API] Starting progressive feed analysis for: ${normalizedUrl}`);
      const { FeedAnalyzerService } = await import('./services/feed-analyzer-service');
      const result = await FeedAnalyzerService.analyzeProgressively(normalizedUrl);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/analyze-progressive:', error);
      res.status(500).json({ 
        url: req.body.url || '',
        steps: [],
        chosenMethod: null,
        sampleEvent: null,
        suggestedFeedName: null,
        suggestedMunicipality: null,
        importRules: '',
        isComplete: false,
        error: "Er is een onverwachte fout opgetreden bij het analyseren."
      });
    }
  });

  // Get sync progress for a feed
  app.get("/api/admin/rss-feeds/:id/sync-progress", isAdmin, async (req, res) => {
    const feedId = parseInt(req.params.id);
    if (isNaN(feedId)) {
      return res.status(400).json({ message: "Invalid feed ID" });
    }
    
    const progress = SYNC_PROGRESS.get(feedId);
    if (!progress) {
      return res.json({ status: 'idle', feedId });
    }
    
    // Calculate estimated time remaining
    const elapsed = Date.now() - progress.startTime;
    const itemsPerMs = progress.processedItems / Math.max(elapsed, 1);
    const remainingItems = progress.totalItems - progress.processedItems;
    const estimatedRemainingMs = itemsPerMs > 0 ? remainingItems / itemsPerMs : 0;
    
    res.json({
      ...progress,
      elapsedMs: elapsed,
      estimatedRemainingMs: Math.round(estimatedRemainingMs),
      percentComplete: progress.totalItems > 0 
        ? Math.round((progress.processedItems / progress.totalItems) * 100) 
        : 0
    });
  });

  app.post("/api/admin/rss-feeds/:id/sync", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed not found" });
      }

      // Initialize progress tracking
      SYNC_PROGRESS.set(feedId, {
        feedId,
        feedName: feed.name,
        status: 'fetching',
        totalItems: 0,
        processedItems: 0,
        eventsCreated: 0,
        eventsSkipped: 0,
        eventsRejected: 0,
        rejectionReasons: {},
        startTime: Date.now(),
        message: 'Feed ophalen...'
      });

      const { RssFeedService } = await import('./services/rss-feed-service');
      
      // Use progress callback
      const result = await RssFeedService.processFeed(feed, storage, (progress) => {
        const current = SYNC_PROGRESS.get(feedId);
        if (current) {
          SYNC_PROGRESS.set(feedId, {
            ...current,
            ...progress,
            status: progress.status || current.status,
          });
        }
      });
      
      // Mark as completed
      const resultAny = result as any;
      SYNC_PROGRESS.set(feedId, {
        feedId,
        feedName: feed.name,
        status: 'completed',
        totalItems: result.itemsProcessed || 0,
        processedItems: result.itemsProcessed || 0,
        eventsCreated: result.eventsCreated || 0,
        eventsSkipped: resultAny.eventsSkipped || 0,
        eventsRejected: resultAny.eventsRejected || 0,
        rejectionReasons: resultAny.rejectionReasons || {},
        startTime: SYNC_PROGRESS.get(feedId)?.startTime || Date.now(),
        message: 'Synchronisatie voltooid'
      });
      
      // Clean up after 30 seconds
      setTimeout(() => SYNC_PROGRESS.delete(feedId), 30000);
      
      res.json({ 
        message: "Feed sync completed",
        feedName: feed.name,
        itemsProcessed: result.itemsProcessed || 0,
        eventsCreated: result.eventsCreated || 0,
        success: result.success
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/:id/sync:', error);
      
      const feedId = parseInt(req.params.id);
      if (!isNaN(feedId)) {
        SYNC_PROGRESS.set(feedId, {
          feedId,
          feedName: SYNC_PROGRESS.get(feedId)?.feedName || 'Unknown',
          status: 'error',
          totalItems: 0,
          processedItems: 0,
          eventsCreated: 0,
          eventsSkipped: 0,
          eventsRejected: 0,
          rejectionReasons: {},
          startTime: SYNC_PROGRESS.get(feedId)?.startTime || Date.now(),
          error: error.message
        });
        setTimeout(() => SYNC_PROGRESS.delete(feedId), 30000);
      }
      
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Sync all feeds sequentially with delays and exponential backoff
  app.post("/api/admin/rss-feeds/sync-all", isAdmin, async (req, res) => {
    try {
      // Check if already running
      if (SYNC_ALL_PROGRESS?.isRunning) {
        return res.status(409).json({ 
          message: "Er loopt al een sync-all operatie. Wacht tot deze is voltooid.",
          progress: SYNC_ALL_PROGRESS
        });
      }

      const delayBetweenFeeds = parseInt(req.body.delaySeconds as string) || 10;
      const feeds = await storage.getAllRssFeeds();
      const activeFeeds = feeds.filter(f => f.status === 'active');

      if (activeFeeds.length === 0) {
        return res.json({ message: "Geen actieve feeds gevonden", totalFeeds: 0, results: [] });
      }

      // Initialize progress
      SYNC_ALL_PROGRESS = {
        isRunning: true,
        totalFeeds: activeFeeds.length,
        completedFeeds: 0,
        currentFeedId: null,
        currentFeedName: null,
        feedResults: [],
        startTime: Date.now(),
        delayBetweenFeeds: delayBetweenFeeds * 1000
      };

      // Start async processing (don't await - let it run in background)
      (async () => {
        const { RssFeedService } = await import('./services/rss-feed-service');
        let backoffMultiplier = 1;
        const maxBackoff = 60000; // Max 60 seconds backoff
        const baseDelay = delayBetweenFeeds * 1000;

        for (let i = 0; i < activeFeeds.length; i++) {
          const feed = activeFeeds[i];
          
          // Check if cancelled (either nulled or isRunning set to false)
          if (!SYNC_ALL_PROGRESS || !SYNC_ALL_PROGRESS.isRunning) {
            console.log('[Sync-All] Cancelled by user, stopping...');
            break;
          }
          
          SYNC_ALL_PROGRESS.currentFeedId = feed.id;
          SYNC_ALL_PROGRESS.currentFeedName = feed.name;
          
          console.log(`[Sync-All] Processing feed ${i + 1}/${activeFeeds.length}: ${feed.name}`);
          
          try {
            // Process the feed
            const result = await RssFeedService.processFeed(feed, storage);
            
            SYNC_ALL_PROGRESS.feedResults.push({
              feedId: feed.id,
              feedName: feed.name,
              status: 'success',
              eventsCreated: result.eventsCreated || 0,
              message: `${result.itemsProcessed || 0} items verwerkt, ${result.eventsCreated || 0} events aangemaakt`
            });
            
            // Reset backoff on success
            backoffMultiplier = 1;
            
          } catch (error: any) {
            console.error(`[Sync-All] Error syncing feed ${feed.name}:`, error.message);
            
            SYNC_ALL_PROGRESS.feedResults.push({
              feedId: feed.id,
              feedName: feed.name,
              status: 'error',
              eventsCreated: 0,
              message: error.message || 'Onbekende fout'
            });
            
            // Exponential backoff on error (max 60s)
            backoffMultiplier = Math.min(backoffMultiplier * 2, maxBackoff / baseDelay);
          }
          
          SYNC_ALL_PROGRESS.completedFeeds = i + 1;
          
          // Wait before next feed (with exponential backoff if there was an error)
          if (i < activeFeeds.length - 1) {
            const waitTime = Math.round(baseDelay * backoffMultiplier);
            SYNC_ALL_PROGRESS.nextFeedIn = waitTime;
            console.log(`[Sync-All] Waiting ${waitTime / 1000}s before next feed...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        // Mark as completed
        if (SYNC_ALL_PROGRESS) {
          SYNC_ALL_PROGRESS.isRunning = false;
          SYNC_ALL_PROGRESS.currentFeedId = null;
          SYNC_ALL_PROGRESS.currentFeedName = null;
          SYNC_ALL_PROGRESS.nextFeedIn = undefined;
          
          console.log(`[Sync-All] Completed. ${SYNC_ALL_PROGRESS.feedResults.filter(r => r.status === 'success').length}/${SYNC_ALL_PROGRESS.totalFeeds} feeds succesvol.`);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            SYNC_ALL_PROGRESS = null;
          }, 5 * 60 * 1000);
        }
      })();

      res.json({ 
        message: "Sync-all gestart",
        totalFeeds: activeFeeds.length,
        delayBetweenFeeds: delayBetweenFeeds
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/sync-all:', error);
      SYNC_ALL_PROGRESS = null;
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Get sync-all progress
  app.get("/api/admin/rss-feeds/sync-all/progress", isAdmin, async (req, res) => {
    if (!SYNC_ALL_PROGRESS) {
      return res.json({ isRunning: false });
    }
    
    const elapsed = Date.now() - SYNC_ALL_PROGRESS.startTime;
    const avgTimePerFeed = SYNC_ALL_PROGRESS.completedFeeds > 0 
      ? elapsed / SYNC_ALL_PROGRESS.completedFeeds 
      : 0;
    const remainingFeeds = SYNC_ALL_PROGRESS.totalFeeds - SYNC_ALL_PROGRESS.completedFeeds;
    
    res.json({
      ...SYNC_ALL_PROGRESS,
      elapsedMs: elapsed,
      estimatedRemainingMs: Math.round(avgTimePerFeed * remainingFeeds),
      percentComplete: Math.round((SYNC_ALL_PROGRESS.completedFeeds / SYNC_ALL_PROGRESS.totalFeeds) * 100)
    });
  });

  // Cancel sync-all
  app.post("/api/admin/rss-feeds/sync-all/cancel", isAdmin, async (req, res) => {
    if (!SYNC_ALL_PROGRESS?.isRunning) {
      return res.json({ message: "Geen actieve sync-all operatie" });
    }
    
    SYNC_ALL_PROGRESS.isRunning = false;
    console.log('[Sync-All] Cancelled by user');
    
    res.json({ message: "Sync-all wordt gestopt na de huidige feed" });
  });

  app.get("/api/admin/rss-feeds/:id/events", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }

      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed not found" });
      }

      const items = await storage.getRssFeedItems(feedId);
      const eventIds = items.filter(item => item.eventId).map(item => item.eventId as number);
      
      const events = await Promise.all(
        eventIds.map(id => storage.getEvent(id))
      );
      
      const validEvents = events.filter(e => e !== undefined);
      
      res.json({
        feed: {
          id: feed.id,
          name: feed.name,
          municipality: feed.municipality,
          province: feed.province
        },
        totalEvents: validEvents.length,
        events: validEvents.sort((a, b) => 
          new Date(a!.startTime).getTime() - new Date(b!.startTime).getTime()
        )
      });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/events:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/feeds-list", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      res.json(feeds.map(f => ({ id: f.id, name: f.name, municipality: f.municipality })));
    } catch (error) {
      console.error('Error in GET /api/admin/feeds-list:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Incomplete feed items endpoints
  app.get("/api/admin/incomplete-items", isAdmin, async (req, res) => {
    try {
      const feedId = req.query.feedId ? parseInt(req.query.feedId as string) : undefined;
      const items = await storage.getIncompleteItems(feedId);
      res.json(items);
    } catch (error) {
      console.error('Error in GET /api/admin/incomplete-items:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/incomplete-items/count", isAdmin, async (req, res) => {
    try {
      const feedId = req.query.feedId ? parseInt(req.query.feedId as string) : undefined;
      const count = await storage.getIncompleteItemsCount(feedId);
      res.json({ count });
    } catch (error) {
      console.error('Error in GET /api/admin/incomplete-items/count:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/rss-feeds/:id/summary", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      const summary = await storage.getFeedItemsSummary(feedId);
      res.json(summary);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/summary:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/visual-configurator/fetch-page", isAdmin, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }

      const parsedUrl = new URL(url);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ 
          message: `Failed to fetch page: ${response.statusText}` 
        });
      }

      let html = await response.text();
      
      html = html.replace(/<base[^>]*>/gi, '');
      
      const baseTag = `<base href="${parsedUrl.origin}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<HEAD>')) {
        html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
      }
      
      // Convert lazy-loaded images to regular images
      html = html.replace(/data-src="([^"]+)"/gi, 'src="$1"');
      html = html.replace(/data-lazy-src="([^"]+)"/gi, 'src="$1"');
      html = html.replace(/data-original="([^"]+)"/gi, 'src="$1"');
      html = html.replace(/loading="lazy"/gi, 'loading="eager"');
      
      // Convert srcset lazy loading
      html = html.replace(/data-srcset="([^"]+)"/gi, 'srcset="$1"');
      
      // Remove lazy loading classes that might hide images
      html = html.replace(/class="([^"]*)\blazy\b([^"]*)"/gi, 'class="$1$2"');
      html = html.replace(/class="([^"]*)\blazyload\b([^"]*)"/gi, 'class="$1$2"');

      const suggestedElements: Array<{ selector: string; sampleText: string; tagName: string; count: number }> = [];
      
      const eventPatterns = [
        { selector: '.event-card', name: 'event-card' },
        { selector: '.event-item', name: 'event-item' },
        { selector: '.event', name: 'event' },
        { selector: '[class*="event"]', name: 'event class' },
        { selector: 'article', name: 'article' },
        { selector: '.card', name: 'card' },
        { selector: '.item', name: 'item' },
      ];

      res.json({ 
        html,
        url: parsedUrl.href,
        domain: parsedUrl.hostname,
        suggestedElements,
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/visual-configurator/fetch-page:', error);
      res.status(500).json({ 
        message: error.message || "Failed to fetch page" 
      });
    }
  });

  app.post("/api/admin/visual-configurator/save-config", isAdmin, async (req, res) => {
    try {
      const { url, domain, selectors } = req.body;
      
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is verplicht" });
      }
      if (!domain || typeof domain !== 'string') {
        return res.status(400).json({ message: "Domein is verplicht" });
      }
      if (!selectors || typeof selectors !== 'object') {
        return res.status(400).json({ message: "Selectors zijn verplicht" });
      }
      if (!selectors.eventCard || typeof selectors.eventCard !== 'string') {
        return res.status(400).json({ message: "Event card selector is verplicht" });
      }

      const validationErrors: string[] = [];
      if (!selectors.title || typeof selectors.title !== 'string') {
        validationErrors.push('Titel selector is verplicht');
      }
      if (!selectors.date || typeof selectors.date !== 'string') {
        validationErrors.push('Datum selector is verplicht (event moet datum hebben)');
      }
      if (!selectors.location || typeof selectors.location !== 'string') {
        validationErrors.push('Locatie selector is verplicht (geen fallback locaties)');
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({ 
          message: 'Validatiefouten',
          errors: validationErrors,
        });
      }

      const pathPattern = new URL(url).pathname;
      // Check for existing profile by domain only (domain is unique in DB)
      const existingProfile = await storage.getAiExtractionProfileByDomain(domain);
      
      const validatedSelectors = {
        eventCard: selectors.eventCard,
        title: selectors.title,
        date: selectors.date,
        location: selectors.location,
        description: typeof selectors.description === 'string' ? selectors.description : undefined,
        time: typeof selectors.time === 'string' ? selectors.time : undefined,
        category: typeof selectors.category === 'string' ? selectors.category : undefined,
        image: typeof selectors.image === 'string' ? selectors.image : undefined,
        link: typeof selectors.link === 'string' ? selectors.link : undefined,
        venue: typeof selectors.venue === 'string' ? selectors.venue : undefined,
        address: typeof selectors.address === 'string' ? selectors.address : undefined,
      };

      const profileData = {
        domain,
        pathPattern,
        selectors: validatedSelectors,
        confidence: 80,
        requiresJsRendering: false,
      };

      let savedProfile;
      if (existingProfile) {
        savedProfile = await storage.updateAiExtractionProfile(existingProfile.id, profileData);
        console.log('[Visual Configurator] Updated existing profile:', savedProfile.id, 'for', domain, pathPattern);
      } else {
        savedProfile = await storage.createAiExtractionProfile(profileData);
        console.log('[Visual Configurator] Created new profile:', savedProfile.id, 'for', domain, pathPattern);
      }

      res.json({ 
        success: true,
        message: existingProfile ? 'Bestaande configuratie bijgewerkt' : 'Nieuwe configuratie opgeslagen',
        profile: savedProfile,
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/visual-configurator/save-config:', error);
      res.status(500).json({ 
        message: error.message || "Failed to save configuration" 
      });
    }
  });

  app.patch("/api/admin/incomplete-items/:id", isAdmin, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      const updated = await storage.updateRssFeedItem(itemId, req.body);
      res.json(updated);
    } catch (error) {
      console.error('Error in PATCH /api/admin/incomplete-items/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/incomplete-items/:id", isAdmin, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      await storage.deleteRssFeedItem(itemId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error in DELETE /api/admin/incomplete-items/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incomplete-items/:id/skip", isAdmin, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }
      const updated = await storage.updateRssFeedItem(itemId, { 
        processingStatus: 'skipped',
        isProcessed: true 
      });
      res.json(updated);
    } catch (error) {
      console.error('Error in POST /api/admin/incomplete-items/:id/skip:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/incomplete-items/:id/import", isAdmin, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      if (isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid item ID" });
      }

      const items = await storage.getIncompleteItems();
      const item = items.find(i => i.id === itemId);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      const derivedData = item.derivedData as any || {};
      const rawData = item.rawData as any || {};
      
      const latitude = derivedData.geocodedLat || rawData.latitude;
      const longitude = derivedData.geocodedLng || rawData.longitude;
      const startDate = derivedData.parsedStartDate ? new Date(derivedData.parsedStartDate) : rawData.startTime ? new Date(rawData.startTime) : null;
      
      if (!latitude || !longitude) {
        return res.status(400).json({ message: "Locatie ontbreekt nog steeds" });
      }
      if (!startDate) {
        return res.status(400).json({ message: "Datum ontbreekt nog steeds" });
      }

      const feed = await storage.getRssFeed(item.feedId);
      const category = feed?.defaultCategory || 'Gezellig en Sociaal';

      const eventData = {
        title: item.title.substring(0, 40),
        description: item.description || '',
        latitude: latitude,
        longitude: longitude,
        address: derivedData.geocodedAddress || rawData.address || '',
        notificationReach: 2.5,
        startTime: startDate.toISOString(),
        endTime: rawData.endTime || null,
        category: category as any,
        hostId: 1,
        recurrence: 'once' as const,
        tags: ['rss-import', 'manual-import'],
        imageUrl: item.imageUrl || null,
      };

      const newEvent = await storage.createEvent(eventData);
      
      await storage.updateRssFeedItem(itemId, {
        eventId: newEvent.id,
        processingStatus: 'imported',
        isProcessed: true,
      });

      if (feed) {
        await storage.updateRssFeed(feed.id, {
          itemsImported: (feed.itemsImported || 0) + 1,
        });
      }

      res.json({ success: true, event: newEvent });
    } catch (error: any) {
      console.error('Error in POST /api/admin/incomplete-items/:id/import:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Corrections endpoints
  app.get("/api/admin/corrections", isAdmin, async (req, res) => {
    try {
      const feedId = req.query.feedId ? parseInt(req.query.feedId as string) : undefined;
      const corrections = await storage.getCorrectionsForFeed(feedId);
      res.json(corrections);
    } catch (error) {
      console.error('Error in GET /api/admin/corrections:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/admin/corrections", isAdmin, async (req, res) => {
    try {
      const user = req.user as any;
      const correction = await storage.createCorrection({
        ...req.body,
        createdBy: user?.id
      });
      res.json(correction);
    } catch (error) {
      console.error('Error in POST /api/admin/corrections:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/admin/corrections/:id", isAdmin, async (req, res) => {
    try {
      const correctionId = parseInt(req.params.id);
      if (isNaN(correctionId)) {
        return res.status(400).json({ message: "Invalid correction ID" });
      }
      await storage.deleteCorrection(correctionId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error in DELETE /api/admin/corrections/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ========================================
  // PUBLIC SEO ENDPOINTS (no authentication)
  // ========================================

  // Get all active cities
  app.get("/api/public/cities", async (req, res) => {
    try {
      const { getActiveCities, getAllProvinces } = await import('@shared/cities');
      const cities = getActiveCities();
      const provinces = getAllProvinces();
      res.json({ cities, provinces });
    } catch (error: any) {
      console.error('Error in GET /api/public/cities:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Get events for a specific city
  app.get("/api/public/events/:citySlug", async (req, res) => {
    try {
      const { citySlug } = req.params;
      const { provinceSlug } = req.query;
      const { getCityBySlug } = await import('@shared/cities');
      
      const city = getCityBySlug(citySlug);
      if (!city) {
        return res.status(404).json({ message: "City not found", events: [], count: 0 });
      }
      
      if (provinceSlug && city.provinceSlug !== provinceSlug) {
        return res.status(404).json({ message: "City not found in this province", events: [], count: 0 });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getEventsByCitySlug(citySlug, limit);
      const count = await storage.getEventCountByCitySlug(citySlug);
      res.json({ events, count });
    } catch (error: any) {
      console.error('Error in GET /api/public/events/:citySlug:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Get city info with content (with optional province validation)
  app.get("/api/public/city/:citySlug", async (req, res) => {
    try {
      const { citySlug } = req.params;
      const { provinceSlug } = req.query;
      const { getCityBySlug } = await import('@shared/cities');
      const { getCityContent } = await import('@shared/content');
      
      const city = getCityBySlug(citySlug);
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }
      
      if (provinceSlug && city.provinceSlug !== provinceSlug) {
        return res.status(404).json({ message: "City not found in this province" });
      }
      
      const content = getCityContent(citySlug, city.name, city.province);
      const eventCount = await storage.getEventCountByCitySlug(citySlug);
      
      res.json({ city, content, eventCount });
    } catch (error: any) {
      console.error('Error in GET /api/public/city/:citySlug:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Lead capture endpoint
  app.post("/api/leads", async (req, res) => {
    try {
      const { insertLeadSchema } = await import('@shared/schema');
      
      const parsed = insertLeadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ 
          message: "Ongeldig invoer", 
          errors: parsed.error.flatten().fieldErrors 
        });
      }
      
      const { email, citySlug, source } = parsed.data;

      const existingLead = await storage.getLeadByEmail(email);
      if (existingLead) {
        return res.json({ success: true, message: "Je bent al aangemeld!", isExisting: true });
      }

      const lead = await storage.createLead({
        email,
        citySlug: citySlug || null,
        source: source || 'website',
      });

      res.json({ success: true, message: "Bedankt voor je aanmelding!", lead });
    } catch (error: any) {
      console.error('Error in POST /api/leads:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Admin: get all leads
  app.get("/api/admin/leads", isAdmin, async (req, res) => {
    try {
      const leads = await storage.getAllLeads();
      const count = await storage.getLeadCount();
      res.json({ leads, count });
    } catch (error: any) {
      console.error('Error in GET /api/admin/leads:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Sitemap.xml generator
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const { getActiveCities, generateCityEventsUrl } = await import('@shared/cities');
      const cities = getActiveCities();
      const baseUrl = `https://${req.get('host')}`;
      
      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      sitemap += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      
      for (const city of cities) {
        const cityUrl = generateCityEventsUrl(city);
        sitemap += `  <url>\n    <loc>${baseUrl}${cityUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      }
      
      sitemap += '</urlset>';
      
      res.set('Content-Type', 'application/xml');
      res.send(sitemap);
    } catch (error: any) {
      console.error('Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ VENUE ENDPOINTS ============
  
  // Get all venues
  app.get("/api/venues", async (req, res) => {
    try {
      const allVenues = await storage.getAllVenues();
      res.json(allVenues);
    } catch (error: any) {
      console.error('Error fetching venues:', error);
      res.status(500).json({ message: error.message || "Failed to fetch venues" });
    }
  });

  // Search venues
  app.get("/api/venues/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.json([]);
      }
      const foundVenues = await storage.searchVenues(query);
      res.json(foundVenues);
    } catch (error: any) {
      console.error('Error searching venues:', error);
      res.status(500).json({ message: error.message || "Failed to search venues" });
    }
  });

  // Get venue by ID
  app.get("/api/venues/:id", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "Invalid venue ID" });
      }
      const venue = await storage.getVenue(venueId);
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      res.json(venue);
    } catch (error: any) {
      console.error('Error fetching venue:', error);
      res.status(500).json({ message: error.message || "Failed to fetch venue" });
    }
  });

  // Get events by venue
  app.get("/api/venues/:id/events", async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "Invalid venue ID" });
      }
      const venueEvents = await storage.getEventsByVenue(venueId);
      res.json(venueEvents);
    } catch (error: any) {
      console.error('Error fetching venue events:', error);
      res.status(500).json({ message: error.message || "Failed to fetch venue events" });
    }
  });

  // Claim venue (authenticated users)
  app.post("/api/venues/:id/claim", isAuthenticated, async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "Invalid venue ID" });
      }

      const venue = await storage.getVenueById(venueId);
      if (!venue) {
        return res.status(404).json({ message: "Venue niet gevonden" });
      }

      // Check if already claimed
      if (venue.claimedByUserId) {
        return res.status(400).json({ message: "Dit venue is al geclaimd" });
      }

      const userId = (req.user as any).id;
      const updatedVenue = await storage.updateVenue(venueId, {
        claimedByUserId: userId,
        claimedAt: new Date(),
        status: 'pending'
      });

      res.json({ 
        success: true, 
        venue: updatedVenue, 
        message: "Claim aanvraag ingediend" 
      });
    } catch (error: any) {
      console.error('Error claiming venue:', error);
      res.status(500).json({ message: error.message || "Failed to claim venue" });
    }
  });

  // Update venue (owner or admin)
  app.patch("/api/venues/:id", isAuthenticated, async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "Invalid venue ID" });
      }

      const venue = await storage.getVenueById(venueId);
      if (!venue) {
        return res.status(404).json({ message: "Venue niet gevonden" });
      }

      const userId = (req.user as any).id;
      const userRole = (req.user as any).role;

      // Check ownership or admin
      if (venue.claimedByUserId !== userId && userRole !== 'admin') {
        return res.status(403).json({ message: "Je hebt geen rechten om dit venue te bewerken" });
      }

      // Only allow safe fields to be updated by owners
      const allowedFields = ['name', 'description', 'address', 'city', 'contactEmail', 'contactPhone', 'websiteUrl', 'logoUrl'];
      const safeUpdates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          safeUpdates[field] = req.body[field];
        }
      }

      const updatedVenue = await storage.updateVenue(venueId, safeUpdates);
      res.json(updatedVenue);
    } catch (error: any) {
      console.error('Error updating venue:', error);
      res.status(500).json({ message: error.message || "Failed to update venue" });
    }
  });

  // Create venue (admin only)
  app.post("/api/admin/venues", isAdmin, async (req, res) => {
    try {
      const { name, address, city, description, latitude, longitude, contactEmail, contactPhone, websiteUrl } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: "Venue naam is verplicht" });
      }

      // Check if venue already exists
      const existing = await storage.getVenueByName(name);
      if (existing) {
        return res.json({ 
          success: true, 
          venue: existing, 
          message: "Venue bestaat al",
          isExisting: true 
        });
      }

      const newVenue = await storage.createVenue({
        name,
        address,
        city,
        description,
        latitude,
        longitude,
        contactEmail,
        contactPhone,
        websiteUrl,
      });

      res.json({ 
        success: true, 
        venue: newVenue, 
        message: "Venue aangemaakt",
        isExisting: false 
      });
    } catch (error: any) {
      console.error('Error creating venue:', error);
      res.status(500).json({ message: error.message || "Failed to create venue" });
    }
  });

  // Update venue (admin only)
  app.patch("/api/admin/venues/:id", isAdmin, async (req, res) => {
    try {
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json({ message: "Invalid venue ID" });
      }
      const updatedVenue = await storage.updateVenue(venueId, req.body);
      res.json(updatedVenue);
    } catch (error: any) {
      console.error('Error updating venue:', error);
      res.status(500).json({ message: error.message || "Failed to update venue" });
    }
  });

  // Setup VITE server
  await setupVite(app, httpServer);
  
  return httpServer;
}