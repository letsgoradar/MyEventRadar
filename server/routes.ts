import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import fetch from "node-fetch";
import rateLimit from "express-rate-limit";
import * as cheerio from "cheerio";

import { setupAuth } from "./auth";
import { AiProvider } from "./services/ai-provider";
import { storage } from "./storage";
import { insertEventSchema, insertUserSchema, insertActivityLogSchema, insertSavedSearchSchema, insertEventTagSchema, insertTargetAudienceSchema, insertSeasonalThemeSchema, hiddenEvents, insertSelfHealConfigSchema } from "@shared/schema";
import { isAdmin, isAuthenticated, attachUser } from "./middleware/auth";
import { getRequestBrand, filterEventsForBrand } from "./brand";
import { getBrandCityContent } from "@shared/brands";
import { db } from "./db";
import { eq, and, gt, lte, desc, sql, inArray, isNull, isNotNull } from "drizzle-orm";
import { events as eventsTable, rssFeedItems, favorites, participants } from "@shared/schema";

// Routes voor profielfoto uploads
import profilePhotoRoutes from "./routes/profile-photo";
import generateImageRoutes from "./routes/generate-image";
import unsplashSearchRoutes from "./routes/unsplash-search";
import venueRoutes from "./routes/venue-routes";
import promotionRoutes from "./routes/advertiser-routes";
import feedbackRoutes from "./routes/feedback-routes";
import themeHandler from "./theme-handler";
import backupRoutes from "./routes/backup-routes";

const MAX_GEO_CACHE_SIZE = 1000;
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
  eventsUpdated: number;
  eventsSkipped: number;
  eventsRejected: number;
  rejectionReasons: Record<string, number>;
  startTime: number;
  message?: string;
  error?: string;
  logs?: string[];
}
const SYNC_PROGRESS = new Map<number, SyncProgress>();

// Progress tracking voor sync-all operatie
interface CurrentFeedProgress {
  phase: 'starting' | 'fetching' | 'parsing' | 'processing' | 'saving' | 'completed' | 'error';
  message: string;
  itemsFound?: number;
  itemsProcessed?: number;
  eventsCreated?: number;
  eventsUpdated?: number;
  eventsSkipped?: number;
  currentPage?: number;
  totalPages?: number;
  startedAt: number;
}

interface SyncAllProgress {
  isRunning: boolean;
  totalFeeds: number;
  completedFeeds: number;
  skippedFeeds: number;
  currentFeedId: number | null;
  currentFeedName: string | null;
  currentFeedProgress: CurrentFeedProgress | null;
  recentEvents?: string[];
  feedResults: Array<{
    feedId: number;
    feedName: string;
    status: 'success' | 'error' | 'skipped';
    eventsCreated: number;
    eventsUpdated?: number;
    eventsSkipped?: number;
    eventsRejected?: number;
    rejectionReasons?: Record<string, number>;
    message?: string;
    lastFetchedAt?: Date | null;
    skipReason?: string;
  }>;
  startTime: number;
  delayBetweenFeeds: number;
  nextFeedIn?: number;
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

  // Strikte rate limiting: 60 requests per minuut per IP
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuut
    max: 60, // Max 60 requests per minuut
    message: { error: "Te veel verzoeken. Wacht even voordat je verder gaat." },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      return !req.path.startsWith('/api');
    },
    handler: (req, res) => {
      console.warn(`[Rate Limit] IP ${req.ip} exceeded limit on ${req.path}`);
      storage.trackApiUsage(req.path, true).catch(() => {});
      res.status(429).json({ error: "Te veel verzoeken. Wacht even voordat je verder gaat." });
    }
  });
  
  // Extra strenge limiet voor expensive endpoints (AI, sync, etc.)
  const expensiveLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuut
    max: 10, // Max 10 requests per minuut voor zware endpoints
    message: { error: "Deze actie is tijdelijk beperkt. Probeer over een minuut opnieuw." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const adminLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    message: { error: "Te veel admin-verzoeken. Wacht even." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/admin", adminLimiter);
  app.use("/api", generalLimiter);

  app.use("/api/assistant/ask", expensiveLimiter);
  app.use("/api/generate-search-term", expensiveLimiter);
  app.use("/api/generate-image", expensiveLimiter);
  app.use("/api/location/name", expensiveLimiter);
  app.use("/api/leads", expensiveLimiter);

  setupAuth(app);
  app.use("/api/profile-photo", profilePhotoRoutes);
  app.use("/api/generate-image", generateImageRoutes);
  app.use("/api/admin/venues", venueRoutes);
  app.use("/api/unsplash", unsplashSearchRoutes);
  app.use("/api/promotions", promotionRoutes);
  app.use("/api/advertiser", promotionRoutes);
  app.use("/api", promotionRoutes);
  app.use("/api", feedbackRoutes);
  app.use("/api", themeHandler);
  app.use("/api/admin/backup", backupRoutes);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  
  const MAX_WS_CONNECTIONS = 200;
  const WS_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  const WS_MAX_MESSAGE_SIZE = 1024;
  const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: WS_MAX_MESSAGE_SIZE });

  const wsIdleTimers = new WeakMap<import("ws").WebSocket, NodeJS.Timeout>();

  function resetIdleTimer(ws: import("ws").WebSocket) {
    const existing = wsIdleTimers.get(ws);
    if (existing) clearTimeout(existing);
    wsIdleTimers.set(ws, setTimeout(() => {
      ws.close(1000, "Idle timeout");
    }, WS_IDLE_TIMEOUT_MS));
  }

  wss.on('connection', (ws, req) => {
    if (wss.clients.size > MAX_WS_CONNECTIONS) {
      console.warn(`[WebSocket] Connection limit reached (${MAX_WS_CONNECTIONS}), rejecting new client`);
      ws.close(1013, "Connection limit reached");
      return;
    }

    console.log(`[WebSocket] Client connected (${wss.clients.size} total)`);
    resetIdleTimer(ws);
    
    ws.send(JSON.stringify({ type: 'welcome', message: 'Welcome to the EventApp WebSocket Server' }));
    
    ws.on('message', (message) => {
      resetIdleTimer(ws);
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch (e) {
        // ignore malformed messages
      }
    });
    
    ws.on('close', () => {
      const timer = wsIdleTimers.get(ws);
      if (timer) clearTimeout(timer);
      console.log(`[WebSocket] Client disconnected (${wss.clients.size} remaining)`);
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
  app.get("/api/health", async (req, res) => {
    const checks: Record<string, string> = {};
    let healthy = true;

    try {
      const dbStart = Date.now();
      await storage.getEventCount();
      checks.database = `ok (${Date.now() - dbStart}ms)`;
    } catch {
      checks.database = 'error';
      healthy = false;
    }

    checks.uptime = `${Math.floor(process.uptime())}s`;
    checks.memory = `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    });
  });
  
  // Actief merk voor deze request (op basis van hostname). Frontend gebruikt
  // dit als robuuste fallback naast client-side hostname-detectie.
  app.get("/api/brand", (req, res) => {
    res.json(getRequestBrand(req));
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

  // API Usage statistieken voor monitoring en spike detectie
  app.get("/api/admin/traffic-status", isAdmin, (req, res) => {
    const { getTrafficStatus } = require("./middleware/traffic-monitor");
    res.json(getTrafficStatus());
  });

  app.post("/api/admin/circuit-breaker", isAdmin, (req, res) => {
    const { setCircuitBreakerManualOverride } = require("./middleware/traffic-monitor");
    const { enabled } = req.body;
    if (enabled === true) {
      setCircuitBreakerManualOverride(true);
      res.json({ message: "Circuit breaker handmatig geactiveerd", active: true });
    } else if (enabled === false) {
      setCircuitBreakerManualOverride(false);
      res.json({ message: "Circuit breaker handmatig gedeactiveerd", active: false });
    } else {
      setCircuitBreakerManualOverride(null);
      res.json({ message: "Circuit breaker op automatisch gezet", active: null });
    }
  });

  app.post("/api/admin/digest/send", isAdmin, async (req, res) => {
    try {
      const { triggerDigestNow, getLastDigestSentAt } = await import("./rss-scheduler");
      triggerDigestNow();
      res.json({
        sent: true,
        to: "info@letsgoradar.com",
        triggeredAt: new Date().toISOString(),
        message: "Dagelijkse digest wordt verstuurd op de achtergrond",
      });
    } catch (error: any) {
      console.error("[Admin] Fout bij triggeren digest:", error);
      res.status(500).json({ error: "Kon digest niet starten" });
    }
  });

  app.get("/api/admin/digest/status", isAdmin, async (req, res) => {
    try {
      const { getLastDigestSentAt } = await import("./rss-scheduler");
      const lastSent = getLastDigestSentAt();
      res.json({
        lastSentAt: lastSent?.toISOString() ?? null,
        nextScheduledAt: "07:00 CET (dagelijks)",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Kon digest-status niet ophalen" });
    }
  });

  app.get("/api/admin/api-usage", isAdmin, async (req, res) => {
    try {
      const summary = await storage.getApiUsageSummary();
      const recentStats = await storage.getApiUsageStats(24);
      
      // Groepeer per uur voor chart data
      const hourlyData: { hour: string; requests: number; blocked: number }[] = [];
      const hourMap = new Map<string, { requests: number; blocked: number }>();
      
      recentStats.forEach(stat => {
        const hourKey = stat.hour.toISOString().slice(0, 13) + ':00';
        const current = hourMap.get(hourKey) || { requests: 0, blocked: 0 };
        current.requests += stat.requestCount;
        current.blocked += stat.blockedRequests;
        hourMap.set(hourKey, current);
      });
      
      // Sorteer en formatteer voor chart
      Array.from(hourMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([hour, data]) => {
          hourlyData.push({
            hour: new Date(hour).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }),
            requests: data.requests,
            blocked: data.blocked,
          });
        });
      
      // Top endpoints
      const endpointMap = new Map<string, number>();
      recentStats.forEach(stat => {
        endpointMap.set(stat.endpoint, (endpointMap.get(stat.endpoint) || 0) + stat.requestCount);
      });
      const topEndpoints = Array.from(endpointMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([endpoint, count]) => ({ endpoint, count }));

      res.json({
        summary,
        hourlyData,
        topEndpoints,
      });
    } catch (error) {
      console.error('Error in /api/admin/api-usage:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const KNOWN_PROBLEMATIC_DOMAINS = [
    'assets.plaece.nl',
    'storage.pubble.nl',
  ];

  app.post("/api/report-broken-images", async (req, res) => {
    try {
      const { eventIds } = req.body;
      if (!Array.isArray(eventIds) || eventIds.length === 0) {
        return res.status(400).json({ error: "eventIds array required" });
      }

      const limitedIds = eventIds.slice(0, 50);
      let fixed = 0;

      for (const id of limitedIds) {
        try {
          const event = await storage.getEvent(id);
          if (event && event.imageUrl) {
            await storage.updateEvent(id, { imageUrl: null } as any);
            fixed++;
          }
        } catch {}
      }

      res.json({ reported: limitedIds.length, fixed });
    } catch (error) {
      console.error('Error in /api/report-broken-images:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/hidden-events", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const rows = await db.select({ eventId: hiddenEvents.eventId })
        .from(hiddenEvents)
        .where(eq(hiddenEvents.userId, userId));
      res.json(rows.map(r => r.eventId));
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/events/:id/hide", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const eventId = parseInt(req.params.id);
      await db.insert(hiddenEvents).values({ userId, eventId })
        .onConflictDoNothing();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/events/:id/hide", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).id;
      const eventId = parseInt(req.params.id);
      await db.delete(hiddenEvents)
        .where(and(eq(hiddenEvents.userId, userId), eq(hiddenEvents.eventId, eventId)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/admin/image-health", isAdmin, async (req, res) => {
    try {
      const allEvents = await storage.getAllEvents();
      const now = new Date();

      const activeEvents = allEvents.filter(e => {
        const end = e.endTime ? new Date(e.endTime) : new Date(e.startTime);
        return end >= now && !e.deletedAt;
      });

      const withImage = activeEvents.filter(e => !!e.imageUrl);
      const withoutImage = activeEvents.filter(e => !e.imageUrl);

      const problematicDomainEvents: { id: number; title: string; imageUrl: string; domain: string }[] = [];
      for (const event of withImage) {
        try {
          const url = new URL(event.imageUrl!);
          if (KNOWN_PROBLEMATIC_DOMAINS.some(d => url.hostname.includes(d))) {
            problematicDomainEvents.push({
              id: event.id,
              title: event.title,
              imageUrl: event.imageUrl!,
              domain: url.hostname,
            });
          }
        } catch {}
      }

      const domainCounts: Record<string, number> = {};
      for (const event of withImage) {
        try {
          const url = new URL(event.imageUrl!);
          domainCounts[url.hostname] = (domainCounts[url.hostname] || 0) + 1;
        } catch {
          domainCounts['invalid-url'] = (domainCounts['invalid-url'] || 0) + 1;
        }
      }

      const topDomains = Object.entries(domainCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([domain, count]) => ({ domain, count }));

      res.json({
        total: activeEvents.length,
        withImage: withImage.length,
        withoutImage: withoutImage.length,
        imagePercentage: activeEvents.length > 0 ? Math.round((withImage.length / activeEvents.length) * 100) : 0,
        problematicDomainEvents: problematicDomainEvents.length,
        problematicSample: problematicDomainEvents.slice(0, 20),
        topDomains,
        knownProblematicDomains: KNOWN_PROBLEMATIC_DOMAINS,
      });
    } catch (error) {
      console.error('Error in /api/admin/image-health:', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/admin/fix-broken-images", isAdmin, async (req, res) => {
    try {
      const { domains, eventIds } = req.body;
      let fixed = 0;

      if (Array.isArray(eventIds) && eventIds.length > 0) {
        for (const id of eventIds.slice(0, 200)) {
          try {
            await storage.updateEvent(id, { imageUrl: null } as any);
            fixed++;
          } catch {}
        }
      } else if (Array.isArray(domains) && domains.length > 0) {
        const allEvents = await storage.getAllEvents();
        for (const event of allEvents) {
          if (!event.imageUrl) continue;
          try {
            const url = new URL(event.imageUrl);
            if (domains.some((d: string) => url.hostname.includes(d))) {
              await storage.updateEvent(event.id, { imageUrl: null } as any);
              fixed++;
            }
          } catch {}
        }
      } else {
        return res.status(400).json({ error: "Provide 'domains' array or 'eventIds' array" });
      }

      res.json({ fixed, message: `${fixed} events bijgewerkt — afbeelding URL verwijderd` });
    } catch (error) {
      console.error('Error in /api/admin/fix-broken-images:', error);
      res.status(500).json({ error: "Internal server error" });
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
      
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: userId,
        entityType: 'user',
        details: { action: 'delete_user', targetUsername: user.username, targetEmail: user.email },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
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
        windowDays: z.union([z.coerce.number(), z.literal('all')]).optional(),
      });

      const parsed = schema.parse({
        lat: req.query.lat,
        lng: req.query.lng,
        radius: req.query.radius,
        windowDays: req.query.windowDays,
      });
      
      const { lat, lng, radius } = parsed;
      const windowDays = parsed.windowDays === 'all' || parsed.windowDays === undefined ? null : parsed.windowDays;

      const allRadiusEvents = await storage.getEventsByRadius(lat, lng, radius, windowDays);
      const events = filterEventsForBrand(allRadiusEvents, getRequestBrand(req));
      
      const sortedEvents = events.sort((a, b) => {
        const now = new Date();
        
        // Check if events are highlighted and within highlight period
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
        
        // Check multi-day events > 1 week - deze lager sorteren
        const aStart = new Date(a.startTime);
        const aEnd = a.endTime ? new Date(a.endTime) : aStart;
        const bStart = new Date(b.startTime);
        const bEnd = b.endTime ? new Date(b.endTime) : bStart;
        
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const aDuration = aEnd.getTime() - aStart.getTime();
        const bDuration = bEnd.getTime() - bStart.getTime();
        
        const aIsLongEvent = aDuration > oneWeek;
        const bIsLongEvent = bDuration > oneWeek;
        
        // Long events (> 1 week) naar beneden
        if (aIsLongEvent && !bIsLongEvent) return 1;
        if (!aIsLongEvent && bIsLongEvent) return -1;
        
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
      
      // Haal alle evenementen op (gefilterd op het actieve merk)
      const allEvents = filterEventsForBrand(await storage.getAllEvents(), getRequestBrand(req));
      
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
  app.get("/api/events/participation/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const requestingUser = req.user!;
      if (requestingUser.id !== userId && requestingUser.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden" });
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
      const userId = req.user!.id;
      
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const updated = await storage.markNotificationAsRead(notificationId, userId);
      if (!updated) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error('Error in PATCH /api/notifications/:id/read:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Unread count via sessie (geen userId in URL nodig)
  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error in GET /api/notifications/unread-count:', error);
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

  app.get("/api/favorites/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (req.user?.id !== userId && (req.user as any)?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: You can only access your own favorites" });
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
  app.get("/api/participants/:eventId", isAuthenticated, async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId);
      
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }

      const requestingUser = req.user!;
      if (requestingUser.role !== 'admin') {
        const event = await storage.getEvent(eventId);
        if (!event || event.hostId !== requestingUser.id) {
          return res.status(403).json({ message: "Forbidden" });
        }
      }
      
      const participantList = await storage.getEventParticipants(eventId);
      
      // Return only minimal public profile fields — no PII
      const safeParticipants = participantList.map(p => ({
        id: p.id,
        username: p.username,
        name: p.name,
        avatar: p.avatar,
        photoUrl: p.photoUrl,
      }));
      
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
  app.get("/api/saved-searches/:userId", isAuthenticated, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      if (req.user?.id !== userId && (req.user as any)?.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: You can only access your own saved searches" });
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
  
  // Get event sources - public endpoint
  app.get("/api/events/:id/sources", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      
      const sources = await storage.getEventSources(eventId);
      res.json(sources);
    } catch (error) {
      console.error('Error in GET /api/events/:id/sources:', error);
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

  // ============ Promoted Notifications Admin Routes ============
  
  // Alle promotie-notificaties ophalen (admin)
  app.get("/api/admin/promotions", isAdmin, async (req, res) => {
    try {
      const promotions = await storage.getAllPromotedNotifications();
      res.json(promotions);
    } catch (error) {
      console.error('Error in GET /api/admin/promotions:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Nieuwe promotie-notificatie aanmaken (admin)
  app.post("/api/admin/promotions", isAdmin, async (req, res) => {
    try {
      const userId = req.user?.id;
      const promotionData = {
        ...req.body,
        createdBy: userId,
      };
      
      const promotion = await storage.createPromotedNotification(promotionData);
      res.status(201).json(promotion);
    } catch (error) {
      console.error('Error in POST /api/admin/promotions:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Promotie-notificatie ophalen (admin)
  app.get("/api/admin/promotions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }
      
      const promotion = await storage.getPromotedNotification(id);
      if (!promotion) {
        return res.status(404).json({ message: "Promotion not found" });
      }
      
      res.json(promotion);
    } catch (error) {
      console.error('Error in GET /api/admin/promotions/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Promotie-notificatie bijwerken (admin)
  app.patch("/api/admin/promotions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }
      
      const promotion = await storage.updatePromotedNotification(id, req.body);
      res.json(promotion);
    } catch (error) {
      console.error('Error in PATCH /api/admin/promotions/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Promotie-notificatie verwijderen (admin)
  app.delete("/api/admin/promotions/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }
      
      const promotion = await storage.getPromotedNotification(id);
      await storage.deletePromotedNotification(id);
      
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: id,
        entityType: 'promotion',
        details: { action: 'delete_promotion', promotionTitle: promotion?.title || 'unknown' },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      res.json({ message: "Promotion deleted" });
    } catch (error) {
      console.error('Error in DELETE /api/admin/promotions/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Promotie naar gebruikers pushen (admin) - maakt notificaties aan voor doelgroep
  app.post("/api/admin/promotions/:id/push", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }
      
      const promotion = await storage.getPromotedNotification(id);
      if (!promotion) {
        return res.status(404).json({ message: "Promotion not found" });
      }
      
      // Bepaal doelgroep gebruikers
      let targetUsers: { id: number }[] = [];
      
      if (promotion.targetAllUsers) {
        // Alle gebruikers
        const allUsers = await storage.getAllUsers();
        targetUsers = allUsers.map(u => ({ id: u.id }));
      } else {
        // TODO: Implementeer targeting op basis van locatie/stad
        // Voor nu: alle gebruikers
        const allUsers = await storage.getAllUsers();
        targetUsers = allUsers.map(u => ({ id: u.id }));
      }
      
      // Maak notificaties aan voor elke gebruiker
      let notificationsCreated = 0;
      for (const user of targetUsers) {
        await storage.createNotification({
          userId: user.id,
          eventId: promotion.eventId || undefined,
          type: 'promotion',
          title: `📢 ${promotion.title}`,
          message: promotion.message,
          isRead: false,
          promotionId: promotion.id,
        });
        notificationsCreated++;
      }
      
      // Update impressions
      await storage.updatePromotedNotification(id, {
        impressions: (promotion.impressions || 0) + notificationsCreated
      });
      
      res.json({ 
        message: "Promotion pushed successfully",
        notificationsCreated 
      });
    } catch (error) {
      console.error('Error in POST /api/admin/promotions/:id/push:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Track promotion click (publiek endpoint)
  app.post("/api/promotions/:id/click", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid promotion ID" });
      }
      
      await storage.incrementPromotionClick(id);
      res.json({ message: "Click tracked" });
    } catch (error) {
      console.error('Error in POST /api/promotions/:id/click:', error);
      res.status(500).json({ message: "Internal server error" });
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

      if (GEOCODING_CACHE.size >= MAX_GEO_CACHE_SIZE) {
        const firstKey = GEOCODING_CACHE.keys().next().value;
        if (firstKey !== undefined) GEOCODING_CACHE.delete(firstKey);
      }
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
  
  // Gebruikersvoorkeuren opslaan
  app.patch("/api/user/preferences", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Je moet ingelogd zijn" });

      const { defaultRadius, defaultWindowDays, mapStyle, preferredTagIds, preferredAudienceIds, onboardingCompleted } = req.body;
      const existing = (req.user as any)?.preferences || {};
      const preferences: Record<string, unknown> = { ...existing };
      if (typeof defaultRadius === 'number') preferences.defaultRadius = defaultRadius;
      if (typeof defaultWindowDays === 'number') preferences.defaultWindowDays = defaultWindowDays;
      if (typeof mapStyle === 'string') preferences.mapStyle = mapStyle;
      if (Array.isArray(preferredTagIds)) preferences.preferredTagIds = preferredTagIds;
      if (Array.isArray(preferredAudienceIds)) preferences.preferredAudienceIds = preferredAudienceIds;
      if (typeof onboardingCompleted === 'boolean') preferences.onboardingCompleted = onboardingCompleted;

      const updatedUser = await storage.updateUser(userId, { preferences });
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error in PATCH /api/user/preferences:', error);
      res.status(500).json({ message: "Er is iets misgegaan bij het opslaan van je voorkeuren" });
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
      
      // Build an allowlist of fields that may be updated.
      // Privileged fields (role, emailVerified, googleId, emailVerificationToken, etc.)
      // are only modifiable by admins. Regular users get a restricted set.
      let updateData: Partial<typeof req.body>;
      if (req.user?.role === 'admin') {
        const { password, ...rest } = req.body;
        updateData = rest;
      } else {
        const { displayName, bio, location, profilePhoto, notifications, preferences } = req.body;
        updateData = { displayName, bio, location, profilePhoto, notifications, preferences };
        // Remove keys that were not provided to avoid overwriting with undefined
        (Object.keys(updateData) as Array<keyof typeof updateData>).forEach(key => {
          if (updateData[key] === undefined) delete updateData[key];
        });
      }
      
      // Update de gebruiker
      const updatedUser = await storage.updateUser(userId, updateData);
      
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
      
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'delete_event',
        entityId: eventId,
        entityType: 'event',
        details: { action: 'delete_event', eventTitle: existingEvent.title },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      // Broadcast de verwijdering
      broadcastEventUpdate({ id: eventId }, 'delete');
      
      res.status(200).json({ message: "Event deleted" });
    } catch (error) {
      console.error('Error in DELETE /api/events/:id:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/admin/events/:id/restore", isAdmin, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      const restored = await storage.restoreEvent(eventId);
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: eventId,
        entityType: 'event',
        details: { action: 'restore_event', title: restored.title },
        ipAddress: req.ip || null,
        userAgent: req.get('user-agent') || null,
      });
      res.json(restored);
    } catch (error) {
      console.error('Error in POST /api/admin/events/:id/restore:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Alle evenementen ophalen - voor admin en testen
  app.get("/api/admin/events", isAdmin, async (req, res) => {
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

  // Dubbele route verwijderd - gebruik /api/notifications/:id/read hierboven

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

  // Bronnenbeheer: volledige gezondheids-/opbrengstdata per feed
  // (groen/oranje/rood, vangstpercentage, uitvalredenen, issues).
  // MUST be before :id route.
  app.get("/api/admin/rss-feeds/manage", isAdmin, async (req, res) => {
    try {
      const { getSourceManagementData, PLATFORM_FAMILIES } = await import("./services/source-management");
      const feeds = await getSourceManagementData();
      res.json({ feeds, platforms: PLATFORM_FAMILIES });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/manage:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Dekkingsoverzicht per gemeente. MUST be before :id route.
  app.get("/api/admin/rss-feeds/coverage", isAdmin, async (req, res) => {
    try {
      const { getCoverageOverview } = await import("./services/source-management");
      res.json(await getCoverageOverview());
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/coverage:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Feed-gezondheid: detecteert feeds die stilletjes geen events meer importeren.
  // MUST be before :id route.
  app.get("/api/admin/rss-feeds/health", isAdmin, async (req, res) => {
    try {
      const { getFeedHealthMap } = await import("./services/feed-health");
      const health = await getFeedHealthMap();
      res.json(health);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/health:', error);
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
      const pausedFeeds = feeds.filter(f => f.status === 'paused').length;
      const totalImported = feeds.reduce((sum, f) => sum + (f.itemsImported || 0), 0);

      const devMaxFeedsEnv = process.env.NODE_ENV !== 'production' && process.env.DEV_MAX_FEEDS
        ? parseInt(process.env.DEV_MAX_FEEDS, 10)
        : NaN;
      const devMaxFeeds = !isNaN(devMaxFeedsEnv) && devMaxFeedsEnv > 0 ? devMaxFeedsEnv : null;

      res.json({
        totalFeeds: feeds.length,
        activeFeeds,
        errorFeeds,
        pausedFeeds,
        totalItems: itemsCount,
        totalImported,
        devMaxFeeds
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

  app.get("/api/admin/rss-feeds/seed", isAdmin, async (req, res) => {
    try {
      console.log('[Seed API] Starting feed seed...');
      const { seedFeeds } = await import('./migrations/seed-feeds');
      await seedFeeds();
      const feeds = await storage.getAllRssFeeds();
      console.log(`[Seed API] Complete. ${feeds.length} feeds in database.`);
      res.json({ message: `Seed complete. ${feeds.length} feeds in database.`, count: feeds.length });
    } catch (error: any) {
      console.error('[Seed API] Error:', error.message, error.stack);
      res.status(500).json({ message: `Seed failed: ${error.message}` });
    }
  });

  app.get("/api/admin/rss-feeds/unlinked", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      const unlinked = feeds
        .filter(f => !f.municipality || f.municipality.trim() === '')
        .map(f => ({ id: f.id, name: f.name, url: f.url, feedType: f.feedType }));
      res.json(unlinked);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/unlinked:', error);
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

  app.post("/api/admin/rss-feeds/seed", isAdmin, async (req, res) => {
    try {
      console.log('[Seed API] Starting feed seed (POST)...');
      const { seedFeeds } = await import('./migrations/seed-feeds');
      await seedFeeds();
      const feeds = await storage.getAllRssFeeds();
      console.log(`[Seed API] Complete. ${feeds.length} feeds in database.`);
      res.json({ message: `Seed complete. ${feeds.length} feeds in database.`, count: feeds.length });
    } catch (error: any) {
      console.error('[Seed API] Error:', error.message, error.stack);
      res.status(500).json({ message: `Seed failed: ${error.message}` });
    }
  });

  app.post("/api/admin/rss-feeds", isAdmin, async (req, res) => {
    try {
      const { name, url, feedType, defaultCategory, defaultLatitude, defaultLongitude, defaultAddress, updateFrequencyMinutes, autoCreateEvents, municipality, province, fieldMappings, scraperConfig } = req.body;
      
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
        municipality: municipality || null,
        province: province || null,
        fieldMappings: fieldMappings || null,
        scraperConfig: scraperConfig || null,
      });

      // Platform-familie automatisch classificeren op basis van feedType/URL
      try {
        const { classifyFeedPlatform } = await import("./services/feed-platform");
        const platform = classifyFeedPlatform(feed);
        if (platform && feed.platform !== platform) {
          await storage.updateRssFeed(feed.id, { platform });
          (feed as any).platform = platform;
        }
      } catch (platErr: any) {
        console.warn('[Feeds] Platform classification failed:', platErr.message);
      }

      // Persist to feeds-config.json so this feed is included in future deployments
      try {
        const { upsertFeedInConfig } = await import('./migrations/seed-feeds');
        upsertFeedInConfig({ name, url, feedType: feedType || 'rss', defaultCategory, municipality: municipality || undefined, province: province || undefined, defaultLatitude: defaultLatitude || undefined, defaultLongitude: defaultLongitude || undefined, defaultAddress: defaultAddress || undefined, updateFrequencyMinutes: updateFrequencyMinutes || 60, scraperConfig: scraperConfig || undefined, fieldMappings: fieldMappings || undefined });
      } catch (cfgErr: any) {
        console.warn('[Feeds] Could not write to feeds-config.json:', cfgErr.message);
      }

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

      // Sync config changes to feeds-config.json for future deployments
      if (updatedFeed) {
        try {
          const { upsertFeedInConfig, removeFeedFromConfig } = await import('./migrations/seed-feeds');
          // If URL changed, remove old entry first to avoid stale duplicates
          if (existingFeed.url !== updatedFeed.url) {
            removeFeedFromConfig(existingFeed.url);
          }
          upsertFeedInConfig({
            name: updatedFeed.name,
            url: updatedFeed.url,
            feedType: updatedFeed.feedType,
            defaultCategory: updatedFeed.defaultCategory,
            municipality: updatedFeed.municipality || undefined,
            province: updatedFeed.province || undefined,
            defaultLatitude: updatedFeed.defaultLatitude || undefined,
            defaultLongitude: updatedFeed.defaultLongitude || undefined,
            defaultAddress: updatedFeed.defaultAddress || undefined,
            updateFrequencyMinutes: updatedFeed.updateFrequencyMinutes,
            scraperConfig: updatedFeed.scraperConfig || undefined,
            fieldMappings: updatedFeed.fieldMappings || undefined,
          });
        } catch (cfgErr: any) {
          console.warn('[Feeds] Could not write to feeds-config.json:', cfgErr.message);
        }
      }

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

      const eventAction = req.query.eventAction as string || 'keep';
      const validActions = ['keep', 'delete', 'unlink'];
      if (!validActions.includes(eventAction)) {
        return res.status(400).json({ message: "Invalid eventAction. Must be: keep, delete, or unlink" });
      }
      
      // Handle linked events based on user choice
      if (eventAction === 'delete') {
        // Delete all events linked to this feed
        await storage.deleteEventsByFeedId(feedId, true);
        console.log(`[RSS] Deleted events linked to feed ${feedId}`);
      } else if (eventAction === 'unlink') {
        // Unlink events from this feed (set feed reference to null in rssFeedItems)
        await storage.unlinkEventsFromFeed(feedId);
        console.log(`[RSS] Unlinked events from feed ${feedId}`);
      }
      // 'keep' is default - events remain as-is

      const feedToDelete = await storage.getRssFeed(feedId);
      await storage.deleteRssFeed(feedId);

      // Remove from feeds-config.json so it doesn't reappear after deployment
      if (feedToDelete?.url) {
        try {
          const { removeFeedFromConfig } = await import('./migrations/seed-feeds');
          removeFeedFromConfig(feedToDelete.url);
        } catch (cfgErr: any) {
          console.warn('[Feeds] Could not update feeds-config.json:', cfgErr.message);
        }
      }

      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: feedId,
        entityType: 'rss_feed',
        details: { action: 'delete_rss_feed', feedName: feedToDelete?.name || 'unknown', eventAction },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      res.json({ message: "Feed deleted", eventAction });
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

  app.post("/api/admin/rss-feeds/:id/rescue-dates", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Ongeldig feed ID" });
      }
      const { RssFeedService } = await import('./services/rss-feed-service');
      const result = await RssFeedService.rescueMissingDates(feedId);
      res.json({
        message: `AI Date Rescue voltooid: ${result.rescued} hersteld, ${result.failed} mislukt`,
        ...result
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/:id/rescue-dates:', error);
      res.status(500).json({ message: "Fout bij AI datum-rescue" });
    }
  });

  app.post("/api/admin/rss-feeds/:id/merge-multiday", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Ongeldig feed ID" });
      }

      const normalizeTitle = (title: string) =>
        title.toLowerCase().trim().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');

      const linkedItems = await db
        .select({ eventId: rssFeedItems.eventId })
        .from(rssFeedItems)
        .where(and(eq(rssFeedItems.feedId, feedId), isNotNull(rssFeedItems.eventId)));

      const eventIds = linkedItems
        .map(fi => fi.eventId)
        .filter((id): id is number => id !== null);

      if (eventIds.length === 0) {
        return res.json({ message: "Geen events gevonden voor deze feed", mergedGroups: 0, deletedEvents: 0 });
      }

      const feedEvents = await db
        .select()
        .from(eventsTable)
        .where(and(inArray(eventsTable.id, eventIds), isNull(eventsTable.deletedAt)));

      const groups = new Map<string, typeof feedEvents>();
      for (const event of feedEvents) {
        const lat = event.latitude ? Math.round(parseFloat(String(event.latitude)) * 100) / 100 : 0;
        const lng = event.longitude ? Math.round(parseFloat(String(event.longitude)) * 100) / 100 : 0;
        if (lat === 0 || lng === 0 || Math.abs(lat) < 1 || Math.abs(lng) < 1) continue;
        const key = `${normalizeTitle(event.title)}|${lat},${lng}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(event);
      }

      let mergedGroups = 0;
      let deletedEvents = 0;

      for (const [_key, group] of Array.from(groups.entries())) {
        if (group.length <= 1) continue;

        const sorted = group.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
        const dates = sorted.map(e => new Date(e.startTime));

        let contiguous = true;
        for (let i = 1; i < dates.length; i++) {
          const diffDays = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays > 2) { contiguous = false; break; }
        }
        if (!contiguous) continue;

        const survivor = sorted[0];
        const duplicates = sorted.slice(1);
        const latestDate = dates[dates.length - 1];
        const currentEnd = survivor.endTime ? new Date(survivor.endTime) : null;
        const newEndTime = currentEnd && currentEnd > latestDate ? currentEnd : latestDate;

        await db.update(eventsTable)
          .set({ endTime: newEndTime })
          .where(eq(eventsTable.id, survivor.id));

        const duplicateIds = duplicates.map(d => d.id);

        for (const dupId of duplicateIds) {
          const dupFavs = await db.select().from(favorites).where(eq(favorites.eventId, dupId));
          for (const fav of dupFavs) {
            try {
              await db.insert(favorites).values({ userId: fav.userId, eventId: survivor.id });
            } catch { }
          }
          const dupParts = await db.select().from(participants).where(eq(participants.eventId, dupId));
          for (const part of dupParts) {
            const existing = await db.select().from(participants)
              .where(and(eq(participants.userId, part.userId), eq(participants.eventId, survivor.id)));
            if (existing.length === 0) {
              await db.insert(participants).values({ userId: part.userId, eventId: survivor.id, status: part.status });
            }
          }
        }

        await db.update(rssFeedItems)
          .set({ eventId: survivor.id })
          .where(and(eq(rssFeedItems.feedId, feedId), inArray(rssFeedItems.eventId, duplicateIds)));

        await db.update(eventsTable)
          .set({ deletedAt: new Date() })
          .where(inArray(eventsTable.id, duplicateIds));

        mergedGroups++;
        deletedEvents += duplicates.length;
        console.log(`[MergeMultiday] Merged ${group.length} events into 1: "${survivor.title}" (feed ${feedId}), deleted IDs: ${duplicateIds.join(',')}`);
      }

      res.json({
        message: `Samenvoegen voltooid: ${mergedGroups} groep${mergedGroups !== 1 ? 'en' : ''} samengevoegd, ${deletedEvents} dubbele event${deletedEvents !== 1 ? 's' : ''} verwijderd`,
        mergedGroups,
        deletedEvents
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/:id/merge-multiday:', error);
      res.status(500).json({ message: "Fout bij samenvoegen van meerdaagse events" });
    }
  });

  // ===== Zelfherstellende koppelingen (self-healing feeds) =====

  app.get("/api/admin/self-heal/log", isAdmin, async (req, res) => {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? "100")) || 100, 500);
      const feedId = req.query.feedId ? parseInt(String(req.query.feedId)) : undefined;
      const log = await storage.getFeedRepairLog(limit, feedId);
      res.json(log);
    } catch (error: any) {
      console.error("Error in GET /api/admin/self-heal/log:", error);
      res.status(500).json({ message: "Fout bij ophalen reparatie-log" });
    }
  });

  app.get("/api/admin/self-heal/cases", isAdmin, async (req, res) => {
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const cases = await storage.getFeedRepairCases(status);
      res.json(cases);
    } catch (error: any) {
      console.error("Error in GET /api/admin/self-heal/cases:", error);
      res.status(500).json({ message: "Fout bij ophalen reparatie-zaken" });
    }
  });

  app.get("/api/admin/self-heal/cases/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Ongeldig id" });
      const c = await storage.getFeedRepairCase(id);
      if (!c) return res.status(404).json({ message: "Zaak niet gevonden" });
      res.json(c);
    } catch (error: any) {
      console.error("Error in GET /api/admin/self-heal/cases/:id:", error);
      res.status(500).json({ message: "Fout bij ophalen zaak" });
    }
  });

  app.patch("/api/admin/self-heal/cases/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Ongeldig id" });
      const existing = await storage.getFeedRepairCase(id);
      if (!existing) return res.status(404).json({ message: "Zaak niet gevonden" });

      const { action, resolution } = req.body ?? {};
      const allowed = ["resolve", "dismiss", "respond", "reopen"];
      if (!allowed.includes(action)) {
        return res.status(400).json({ message: "Ongeldige actie" });
      }

      const userId = (req.user as any)?.id ?? null;
      const update: Record<string, unknown> = {};
      if (action === "resolve") {
        update.status = "resolved";
        update.resolution = typeof resolution === "string" ? resolution : "Opgelost door beheerder.";
        update.resolvedBy = userId;
        update.resolvedAt = new Date();
      } else if (action === "dismiss") {
        update.status = "dismissed";
        update.resolution = typeof resolution === "string" ? resolution : "Genegeerd door beheerder.";
        update.resolvedBy = userId;
        update.resolvedAt = new Date();
      } else if (action === "respond") {
        update.status = "in_progress";
        if (typeof resolution === "string") update.resolution = resolution;
      } else if (action === "reopen") {
        update.status = "open";
        update.resolvedBy = null;
        update.resolvedAt = null;
      }

      const updated = await storage.updateFeedRepairCase(id, update as any);
      res.json(updated);
    } catch (error: any) {
      console.error("Error in PATCH /api/admin/self-heal/cases/:id:", error);
      res.status(500).json({ message: "Fout bij bijwerken zaak" });
    }
  });

  app.get("/api/admin/self-heal/config", isAdmin, async (req, res) => {
    try {
      const [config, usage] = await Promise.all([
        storage.getSelfHealConfig(),
        storage.getMonthlySelfHealUsage(),
      ]);
      res.json({ config, usage });
    } catch (error: any) {
      console.error("Error in GET /api/admin/self-heal/config:", error);
      res.status(500).json({ message: "Fout bij ophalen instellingen" });
    }
  });

  app.put("/api/admin/self-heal/config", isAdmin, async (req, res) => {
    try {
      const parsed = insertSelfHealConfigSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validatiefouten", errors: parsed.error.flatten() });
      }
      const config = await storage.updateSelfHealConfig(parsed.data);
      res.json(config);
    } catch (error: any) {
      console.error("Error in PUT /api/admin/self-heal/config:", error);
      res.status(500).json({ message: "Fout bij opslaan instellingen" });
    }
  });

  app.post("/api/admin/self-heal/run", isAdmin, async (req, res) => {
    try {
      const { runSelfHeal } = await import("./services/feed-self-heal");
      const result = await runSelfHeal();
      if (result.skipped === -1) {
        return res.json({ success: true, alreadyRunning: true, message: "Zelf-herstel draait al" });
      }
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("Error in POST /api/admin/self-heal/run:", error);
      res.status(500).json({ message: error?.message || "Fout bij uitvoeren zelf-herstel" });
    }
  });

  app.post("/api/admin/rss-feeds/ai-scraper-analyze", isAdmin, async (req, res) => {
    req.setTimeout(180000);
    try {
      const { url, sampleDetailUrl } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is verplicht" });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Ongeldige URL" });
      }

      if (sampleDetailUrl && typeof sampleDetailUrl === 'string') {
        try { new URL(sampleDetailUrl); } catch {
          return res.status(400).json({ message: "Ongeldige detail pagina URL" });
        }
      }

      console.log(`[API] Starting AI Scraper Builder analysis for: ${url}${sampleDetailUrl ? ` (detail: ${sampleDetailUrl})` : ''}`);
      const { AiHtmlAnalyzer } = await import('./services/ai-html-analyzer');
      const result = await AiHtmlAnalyzer.analyzeForScraper(url, sampleDetailUrl || undefined);
      res.json(result);
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/ai-scraper-analyze:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'AI scraper analyse mislukt',
        steps: [],
        sampleEvents: [],
        confidence: 0,
        hasJsonLd: false,
        reasoning: '',
        requiresJsRendering: false,
      });
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

  // Feed field discovery - returns ALL available fields with sample values for manual mapping
  app.post("/api/admin/rss-feeds/discover-fields", isAdmin, async (req, res) => {
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

      console.log(`[API] Discovering fields for: ${normalizedUrl}`);
      const { FeedAnalyzerService } = await import('./services/feed-analyzer-service');
      const result = await FeedAnalyzerService.discoverFields(normalizedUrl);
      
      res.json(result);
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/discover-fields:', error);
      res.status(500).json({ 
        url: req.body.url || '',
        feedType: 'unknown',
        totalItems: 0,
        discoveredFields: [],
        sampleItems: [],
        previewEvent: null,
        errors: [`Fout bij analyseren: ${error.message}`]
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

  app.post("/api/admin/rss-feeds/preview", isAdmin, async (req, res) => {
    try {
      const { url, feedType, municipality, scraperConfig, fieldMappings, limit } = req.body;
      
      if (!url) {
        return res.status(400).json({ message: "URL is verplicht" });
      }

      const { RssFeedService } = await import('./services/rss-feed-service');
      
      const result = await RssFeedService.previewFeed({
        url,
        feedType: feedType || 'rss',
        municipality,
        scraperConfig,
        fieldMappings,
        limit: limit ? parseInt(limit, 10) : undefined
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/preview:', error);
      res.status(500).json({ 
        success: false,
        items: [],
        summary: { total: 0, complete: 0, incomplete: 0, missingFieldsCounts: {} },
        error: error.message || "Er is een fout opgetreden bij de preview."
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

      // Validate feed exists first (before concurrency checks)
      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed not found" });
      }

      // Check if any sync is already running
      const runningSync = Array.from(SYNC_PROGRESS.entries()).find(
        ([, progress]) => progress.status !== 'completed' && progress.status !== 'error'
      );
      
      if (runningSync) {
        const [runningFeedId, runningProgress] = runningSync;
        return res.status(409).json({ 
          message: `Er loopt al een synchronisatie voor "${runningProgress.feedName}". Wacht tot deze is voltooid.`,
          runningFeed: {
            id: runningFeedId,
            name: runningProgress.feedName,
            status: runningProgress.status,
            processedItems: runningProgress.processedItems,
            totalItems: runningProgress.totalItems,
            percentComplete: runningProgress.totalItems > 0 
              ? Math.round((runningProgress.processedItems / runningProgress.totalItems) * 100)
              : 0
          }
        });
      }

      // Also check if sync-all is running
      if (SYNC_ALL_PROGRESS?.isRunning) {
        return res.status(409).json({
          message: `Er loopt een "Sync Alle Feeds" operatie (bezig met "${SYNC_ALL_PROGRESS.currentFeedName || 'opstarten'}"). Wacht tot deze is voltooid of stop deze eerst.`,
          syncAllProgress: {
            completedFeeds: SYNC_ALL_PROGRESS.completedFeeds,
            totalFeeds: SYNC_ALL_PROGRESS.totalFeeds,
            currentFeedName: SYNC_ALL_PROGRESS.currentFeedName
          }
        });
      }

      // Initialize progress tracking with immediate feedback
      const startTime = new Date().toLocaleTimeString('nl-NL');
      const initialLogs = [
        `[${startTime}] ▶ Start synchronisatie "${feed.name}"`,
        `[${startTime}] ⌛ Verbinden met ${feed.feedType === 'scraper' ? 'website' : 'RSS feed'}...`,
        `[${startTime}] 📍 Gemeente: ${feed.municipality || 'Onbekend'}`
      ];
      
      SYNC_PROGRESS.set(feedId, {
        feedId,
        feedName: feed.name,
        status: 'fetching',
        totalItems: 0,
        processedItems: 0,
        eventsCreated: 0,
        eventsUpdated: 0,
        eventsSkipped: 0,
        eventsRejected: 0,
        rejectionReasons: {},
        startTime: Date.now(),
        message: 'Verbinden met feed...',
        logs: initialLogs
      });

      // Return 202 immediately — sync runs in background (avoids 504 gateway timeout)
      res.status(202).json({ 
        message: "Feed sync gestart",
        feedId,
        feedName: feed.name
      });

      // Fire-and-forget: import and run processFeed without blocking the response
      import('./services/rss-feed-service').then(({ RssFeedService }) => {
        return RssFeedService.processFeed(feed, storage, (progress) => {
          const current = SYNC_PROGRESS.get(feedId);
          if (current) {
            const newLogs = current.logs || [];
            if (progress.logMessage) {
              newLogs.push(`[${new Date().toLocaleTimeString('nl-NL')}] ${progress.logMessage}`);
              if (newLogs.length > 100) newLogs.shift();
            }
            SYNC_PROGRESS.set(feedId, {
              ...current,
              ...progress,
              status: (progress.status as SyncProgress['status']) || current.status,
              logs: newLogs
            });
          }
        });
      }).then((result) => {
        // Mark as completed
        const resultAny = result as any;
        const currentProgress = SYNC_PROGRESS.get(feedId);
        const completedLogs = currentProgress?.logs || [];
        completedLogs.push(`[${new Date().toLocaleTimeString('nl-NL')}] ✓ Synchronisatie voltooid: ${result.eventsCreated} nieuw, ${result.eventsUpdated} bijgewerkt`);
        
        SYNC_PROGRESS.set(feedId, {
          feedId,
          feedName: feed.name,
          status: 'completed',
          totalItems: result.itemsProcessed || 0,
          processedItems: result.itemsProcessed || 0,
          eventsCreated: result.eventsCreated || 0,
          eventsUpdated: result.eventsUpdated || 0,
          eventsSkipped: resultAny.eventsSkipped || 0,
          eventsRejected: resultAny.eventsRejected || 0,
          rejectionReasons: resultAny.rejectionReasons || {},
          startTime: currentProgress?.startTime || Date.now(),
          message: 'Synchronisatie voltooid',
          logs: completedLogs
        });
        
        // Clean up after 30 seconds
        setTimeout(() => SYNC_PROGRESS.delete(feedId), 30000);
      }).catch((error: any) => {
        console.error('Error in background feed sync:', error);
        
        const currentProgress = SYNC_PROGRESS.get(feedId);
        SYNC_PROGRESS.set(feedId, {
          feedId,
          feedName: currentProgress?.feedName || feed.name,
          status: 'error',
          totalItems: currentProgress?.totalItems || 0,
          processedItems: currentProgress?.processedItems || 0,
          eventsCreated: currentProgress?.eventsCreated || 0,
          eventsUpdated: currentProgress?.eventsUpdated || 0,
          eventsSkipped: currentProgress?.eventsSkipped || 0,
          eventsRejected: currentProgress?.eventsRejected || 0,
          rejectionReasons: currentProgress?.rejectionReasons || {},
          startTime: currentProgress?.startTime || Date.now(),
          error: error.message
        });
        setTimeout(() => SYNC_PROGRESS.delete(feedId), 30000);
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
          eventsUpdated: 0,
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
  // Sorted by lastFetchedAt (oldest first, null first), skips feeds synced in last 24h
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
      const skipRecentHours = parseInt(req.body.skipRecentHours as string) || 24;
      // Error feeds: retry after 2h cooldown (stale errors should be re-attempted)
      const errorRetryCooldownHours = 2;
      const feeds = await storage.getAllRssFeeds();
      const activeFeeds = feeds.filter(f => f.status === 'active');
      // Include error feeds at the end of the queue — they're often stale network timeouts
      const errorFeeds = feeds.filter(f => f.status === 'error');
      // Include paused feeds with longer cooldown — auto-retry in case source recovered
      const pausedFeeds = feeds.filter(f => f.status === 'paused');

      if (activeFeeds.length === 0 && errorFeeds.length === 0 && pausedFeeds.length === 0) {
        return res.json({ message: "Geen actieve feeds gevonden", totalFeeds: 0, results: [] });
      }

      const sortByLastFetched = (a: typeof feeds[0], b: typeof feeds[0]) => {
        if (!a.lastFetchedAt && !b.lastFetchedAt) return 0;
        if (!a.lastFetchedAt) return -1;
        if (!b.lastFetchedAt) return 1;
        return new Date(a.lastFetchedAt).getTime() - new Date(b.lastFetchedAt).getTime();
      };

      // Sort feeds by lastFetchedAt: null first (never synced), then oldest first
      const sortedActive = [...activeFeeds].sort(sortByLastFetched);
      const sortedError = [...errorFeeds].sort(sortByLastFetched);
      const sortedPaused = [...pausedFeeds].sort(sortByLastFetched);

      // Determine which feeds to skip
      const now = Date.now();
      const skipThresholdMs = skipRecentHours * 60 * 60 * 1000;
      const errorCooldownMs = errorRetryCooldownHours * 60 * 60 * 1000;
      // Paused feeds use a longer cooldown: 24h (they've already failed 3+ times)
      const pausedCooldownMs = 24 * 60 * 60 * 1000;
      const feedsToProcess: typeof feeds = [];
      const feedsToSkip: typeof feeds = [];

      for (const feed of sortedActive) {
        if (feed.lastFetchedAt) {
          const timeSinceSync = now - new Date(feed.lastFetchedAt).getTime();
          if (timeSinceSync < skipThresholdMs) {
            feedsToSkip.push(feed);
            continue;
          }
        }
        feedsToProcess.push(feed);
      }

      // Error feeds: include if last attempt was >2h ago (or never attempted)
      for (const feed of sortedError) {
        if (feed.lastFetchedAt) {
          const timeSinceAttempt = now - new Date(feed.lastFetchedAt).getTime();
          if (timeSinceAttempt < errorCooldownMs) {
            feedsToSkip.push(feed);
            continue;
          }
        }
        // Reset error status before retrying so processFeed has a clean state
        await storage.updateRssFeed(feed.id, { status: 'active' });
        feedsToProcess.push({ ...feed, status: 'active' });
      }

      // Paused feeds: auto-retry after 24h. Keep consecutiveFailures intact so
      // recordFeedFailure knows this was already paused and won't send a dup email.
      for (const feed of sortedPaused) {
        if (feed.lastFetchedAt) {
          const timeSinceAttempt = now - new Date(feed.lastFetchedAt).getTime();
          if (timeSinceAttempt < pausedCooldownMs) {
            feedsToSkip.push(feed);
            continue;
          }
        }
        await storage.updateRssFeed(feed.id, { status: 'active' });
        feedsToProcess.push({ ...feed, status: 'active' });
      }

      const processedActiveCount = activeFeeds.filter(f => feedsToProcess.find(p => p.id === f.id)).length;
      const processedErrorCount = errorFeeds.filter(f => feedsToProcess.find(p => p.id === f.id)).length;
      const processedPausedCount = pausedFeeds.filter(f => feedsToProcess.find(p => p.id === f.id)).length;
      console.log(`[Sync-All] ${feedsToProcess.length} feeds to process (${processedActiveCount} active + ${processedErrorCount} error-retry + ${processedPausedCount} paused-retry), ${feedsToSkip.length} skipped`);

      // Initialize progress
      SYNC_ALL_PROGRESS = {
        isRunning: true,
        totalFeeds: activeFeeds.length + errorFeeds.length + pausedFeeds.length,
        completedFeeds: 0,
        skippedFeeds: feedsToSkip.length,
        currentFeedId: null,
        currentFeedName: null,
        currentFeedProgress: null,
        recentEvents: [],
        feedResults: [],
        startTime: Date.now(),
        delayBetweenFeeds: delayBetweenFeeds * 1000
      };

      // Add skipped feeds to results immediately
      for (const feed of feedsToSkip) {
        const hoursAgo = feed.lastFetchedAt 
          ? Math.round((now - new Date(feed.lastFetchedAt).getTime()) / (60 * 60 * 1000))
          : 0;
        const isPausedFeed = feed.status === 'paused';
        const isErrorFeed = feed.status === 'error';
        SYNC_ALL_PROGRESS.feedResults.push({
          feedId: feed.id,
          feedName: feed.name,
          status: 'skipped',
          eventsCreated: 0,
          lastFetchedAt: feed.lastFetchedAt,
          skipReason: isPausedFeed
            ? `Gepauzeerd: volgende poging over ${Math.max(0, 24 - hoursAgo)}u`
            : isErrorFeed
            ? `Fout: minder dan ${errorRetryCooldownHours}u geleden geprobeerd`
            : `Gesynchroniseerd ${hoursAgo} uur geleden (< ${skipRecentHours}u)`
        });
      }

      // Start async processing (don't await - let it run in background)
      (async () => {
        const { RssFeedService } = await import('./services/rss-feed-service');
        let backoffMultiplier = 1;
        const maxBackoff = 60000; // Max 60 seconds backoff
        const baseDelay = delayBetweenFeeds * 1000;

        for (let i = 0; i < feedsToProcess.length; i++) {
          const feed = feedsToProcess[i];
          
          // Check if cancelled (either nulled or isRunning set to false)
          if (!SYNC_ALL_PROGRESS || !SYNC_ALL_PROGRESS.isRunning) {
            console.log('[Sync-All] Cancelled by user, stopping...');
            break;
          }
          
          SYNC_ALL_PROGRESS.currentFeedId = feed.id;
          SYNC_ALL_PROGRESS.currentFeedName = feed.name;
          SYNC_ALL_PROGRESS.currentFeedProgress = {
            phase: 'starting',
            message: 'Feed synchronisatie starten...',
            startedAt: Date.now()
          };
          
          const lastSyncInfo = feed.lastFetchedAt 
            ? ` (laatst: ${Math.round((now - new Date(feed.lastFetchedAt).getTime()) / (60 * 60 * 1000))}u geleden)`
            : ' (nog nooit gesynchroniseerd)';
          console.log(`[Sync-All] Processing feed ${i + 1}/${feedsToProcess.length}: ${feed.name}${lastSyncInfo}`);
          
          try {
            // Update progress to fetching phase
            if (SYNC_ALL_PROGRESS) {
              SYNC_ALL_PROGRESS.currentFeedProgress = {
                phase: 'fetching',
                message: 'Feed data ophalen...',
                startedAt: SYNC_ALL_PROGRESS.currentFeedProgress?.startedAt || Date.now()
              };
            }

            // Process the feed with progress callback - map fields from RssFeedService format
            const result = await RssFeedService.processFeed(feed, storage, (progressUpdate) => {
              if (SYNC_ALL_PROGRESS && SYNC_ALL_PROGRESS.currentFeedProgress) {
                // Map RssFeedService fields to our expected format
                const phaseMap: Record<string, 'starting' | 'fetching' | 'parsing' | 'processing' | 'saving' | 'completed' | 'error'> = {
                  'fetching': 'fetching',
                  'parsing': 'parsing',
                  'processing': 'processing',
                  'saving': 'saving',
                  'complete': 'completed',
                  'error': 'error'
                };
                
                SYNC_ALL_PROGRESS.currentFeedProgress = {
                  ...SYNC_ALL_PROGRESS.currentFeedProgress,
                  phase: progressUpdate.status ? (phaseMap[progressUpdate.status] || SYNC_ALL_PROGRESS.currentFeedProgress.phase) : SYNC_ALL_PROGRESS.currentFeedProgress.phase,
                  message: progressUpdate.message || SYNC_ALL_PROGRESS.currentFeedProgress.message,
                  itemsFound: progressUpdate.totalItems ?? SYNC_ALL_PROGRESS.currentFeedProgress.itemsFound,
                  itemsProcessed: progressUpdate.processedItems ?? SYNC_ALL_PROGRESS.currentFeedProgress.itemsProcessed,
                  eventsCreated: progressUpdate.eventsCreated ?? SYNC_ALL_PROGRESS.currentFeedProgress.eventsCreated,
                  eventsUpdated: progressUpdate.eventsUpdated ?? SYNC_ALL_PROGRESS.currentFeedProgress.eventsUpdated,
                  eventsSkipped: progressUpdate.eventsSkipped ?? SYNC_ALL_PROGRESS.currentFeedProgress.eventsSkipped,
                };

                // Collect logMessage into recentEvents (max 8)
                if (progressUpdate.logMessage && SYNC_ALL_PROGRESS.recentEvents !== undefined) {
                  SYNC_ALL_PROGRESS.recentEvents = [
                    progressUpdate.logMessage,
                    ...SYNC_ALL_PROGRESS.recentEvents
                  ].slice(0, 8);
                }
              }
            });
            
            // Mark feed as completed
            if (SYNC_ALL_PROGRESS) {
              SYNC_ALL_PROGRESS.currentFeedProgress = {
                phase: 'completed',
                message: `Voltooid: ${result.eventsCreated || 0} events`,
                itemsFound: result.itemsProcessed || 0,
                eventsCreated: result.eventsCreated || 0,
                startedAt: SYNC_ALL_PROGRESS.currentFeedProgress?.startedAt || Date.now()
              };
            }
            
            SYNC_ALL_PROGRESS?.feedResults.push({
              feedId: feed.id,
              feedName: feed.name,
              status: 'success',
              eventsCreated: result.eventsCreated || 0,
              eventsUpdated: result.eventsUpdated || 0,
              eventsSkipped: result.eventsSkipped || 0,
              eventsRejected: result.eventsRejected || 0,
              lastFetchedAt: feed.lastFetchedAt,
              message: `${result.itemsProcessed || 0} items verwerkt, ${result.eventsCreated || 0} events`
            });
            
            // Reset backoff on success
            backoffMultiplier = 1;
            
          } catch (error: any) {
            console.error(`[Sync-All] Error syncing feed ${feed.name}:`, error.message);
            
            if (SYNC_ALL_PROGRESS) {
              SYNC_ALL_PROGRESS.currentFeedProgress = {
                phase: 'error',
                message: error.message || 'Onbekende fout',
                startedAt: SYNC_ALL_PROGRESS.currentFeedProgress?.startedAt || Date.now()
              };
            }
            
            SYNC_ALL_PROGRESS?.feedResults.push({
              feedId: feed.id,
              feedName: feed.name,
              status: 'error',
              eventsCreated: 0,
              lastFetchedAt: feed.lastFetchedAt,
              message: error.message || 'Onbekende fout'
            });
            
            // Exponential backoff on error (max 60s)
            backoffMultiplier = Math.min(backoffMultiplier * 2, maxBackoff / baseDelay);
          }
          
          if (SYNC_ALL_PROGRESS) {
            SYNC_ALL_PROGRESS.completedFeeds = i + 1;
          }
          
          // Wait before next feed (with exponential backoff if there was an error)
          if (i < feedsToProcess.length - 1 && SYNC_ALL_PROGRESS) {
            const waitTime = Math.round(baseDelay * backoffMultiplier);
            SYNC_ALL_PROGRESS.nextFeedIn = waitTime;
            SYNC_ALL_PROGRESS.currentFeedProgress = null;
            console.log(`[Sync-All] Waiting ${waitTime / 1000}s before next feed...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        
        // Mark as completed
        if (SYNC_ALL_PROGRESS) {
          SYNC_ALL_PROGRESS.isRunning = false;
          SYNC_ALL_PROGRESS.currentFeedId = null;
          SYNC_ALL_PROGRESS.currentFeedName = null;
          SYNC_ALL_PROGRESS.currentFeedProgress = null;
          SYNC_ALL_PROGRESS.nextFeedIn = undefined;
          
          const successCount = SYNC_ALL_PROGRESS.feedResults.filter(r => r.status === 'success').length;
          const errorCount = SYNC_ALL_PROGRESS.feedResults.filter(r => r.status === 'error').length;
          const skippedCount = SYNC_ALL_PROGRESS.feedResults.filter(r => r.status === 'skipped').length;
          
          console.log(`[Sync-All] Completed. ${successCount} success, ${errorCount} errors, ${skippedCount} skipped.`);
          
          // Clean up after 5 minutes
          setTimeout(() => {
            SYNC_ALL_PROGRESS = null;
          }, 5 * 60 * 1000);
        }
      })();

      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: null,
        entityType: 'rss_feed',
        details: { action: 'sync_all_feeds', totalFeeds: activeFeeds.length + errorFeeds.length, errorFeedsIncluded: errorFeeds.filter(f => feedsToProcess.find(p => p.id === f.id)).length, feedsToProcess: feedsToProcess.length, feedsSkipped: feedsToSkip.length },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      
      const errorFeedsQueued = errorFeeds.filter(f => feedsToProcess.find(p => p.id === f.id)).length;
      res.json({ 
        message: "Sync-all gestart",
        totalFeeds: activeFeeds.length + errorFeeds.length,
        feedsToProcess: feedsToProcess.length,
        feedsSkipped: feedsToSkip.length,
        errorFeedsQueued,
        skipRecentHours,
        delayBetweenFeeds
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/sync-all:', error);
      SYNC_ALL_PROGRESS = null;
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Manually reactivate all paused feeds (fresh start: reset consecutiveFailures to 0)
  app.post("/api/admin/rss-feeds/reactivate-paused", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      const pausedFeeds = feeds.filter(f => f.status === 'paused');
      if (pausedFeeds.length === 0) {
        return res.json({ reactivated: 0, message: "Geen gepauzeerde feeds gevonden" });
      }
      for (const feed of pausedFeeds) {
        await storage.updateRssFeed(feed.id, { status: 'active', lastErrorMessage: null, consecutiveFailures: 0 });
      }
      console.log(`[Reactivate-Paused] Reactivated ${pausedFeeds.length} paused feeds`);
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: null,
        entityType: 'rss_feed',
        details: { action: 'reactivate_paused_feeds', count: pausedFeeds.length, feedNames: pausedFeeds.map(f => f.name) },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      res.json({ reactivated: pausedFeeds.length, message: `${pausedFeeds.length} gepauzeerde feeds hergeactiveerd` });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/reactivate-paused:', error);
      res.status(500).json({ message: error.message || "Internal server error" });
    }
  });

  // Reset all error feeds to active status so they get picked up by next sync
  app.post("/api/admin/rss-feeds/reset-error-feeds", isAdmin, async (req, res) => {
    try {
      const feeds = await storage.getAllRssFeeds();
      const errorFeeds = feeds.filter(f => f.status === 'error' || f.status === 'paused');
      if (errorFeeds.length === 0) {
        return res.json({ reset: 0, message: "Geen feeds met fout- of pauze-status gevonden" });
      }
      for (const feed of errorFeeds) {
        await storage.updateRssFeed(feed.id, { status: 'active', lastErrorMessage: null, consecutiveFailures: 0 });
      }
      console.log(`[Reset-Error-Feeds] Reset ${errorFeeds.length} feeds (error/paused) to active`);
      await storage.logActivity({
        userId: req.user!.id,
        activityType: 'admin_action',
        entityId: null,
        entityType: 'rss_feed',
        details: { action: 'reset_error_feeds', count: errorFeeds.length, feedNames: errorFeeds.map(f => f.name) },
        ipAddress: req.ip || null,
        userAgent: req.headers['user-agent'] || null,
      });
      res.json({ reset: errorFeeds.length, message: `${errorFeeds.length} feeds teruggezet naar actief` });
    } catch (error: any) {
      console.error('Error in POST /api/admin/rss-feeds/reset-error-feeds:', error);
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
    // Calculate feeds to process (total minus skipped)
    const feedsToProcess = SYNC_ALL_PROGRESS.totalFeeds - SYNC_ALL_PROGRESS.skippedFeeds;
    const remainingFeeds = feedsToProcess - SYNC_ALL_PROGRESS.completedFeeds;
    
    // percentComplete based on feeds to process (not including skipped)
    const percentComplete = feedsToProcess > 0 
      ? Math.round((SYNC_ALL_PROGRESS.completedFeeds / feedsToProcess) * 100)
      : 100;
    
    res.json({
      ...SYNC_ALL_PROGRESS,
      elapsedMs: elapsed,
      estimatedRemainingMs: Math.round(avgTimePerFeed * remainingFeeds),
      percentComplete,
      feedsToProcess
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
      const status = (req.query.status as string) || undefined;
      const items = await storage.getIncompleteItems(feedId, status);
      res.json(items);
    } catch (error) {
      console.error('Error in GET /api/admin/incomplete-items:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/incomplete-items/count", isAdmin, async (req, res) => {
    try {
      const feedId = req.query.feedId ? parseInt(req.query.feedId as string) : undefined;
      const status = (req.query.status as string) || undefined;
      const count = await storage.getIncompleteItemsCount(feedId, status);
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

  // Quality Check endpoints
  app.post("/api/admin/rss-feeds/:id/quality-check", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed niet gevonden" });
      }
      
      const { qualityCheckService } = await import("./services/quality-check-service");
      const { useGemini = false } = req.body;
      
      let result;
      if (useGemini) {
        result = await qualityCheckService.runGeminiCheck(feedId, 3);
      } else {
        result = await qualityCheckService.runBasicChecks(feedId);
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error in POST /api/admin/rss-feeds/:id/quality-check:', error);
      res.status(500).json({ message: "Kwaliteitscontrole mislukt" });
    }
  });
  
  app.get("/api/admin/rss-feeds/:id/quality-check", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const { qualityCheckService } = await import("./services/quality-check-service");
      const result = await qualityCheckService.getLatestCheckResult(feedId);
      
      if (!result) {
        return res.json({ hasCheck: false });
      }
      
      res.json({ hasCheck: true, ...result });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/quality-check:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/admin/rss-feeds/:id/quality-check/history", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const { qualityCheckService } = await import("./services/quality-check-service");
      const history = await qualityCheckService.getCheckHistory(feedId);
      
      res.json(history);
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/quality-check/history:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.post("/api/admin/quality-issues/:id/resolve", isAdmin, async (req, res) => {
    try {
      const issueId = parseInt(req.params.id);
      if (isNaN(issueId)) {
        return res.status(400).json({ message: "Invalid issue ID" });
      }
      
      await storage.resolveQualityIssue(issueId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error in POST /api/admin/quality-issues/:id/resolve:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  app.get("/api/admin/rss-feeds/:id/sync-history", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const rawLimit = parseInt(String(req.query.limit ?? "10"));
      const limit = Math.min(Math.max(isNaN(rawLimit) ? 10 : rawLimit, 1), 101);

      const [latestSync, history, avgDuration] = await Promise.all([
        storage.getLatestSyncForFeed(feedId),
        storage.getSyncHistoryForFeed(feedId, limit),
        storage.getAverageSyncDurationForFeed(feedId)
      ]);
      
      res.json({
        latestSync,
        history,
        avgDurationMs: avgDuration
      });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/sync-history:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Events van een feed zonder afbeelding (voor kwaliteitsdetectie)
  app.get("/api/admin/rss-feeds/:id/events-without-image", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) return res.status(400).json({ message: "Invalid feed ID" });

      const rows = await db
        .select({
          id: eventsTable.id,
          title: eventsTable.title,
          startTime: eventsTable.startTime,
          category: eventsTable.category,
          address: eventsTable.address,
          imageUrl: eventsTable.imageUrl,
        })
        .from(eventsTable)
        .innerJoin(rssFeedItems, eq(rssFeedItems.eventId, eventsTable.id))
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          sql`${eventsTable.imageUrl} IS NULL`,
          sql`${eventsTable.deletedAt} IS NULL`,
          sql`${eventsTable.startTime} > NOW()`,
        ))
        .orderBy(desc(eventsTable.startTime))
        .limit(200);

      res.json({ events: rows, total: rows.length });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/events-without-image:', error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Events die binnen een bepaald tijdvenster (sync-moment) nieuw zijn opgehaald voor een feed
  app.get("/api/admin/rss-feeds/:id/imported-events", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.id);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      const from = req.query.from ? new Date(String(req.query.from)) : null;
      const to = req.query.to ? new Date(String(req.query.to)) : null;
      if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) {
        return res.status(400).json({ message: "Geldige 'from' en 'to' parameters zijn verplicht" });
      }

      const rows = await db
        .select({
          id: eventsTable.id,
          title: eventsTable.title,
          startTime: eventsTable.startTime,
          category: eventsTable.category,
          address: eventsTable.address,
          createdAt: eventsTable.createdAt,
        })
        .from(eventsTable)
        .innerJoin(rssFeedItems, eq(rssFeedItems.eventId, eventsTable.id))
        .where(and(
          eq(rssFeedItems.feedId, feedId),
          gt(eventsTable.createdAt, from),
          lte(eventsTable.createdAt, to),
        ))
        .orderBy(desc(eventsTable.createdAt))
        .limit(300);

      res.json({ events: rows });
    } catch (error) {
      console.error('Error in GET /api/admin/rss-feeds/:id/imported-events:', error);
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

      const html = await response.text();
      
      // Use cheerio to parse and modify HTML safely
      const $ = cheerio.load(html, { decodeEntities: false });
      
      // Helper to resolve URLs
      const resolveUrl = (urlValue: string | undefined): string => {
        if (!urlValue) return '';
        if (urlValue.startsWith('data:') || urlValue.startsWith('javascript:') || urlValue.startsWith('#') || urlValue.startsWith('mailto:') || urlValue.startsWith('tel:')) {
          return urlValue;
        }
        if (urlValue.startsWith('http://') || urlValue.startsWith('https://')) {
          return urlValue;
        }
        if (urlValue.startsWith('//')) {
          return `https:${urlValue}`;
        }
        if (urlValue.startsWith('/')) {
          return `${parsedUrl.origin}${urlValue}`;
        }
        try {
          return new URL(urlValue, url).href;
        } catch {
          return `${parsedUrl.origin}/${urlValue}`;
        }
      };
      
      // Remove existing base tags and add our own
      $('base').remove();
      $('head').prepend(`<base href="${parsedUrl.origin}/">`);
      
      // Fix all link stylesheets - this is critical for layout
      $('link[rel="stylesheet"]').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          $(el).attr('href', resolveUrl(href));
        }
      });
      
      // Fix all script sources
      $('script[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          $(el).attr('src', resolveUrl(src));
        }
      });
      
      // Fix all image sources and lazy loading
      $('img').each((_, el) => {
        const $el = $(el);
        
        // Handle lazy loading attributes
        const lazySrc = $el.attr('data-src') || $el.attr('data-lazy-src') || $el.attr('data-original');
        if (lazySrc) {
          $el.attr('src', resolveUrl(lazySrc));
        }
        
        // Fix regular src
        const src = $el.attr('src');
        if (src && !src.startsWith('data:')) {
          $el.attr('src', resolveUrl(src));
        }
        
        // Handle srcset
        const dataSrcset = $el.attr('data-srcset');
        if (dataSrcset) {
          const resolved = dataSrcset.split(',').map(part => {
            const [srcUrl, ...rest] = part.trim().split(/\s+/);
            return `${resolveUrl(srcUrl)} ${rest.join(' ')}`.trim();
          }).join(', ');
          $el.attr('srcset', resolved);
          $el.removeAttr('data-srcset');
        }
        
        const srcset = $el.attr('srcset');
        if (srcset && !srcset.startsWith('data:')) {
          const resolved = srcset.split(',').map(part => {
            const [srcUrl, ...rest] = part.trim().split(/\s+/);
            if (srcUrl.startsWith('http') || srcUrl.startsWith('data:')) return part.trim();
            return `${resolveUrl(srcUrl)} ${rest.join(' ')}`.trim();
          }).join(', ');
          $el.attr('srcset', resolved);
        }
        
        // Remove lazy loading
        $el.removeAttr('loading');
        $el.removeClass('lazy lazyload lazyloading lazy-hidden');
      });
      
      // Fix picture source elements
      $('picture source').each((_, el) => {
        const $el = $(el);
        const srcset = $el.attr('srcset') || $el.attr('data-srcset');
        if (srcset) {
          const resolved = srcset.split(',').map(part => {
            const [srcUrl, ...rest] = part.trim().split(/\s+/);
            if (srcUrl.startsWith('http') || srcUrl.startsWith('data:')) return part.trim();
            return `${resolveUrl(srcUrl)} ${rest.join(' ')}`.trim();
          }).join(', ');
          $el.attr('srcset', resolved);
        }
      });
      
      // Fix video posters and sources
      $('video').each((_, el) => {
        const $el = $(el);
        const poster = $el.attr('poster');
        if (poster) {
          $el.attr('poster', resolveUrl(poster));
        }
        const src = $el.attr('src');
        if (src) {
          $el.attr('src', resolveUrl(src));
        }
      });
      
      $('video source, audio source').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          $(el).attr('src', resolveUrl(src));
        }
      });
      
      // Fix iframe sources
      $('iframe[src]').each((_, el) => {
        const src = $(el).attr('src');
        if (src && !src.startsWith('data:') && !src.startsWith('about:')) {
          $(el).attr('src', resolveUrl(src));
        }
      });
      
      // Fix background images in inline styles
      $('[style*="background"]').each((_, el) => {
        const style = $(el).attr('style');
        if (style) {
          const fixed = style.replace(/url\(['"]?([^'")]+)['"]?\)/gi, (match, urlValue) => {
            if (urlValue.startsWith('http') || urlValue.startsWith('data:')) return match;
            return `url('${resolveUrl(urlValue)}')`;
          });
          $(el).attr('style', fixed);
        }
      });
      
      // Fix data-bg attributes (common lazy loading pattern)
      $('[data-bg]').each((_, el) => {
        const bg = $(el).attr('data-bg');
        if (bg) {
          const currentStyle = $(el).attr('style') || '';
          $(el).attr('style', `${currentStyle}; background-image: url('${resolveUrl(bg)}')`);
        }
      });
      
      // Add minimal CSS for VFC functionality only - no layout overrides
      $('head').append(`
        <style data-vfc-styles>
          .vfc-highlight { outline: 3px solid #3b82f6 !important; outline-offset: 2px !important; }
          .vfc-hover { outline: 2px dashed #10b981 !important; cursor: pointer !important; }
        </style>
      `);

      const finalHtml = $.html();
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
        html: finalHtml,
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

  app.post("/api/admin/visual-configurator/analyze-detail-selectors", isAdmin, async (req, res) => {
    try {
      const { html, fields } = req.body;
      if (!html || !fields || !Array.isArray(fields)) {
        return res.status(400).json({ message: "HTML and fields are required" });
      }

      const fieldDescriptions: Record<string, string> = {
        date: 'datum van het event (bijv. "15 maart 2026")',
        location: 'locatie/venue naam en adres',
        image: 'hoofd afbeelding van het event (img src URL)',
        time: 'starttijd en eindtijd (bijv. "20:00 - 22:00")',
        description: 'beschrijving van het event',
        category: 'categorie van het event',
      };

      const fieldsStr = fields.map((f: string) => `- ${f}: ${fieldDescriptions[f] || f}`).join('\n');
      
      const truncatedHtml = html.substring(0, 15000);

      const prompt = `Analyseer deze HTML van een event detail pagina en vind CSS selectors voor de volgende velden:

${fieldsStr}

HTML (verkort):
${truncatedHtml}

Geef voor elk veld de beste CSS selector terug. Gebruik specifieke selectors die werken op detail pagina's van deze website.
Voor afbeeldingen: geef de selector voor het img element (niet de container).

Antwoord in dit JSON formaat:
{
  "selectors": {
    ${fields.map((f: string) => `"${f}": "CSS selector of null als niet gevonden"`).join(',\n    ')}
  },
  "confidence": 0-100
}`;

      const result = await AiProvider.complete({
        systemPrompt: "Je bent een expert in web scraping en CSS selectors. Analyseer HTML en bepaal de beste selectors. Antwoord alleen in JSON.",
        userPrompt: prompt,
        maxTokens: 800,
        temperature: 0.1,
        jsonMode: true,
      });

      if (!result.success || !result.content) {
        return res.json({ selectors: {}, confidence: 0, error: result.error || 'AI analyse mislukt' });
      }

      let parsed: any;
      try {
        parsed = JSON.parse(result.content);
      } catch (parseErr) {
        console.error('[Detail Selectors] Failed to parse AI response:', result.content?.substring(0, 200));
        return res.json({ selectors: {}, confidence: 0, error: 'AI response kon niet worden geparsed' });
      }

      const cleanSelectors: Record<string, string> = {};
      
      if (parsed.selectors) {
        for (const [key, value] of Object.entries(parsed.selectors)) {
          if (value && typeof value === 'string' && value !== 'null' && value.trim() !== '') {
            cleanSelectors[key] = value;
          }
        }
      }

      res.json({ 
        selectors: cleanSelectors, 
        confidence: parsed.confidence || 0 
      });
    } catch (error: any) {
      console.error('Error analyzing detail selectors:', error);
      res.status(500).json({ message: error.message || "Analyse mislukt" });
    }
  });

  app.post("/api/admin/visual-configurator/save-config", isAdmin, async (req, res) => {
    try {
      const { url, domain, selectors, municipality, sampleDetailUrl } = req.body;
      
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

      const isAiGenerated = req.body.scraperConfig?.aiGenerated === true;
      const validationErrors: string[] = [];
      if (!selectors.title || typeof selectors.title !== 'string') {
        validationErrors.push('Titel selector is verplicht');
      }
      if (!selectors.date || typeof selectors.date !== 'string') {
        validationErrors.push('Datum selector is verplicht (event moet datum hebben)');
      }
      if (!selectors.link || typeof selectors.link !== 'string') {
        validationErrors.push('Detail link selector is verplicht (om extra velden van detail pagina op te halen)');
      }
      if (!isAiGenerated && (!selectors.location || typeof selectors.location !== 'string')) {
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
        venueDescription: typeof selectors.venueDescription === 'string' ? selectors.venueDescription : undefined,
        address: typeof selectors.address === 'string' ? selectors.address : undefined,
      };

      const paginationData = req.body.scraperConfig?.pagination || req.body.pagination || undefined;

      const profileData = {
        domain,
        pathPattern,
        selectors: validatedSelectors,
        pagination: paginationData || undefined,
        confidence: 80,
        requiresJsRendering: false,
        municipality: typeof municipality === 'string' ? municipality : undefined,
        sampleDetailUrl: typeof sampleDetailUrl === 'string' ? sampleDetailUrl : undefined,
      };

      let savedProfile;
      if (existingProfile) {
        savedProfile = await storage.updateAiExtractionProfile(existingProfile.id, profileData);
        console.log('[Visual Configurator] Updated existing profile:', savedProfile.id, 'for', domain, pathPattern);
      } else {
        savedProfile = await storage.createAiExtractionProfile(profileData);
        console.log('[Visual Configurator] Created new profile:', savedProfile.id, 'for', domain, pathPattern);
      }

      // Check if RSS feed already exists for this URL or linked to this profile
      const existingFeeds = await storage.getAllRssFeeds();
      // First try to find by exact URL, then by profile ID
      let existingFeed = existingFeeds.find(f => f.url === url);
      if (!existingFeed) {
        existingFeed = existingFeeds.find(f => f.aiExtractionProfileId === savedProfile.id);
      }
      
      let rssFeed;
      const feedName = req.body.feedName || (municipality 
        ? `${domain.replace('www.', '')} - ${municipality}` 
        : domain.replace('www.', ''));
      
      const scraperConfigData = req.body.scraperConfig || undefined;
      
      if (existingFeed) {
        rssFeed = await storage.updateRssFeed(existingFeed.id, {
          name: feedName,
          url: url,
          feedType: 'scraper',
          aiExtractionProfileId: savedProfile.id,
          municipality: municipality || existingFeed.municipality,
          status: 'active',
          scraperConfig: scraperConfigData || existingFeed.scraperConfig,
        });
        console.log('[Visual Configurator] Updated existing RSS feed:', rssFeed.id, 'with profile:', savedProfile.id);
      } else {
        rssFeed = await storage.createRssFeed({
          name: feedName,
          url: url,
          feedType: 'scraper',
          status: 'active',
          defaultCategory: 'community',
          municipality: municipality || undefined,
          updateFrequencyMinutes: 360,
          autoCreateEvents: true,
          aiExtractionProfileId: savedProfile.id,
          scraperConfig: scraperConfigData || undefined,
        });
        console.log('[Visual Configurator] Created new RSS feed:', rssFeed.id, 'linked to profile:', savedProfile.id);
      }

      res.json({ 
        success: true,
        message: existingProfile 
          ? `Bestaande configuratie bijgewerkt en feed "${feedName}" gekoppeld` 
          : `Nieuwe configuratie en feed "${feedName}" aangemaakt`,
        profile: savedProfile,
        feed: rssFeed,
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/visual-configurator/save-config:', error);
      res.status(500).json({ 
        message: error.message || "Failed to save configuration" 
      });
    }
  });

  // Get all saved visual parser configurations
  app.get("/api/admin/visual-configurator/configs", isAdmin, async (req, res) => {
    try {
      const profiles = await storage.getAllAiExtractionProfiles();
      res.json(profiles);
    } catch (error: any) {
      console.error('Error in GET /api/admin/visual-configurator/configs:', error);
      res.status(500).json({ message: error.message || "Failed to fetch configurations" });
    }
  });

  // Get visual configuration for a specific feed
  app.get("/api/admin/visual-configurator/feed/:feedId", isAdmin, async (req, res) => {
    try {
      const feedId = parseInt(req.params.feedId);
      if (isNaN(feedId)) {
        return res.status(400).json({ message: "Invalid feed ID" });
      }
      
      const feed = await storage.getRssFeed(feedId);
      if (!feed) {
        return res.status(404).json({ message: "Feed niet gevonden" });
      }
      
      if (!feed.aiExtractionProfileId) {
        return res.status(404).json({ message: "Deze feed heeft geen visuele configuratie" });
      }
      
      const profile = await storage.getAiExtractionProfile(feed.aiExtractionProfileId);
      if (!profile) {
        return res.status(404).json({ message: "Visuele configuratie niet gevonden" });
      }
      
      res.json({
        feed: {
          id: feed.id,
          name: feed.name,
          url: feed.url,
          municipality: feed.municipality,
        },
        profile: {
          id: profile.id,
          domain: profile.domain,
          pathPattern: profile.pathPattern,
          selectors: profile.selectors,
          municipality: profile.municipality,
          sampleDetailUrl: profile.sampleDetailUrl,
        }
      });
    } catch (error: any) {
      console.error('Error in GET /api/admin/visual-configurator/feed/:feedId:', error);
      res.status(500).json({ message: error.message || "Failed to fetch configuration" });
    }
  });

  // Delete a visual parser configuration
  app.delete("/api/admin/visual-configurator/configs/:id", isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid configuration ID" });
      }
      await storage.deleteAiExtractionProfile(id);
      res.json({ success: true, message: "Configuratie verwijderd" });
    } catch (error: any) {
      console.error('Error in DELETE /api/admin/visual-configurator/configs/:id:', error);
      res.status(500).json({ message: error.message || "Failed to delete configuration" });
    }
  });

  // Test/preview a visual parser configuration - fetch events using the selectors
  app.post("/api/admin/visual-configurator/test", isAdmin, async (req, res) => {
    try {
      const { url, selectors } = req.body;
      if (!url || !selectors) {
        return res.status(400).json({ message: "URL en selectors zijn verplicht" });
      }

      const parsedUrl = new URL(url);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        return res.status(response.status).json({ message: `Failed to fetch page: ${response.statusText}` });
      }

      const html = await response.text();
      
      // Parse HTML with JSDOM or similar
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Find all event cards
      const eventCards = document.querySelectorAll(selectors.eventCard);
      const events: Array<{
        title: string;
        date: string;
        location: string;
        description?: string;
        image?: string;
        link?: string;
        venue?: string;
      }> = [];

      eventCards.forEach((card: Element, index: number) => {
        if (index >= 10) return; // Limit to 10 for preview
        
        const getText = (selector: string | undefined) => {
          if (!selector) return undefined;
          const el = card.querySelector(selector);
          if (!el) return undefined;
          
          // For container elements with multiple paragraphs/children,
          // extract text from all child nodes preserving paragraph structure
          const paragraphs: string[] = [];
          let currentParagraph = '';
          
          const collectText = (node: ChildNode) => {
            if (node.nodeType === 3) { // Text node
              const text = node.textContent?.trim();
              if (text) {
                currentParagraph += (currentParagraph ? ' ' : '') + text;
              }
            } else if (node.nodeType === 1) { // Element node
              const tagName = (node as Element).tagName?.toLowerCase();
              const isBlock = ['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'article', 'section'].includes(tagName);
              
              if (isBlock && currentParagraph) {
                // Save current paragraph before entering block element
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
              }
              
              node.childNodes.forEach(child => collectText(child));
              
              if (isBlock && currentParagraph) {
                // Save paragraph after exiting block element
                paragraphs.push(currentParagraph.trim());
                currentParagraph = '';
              }
            }
          };
          
          el.childNodes.forEach(child => collectText(child));
          
          // Don't forget any remaining text
          if (currentParagraph.trim()) {
            paragraphs.push(currentParagraph.trim());
          }
          
          // Join paragraphs with double newline for proper separation
          const result = paragraphs
            .filter(p => p.length > 0)
            .join('\n\n')
            .trim();
          
          return result || el.textContent?.trim() || undefined;
        };

        const getAttr = (selector: string | undefined, attr: string) => {
          if (!selector) return undefined;
          const el = card.querySelector(selector);
          return el?.getAttribute(attr) || undefined;
        };

        const title = getText(selectors.title);
        const date = getText(selectors.date);
        const location = getText(selectors.location);
        
        if (title && date) {
          let imageUrl = getAttr(selectors.image, 'src') || 
                         getAttr(selectors.image, 'data-src') ||
                         getAttr(selectors.image, 'data-lazy-src');
          
          // Convert relative URLs to absolute
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = new URL(imageUrl, parsedUrl.origin).href;
          }

          events.push({
            title,
            date,
            location: location || 'Locatie onbekend',
            description: getText(selectors.description),
            image: imageUrl,
            link: getAttr(selectors.link, 'href'),
            venue: getText(selectors.venue),
          });
        }
      });

      res.json({
        success: true,
        totalFound: eventCards.length,
        previewEvents: events,
        message: `${eventCards.length} events gevonden, ${events.length} met volledige data`,
      });
    } catch (error: any) {
      console.error('Error in POST /api/admin/visual-configurator/test:', error);
      res.status(500).json({ message: error.message || "Failed to test configuration" });
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
      const category = feed?.defaultCategory || 'Rondleiding & Uitstap';

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
        hostId: null,
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
      
      const brand = getRequestBrand(req);
      const limit = parseInt(req.query.limit as string) || 50;
      const events = await storage.getEventsByCitySlug(citySlug, limit, brand);
      const count = await storage.getEventCountByCitySlug(citySlug, brand);
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
      
      const city = getCityBySlug(citySlug);
      if (!city) {
        return res.status(404).json({ message: "City not found" });
      }
      
      if (provinceSlug && city.provinceSlug !== provinceSlug) {
        return res.status(404).json({ message: "City not found in this province" });
      }
      
      const brand = getRequestBrand(req);
      const content = getBrandCityContent(brand, citySlug, city.name, city.province);
      const eventCount = await storage.getEventCountByCitySlug(citySlug, brand);
      
      res.json({ city, content, eventCount, brand });
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

  // Bepaal de canonieke base-URL voor de huidige request/merk.
  const getBaseUrl = (req: any): string => {
    if (process.env.CUSTOM_DOMAIN) return `https://${process.env.CUSTOM_DOMAIN}`;
    const host = req.get("host");
    if (process.env.NODE_ENV === "production") {
      return `https://${host ?? "letsgoradar.com"}`;
    }
    return `http://${host ?? "localhost:5000"}`;
  };

  // NB: /robots.txt wordt afgehandeld in server/index.ts (vóór registerRoutes
  // geregistreerd, dus die wint). Daar is hij ook domein-bewust. We registreren
  // hem hier bewust NIET nogmaals om een dode duplicaat te voorkomen.

  // Sitemap.xml generator — merk-bewust. Focus-merken nemen alleen steden op
  // die daadwerkelijk relevante (gefilterde) events bevatten, zodat we geen
  // dunne/lege pagina's aan zoekmachines aanbieden.
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const { getActiveCities, generateCityEventsUrl } = await import('@shared/cities');
      const brand = getRequestBrand(req);
      const cities = getActiveCities();
      const baseUrl = getBaseUrl(req);

      let citiesToInclude = cities;
      if (brand.categories && brand.categories.length > 0) {
        const counts = await Promise.all(
          cities.map((c) =>
            storage.getEventCountByCitySlug(c.slug, brand)
              .then((n) => ({ city: c, n }))
              .catch(() => ({ city: c, n: 0 }))
          )
        );
        citiesToInclude = counts.filter((x) => x.n > 0).map((x) => x.city);
      }

      let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      sitemap += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;
      
      for (const city of citiesToInclude) {
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

      const venue = await storage.getVenue(venueId);
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

      const venue = await storage.getVenue(venueId);
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

  // ===== EVENT TAGS, TARGET AUDIENCES & SEASONAL THEMES MANAGEMENT =====
  
  // Get all event tags
  app.get("/api/event-tags", async (req, res) => {
    try {
      const tags = await storage.getEventTags();
      res.json(tags);
    } catch (error: any) {
      console.error('Error fetching event tags:', error);
      res.status(500).json({ message: error.message || "Failed to fetch event tags" });
    }
  });

  // Get popular tags in a radius — aggregates eventTagIds frequencies from nearby events
  app.get("/api/events/popular-tags", async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const radius = parseFloat(req.query.radius as string) || 25;
      const limit = parseInt(req.query.limit as string) || 8;

      let events: any[] = [];
      if (!isNaN(lat) && !isNaN(lng)) {
        events = await storage.getEventsByRadius(lat, lng, radius);
      } else {
        events = await storage.getAllEvents();
      }

      const tagFreq = new Map<number, number>();
      for (const event of events) {
        if (Array.isArray(event.eventTagIds)) {
          for (const tagId of event.eventTagIds) {
            tagFreq.set(tagId, (tagFreq.get(tagId) || 0) + 1);
          }
        }
      }

      const sorted = Array.from(tagFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([tagId, count]) => ({ tagId, count }));

      const allTags = await storage.getEventTags();
      const tagMap = new Map(allTags.map(t => [t.id, t]));

      const result = sorted
        .map(({ tagId, count }) => {
          const tag = tagMap.get(tagId);
          if (!tag) return null;
          return { ...tag, eventCount: count };
        })
        .filter(Boolean);

      res.json(result);
    } catch (error: any) {
      console.error('Error fetching popular tags:', error);
      res.status(500).json({ message: error.message || "Failed to fetch popular tags" });
    }
  });

  // Get all target audiences
  app.get("/api/target-audiences", async (req, res) => {
    try {
      const audiences = await storage.getTargetAudiences();
      res.json(audiences);
    } catch (error: any) {
      console.error('Error fetching target audiences:', error);
      res.status(500).json({ message: error.message || "Failed to fetch target audiences" });
    }
  });

  // Helper: calculate Easter Sunday for a given year (Anonymous Gregorian algorithm)
  function calculateEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // Helper: check if a seasonal theme is currently relevant (active or starting within 28 days)
  function isThemeRelevantNow(theme: any): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const FOUR_WEEKS_MS = 28 * 24 * 60 * 60 * 1000;
    const windowEnd = new Date(today.getTime() + FOUR_WEEKS_MS);

    // Floating: Pasen (Easter)
    if (theme.floatingRule === 'easter-2-weeks') {
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const easter = calculateEaster(year);
        const start = new Date(easter.getTime() - 14 * 24 * 60 * 60 * 1000);
        const end = new Date(easter.getTime() + 2 * 24 * 60 * 60 * 1000);
        if (today <= end && windowEnd >= start) return true;
      }
      return false;
    }

    // Floating: Carnaval (ends Ash Wednesday = Easter - 46 days, starts 3 days before)
    if (theme.floatingRule === 'carnival-period') {
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const easter = calculateEaster(year);
        const ashWed = new Date(easter.getTime() - 46 * 24 * 60 * 60 * 1000);
        const start = new Date(ashWed.getTime() - 3 * 24 * 60 * 60 * 1000);
        if (today <= ashWed && windowEnd >= start) return true;
      }
      return false;
    }

    // Fixed-date themes
    if (!theme.startMonth || !theme.startDay) return false;
    const endMonth: number = theme.endMonth ?? theme.startMonth;
    const endDay: number = theme.endDay ?? theme.startDay;

    // Check current year and adjacent years to handle year-wrap (e.g. Kerst: Dec–Jan)
    for (const yearOffset of [0, 1, -1]) {
      const year = today.getFullYear() + yearOffset;
      const start = new Date(year, theme.startMonth - 1, theme.startDay);
      // Handle year-wrap: end in a later month than start means same year; earlier month = next year
      const end = endMonth < theme.startMonth
        ? new Date(year + 1, endMonth - 1, endDay)
        : new Date(year, endMonth - 1, endDay);
      if (today <= end && windowEnd >= start) return true;
    }

    return false;
  }

  // Helper: check if a theme is currently active (today falls within its date range)
  function isThemeActive(theme: any): boolean {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (theme.floatingRule === 'easter-2-weeks') {
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const easter = calculateEaster(year);
        const start = new Date(easter.getTime() - 14 * 24 * 60 * 60 * 1000);
        const end = new Date(easter.getTime() + 2 * 24 * 60 * 60 * 1000);
        if (today >= start && today <= end) return true;
      }
      return false;
    }

    if (theme.floatingRule === 'carnival-period') {
      for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
        const easter = calculateEaster(year);
        const ashWed = new Date(easter.getTime() - 46 * 24 * 60 * 60 * 1000);
        const start = new Date(ashWed.getTime() - 3 * 24 * 60 * 60 * 1000);
        if (today >= start && today <= ashWed) return true;
      }
      return false;
    }

    if (!theme.startMonth || !theme.startDay) return false;
    const endMonth: number = theme.endMonth ?? theme.startMonth;
    const endDay: number = theme.endDay ?? theme.startDay;

    for (const yearOffset of [0, 1, -1]) {
      const year = today.getFullYear() + yearOffset;
      const start = new Date(year, theme.startMonth - 1, theme.startDay);
      const end = endMonth < theme.startMonth
        ? new Date(year + 1, endMonth - 1, endDay)
        : new Date(year, endMonth - 1, endDay);
      if (today >= start && today <= end) return true;
    }

    return false;
  }

  // Get seasonal themes — only return those active or starting within 4 weeks
  app.get("/api/seasonal-themes", async (req, res) => {
    try {
      const allThemes = await storage.getSeasonalThemes();
      const relevantThemes = allThemes
        .filter(isThemeRelevantNow)
        .map((theme) => {
          const active = isThemeActive(theme);
          return {
            ...theme,
            isCurrentlyActive: active,
            isComingSoon: !active,
            isSchoolHoliday: theme.isSchoolHoliday ?? false,
          };
        });
      res.json(relevantThemes);
    } catch (error: any) {
      console.error('Error fetching seasonal themes:', error);
      res.status(500).json({ message: error.message || "Failed to fetch seasonal themes" });
    }
  });

  // Admin: Create event tag
  app.post("/api/admin/event-tags", isAdmin, async (req, res) => {
    try {
      const parseResult = insertEventTagSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid tag data", errors: parseResult.error.errors });
      }
      const tag = await storage.createEventTag(parseResult.data);
      res.status(201).json(tag);
    } catch (error: any) {
      console.error('Error creating event tag:', error);
      res.status(500).json({ message: error.message || "Failed to create event tag" });
    }
  });

  // Admin: Update event tag
  app.patch("/api/admin/event-tags/:id", isAdmin, async (req, res) => {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }
      const parseResult = insertEventTagSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid tag data", errors: parseResult.error.errors });
      }
      const tag = await storage.updateEventTag(tagId, parseResult.data);
      res.json(tag);
    } catch (error: any) {
      console.error('Error updating event tag:', error);
      res.status(500).json({ message: error.message || "Failed to update event tag" });
    }
  });

  // Admin: Delete event tag
  app.delete("/api/admin/event-tags/:id", isAdmin, async (req, res) => {
    try {
      const tagId = parseInt(req.params.id);
      if (isNaN(tagId)) {
        return res.status(400).json({ message: "Invalid tag ID" });
      }
      await storage.deleteEventTag(tagId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting event tag:', error);
      res.status(500).json({ message: error.message || "Failed to delete event tag" });
    }
  });

  // Admin: Create target audience
  app.post("/api/admin/target-audiences", isAdmin, async (req, res) => {
    try {
      const parseResult = insertTargetAudienceSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid audience data", errors: parseResult.error.errors });
      }
      const audience = await storage.createTargetAudience(parseResult.data);
      res.status(201).json(audience);
    } catch (error: any) {
      console.error('Error creating target audience:', error);
      res.status(500).json({ message: error.message || "Failed to create target audience" });
    }
  });

  // Admin: Update target audience
  app.patch("/api/admin/target-audiences/:id", isAdmin, async (req, res) => {
    try {
      const audienceId = parseInt(req.params.id);
      if (isNaN(audienceId)) {
        return res.status(400).json({ message: "Invalid audience ID" });
      }
      const parseResult = insertTargetAudienceSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid audience data", errors: parseResult.error.errors });
      }
      const audience = await storage.updateTargetAudience(audienceId, parseResult.data);
      res.json(audience);
    } catch (error: any) {
      console.error('Error updating target audience:', error);
      res.status(500).json({ message: error.message || "Failed to update target audience" });
    }
  });

  // Admin: Delete target audience
  app.delete("/api/admin/target-audiences/:id", isAdmin, async (req, res) => {
    try {
      const audienceId = parseInt(req.params.id);
      if (isNaN(audienceId)) {
        return res.status(400).json({ message: "Invalid audience ID" });
      }
      await storage.deleteTargetAudience(audienceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting target audience:', error);
      res.status(500).json({ message: error.message || "Failed to delete target audience" });
    }
  });

  // Admin: Create seasonal theme
  app.post("/api/admin/seasonal-themes", isAdmin, async (req, res) => {
    try {
      const parseResult = insertSeasonalThemeSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid theme data", errors: parseResult.error.errors });
      }
      const theme = await storage.createSeasonalTheme(parseResult.data);
      res.status(201).json(theme);
    } catch (error: any) {
      console.error('Error creating seasonal theme:', error);
      res.status(500).json({ message: error.message || "Failed to create seasonal theme" });
    }
  });

  // Admin: Update seasonal theme
  app.patch("/api/admin/seasonal-themes/:id", isAdmin, async (req, res) => {
    try {
      const themeId = parseInt(req.params.id);
      if (isNaN(themeId)) {
        return res.status(400).json({ message: "Invalid theme ID" });
      }
      const parseResult = insertSeasonalThemeSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ message: "Invalid theme data", errors: parseResult.error.errors });
      }
      const theme = await storage.updateSeasonalTheme(themeId, parseResult.data);
      res.json(theme);
    } catch (error: any) {
      console.error('Error updating seasonal theme:', error);
      res.status(500).json({ message: error.message || "Failed to update seasonal theme" });
    }
  });

  // Admin: Delete seasonal theme
  app.delete("/api/admin/seasonal-themes/:id", isAdmin, async (req, res) => {
    try {
      const themeId = parseInt(req.params.id);
      if (isNaN(themeId)) {
        return res.status(400).json({ message: "Invalid theme ID" });
      }
      await storage.deleteSeasonalTheme(themeId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting seasonal theme:', error);
      res.status(500).json({ message: error.message || "Failed to delete seasonal theme" });
    }
  });

  // ============================================
  // AI ASSISTANT ENDPOINTS
  // ============================================
  
  // Get assistant usage stats
  app.get("/api/assistant/usage", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Niet ingelogd" });
      }
      
      const { getWeeklyUsage } = await import("./services/assistant-service");
      const usage = await getWeeklyUsage(userId);
      
      res.json({
        questionsUsed: usage.questionsUsed,
        questionsRemaining: usage.questionsRemaining === Infinity ? -1 : usage.questionsRemaining,
        isPremium: usage.isPremium,
        freeLimit: 5,
      });
    } catch (error: any) {
      console.error('Error getting assistant usage:', error);
      res.status(500).json({ error: "Kon gebruik niet ophalen" });
    }
  });
  
  // Ask the assistant a question
  app.post("/api/assistant/ask", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) {
        return res.status(401).json({ error: "Niet ingelogd" });
      }
      
      const { question, lat, lng, radius } = req.body;
      
      if (!question || typeof question !== 'string' || question.trim().length === 0) {
        return res.status(400).json({ error: "Vraag is verplicht" });
      }
      
      const { generateAssistantResponse } = await import("./services/assistant-service");
      const result = await generateAssistantResponse(
        userId, 
        question.trim(),
        lat,
        lng,
        radius
      );
      
      if (!result.success) {
        return res.status(429).json({ 
          error: result.error,
          limitReached: true 
        });
      }
      
      res.json({
        response: result.response,
        recommendedEvents: result.recommendedEvents || [],
        questionsRemaining: result.questionsRemaining,
      });
    } catch (error: any) {
      console.error('Error in assistant:', error);
      res.status(500).json({ error: "Er is een fout opgetreden" });
    }
  });
  
  // Get premium features list
  app.get("/api/premium-features", async (req, res) => {
    try {
      const features = await storage.getPremiumFeatures();
      res.json(features);
    } catch (error: any) {
      console.error('Error getting premium features:', error);
      res.status(500).json({ error: "Kon features niet ophalen" });
    }
  });

  // OG tag injection for event detail pages — always inject for all requests so
  // social media previews (WhatsApp, Facebook, Telegram, etc.) always show the
  // event-specific image, title and description. React still boots normally because
  // OG tags live in <head>, outside the React root div.
  const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const handleEventOgRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) return next();
      const event = await storage.getEvent(eventId);
      if (!event) return next();

      // Load the appropriate index.html template (dev: source, prod: built file)
      const isDev = process.env.NODE_ENV === 'development';
      const templatePath = isDev
        ? path.resolve(__dirname, '..', 'client', 'index.html')
        : path.resolve(__dirname, 'public', 'index.html');
      if (!fs.existsSync(templatePath)) return next();
      let html = fs.readFileSync(templatePath, 'utf-8');

      // Build event-specific OG values
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const rawTitle = event.title ? `${event.title} | letsgo radar` : 'letsgo radar - Ontdek lokale evenementen';
      const rawDesc = event.description
        ? event.description.replace(/<[^>]+>/g, '').substring(0, 200).trim()
        : 'Ontdek lokale evenementen in jouw buurt met letsgo radar';
      const title = escAttr(rawTitle);
      const description = escAttr(rawDesc);
      let rawImage = event.imageUrl || '';
      if (rawImage && !rawImage.startsWith('http')) rawImage = `${baseUrl}${rawImage}`;
      const image = escAttr(rawImage || `${baseUrl}/images/letsgo-radar-logo.png`);
      const canonicalUrl = escAttr(`${baseUrl}${req.originalUrl}`);

      // Replace/inject OG meta tags in the template
      html = html
        .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
        .replace(/<meta name="description"[^>]*>/g, `<meta name="description" content="${description}" />`)
        .replace(/<meta property="og:title"[^>]*>/g, `<meta property="og:title" content="${title}" />`)
        .replace(/<meta property="og:description"[^>]*>/g, `<meta property="og:description" content="${description}" />`)
        .replace(/<meta property="og:image"[^>]*>/g, `<meta property="og:image" content="${image}" />`)
        .replace(/<meta property="og:type"[^>]*>/g, `<meta property="og:type" content="event" />`);
      // Add og:url (template does not have it by default)
      if (/<meta property="og:url"[^>]*>/.test(html)) {
        html = html.replace(/<meta property="og:url"[^>]*>/g, `<meta property="og:url" content="${canonicalUrl}" />`);
      } else {
        html = html.replace('</head>', `  <meta property="og:url" content="${canonicalUrl}" />\n  <meta name="twitter:card" content="summary_large_image" />\n  <meta name="twitter:title" content="${title}" />\n  <meta name="twitter:description" content="${description}" />\n  <meta name="twitter:image" content="${image}" />\n</head>`);
      }

      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    } catch {
      next();
    }
  };

  app.get('/app/event/:id', handleEventOgRequest);
  app.get('/web/event/:id', handleEventOgRequest);

  return httpServer;
}