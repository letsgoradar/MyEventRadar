import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const insertVenueContactSchema = z.object({
  venueId: z.number(),
  name: z.string().min(1),
  role: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  isPrimary: z.boolean().optional(),
  notes: z.string().optional(),
});

const insertVenueNoteSchema = z.object({
  venueId: z.number(),
  content: z.string().min(1),
  isPinned: z.boolean().optional(),
});

const insertVenueTaskSchema = z.object({
  venueId: z.number(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).optional(),
});

const insertSponsorCampaignSchema = z.object({
  venueId: z.number().optional(),
  eventId: z.number().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  sponsorName: z.string().optional(),
  sponsorContact: z.string().optional(),
  sponsorEmail: z.string().email().optional().or(z.literal("")),
  sponsorPhone: z.string().optional(),
  campaignType: z.enum(["visibility", "financial", "in_kind", "media", "other"]).optional(),
  value: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["draft", "proposed", "active", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
});

// ============ VENUES ============

router.get("/", isAdmin, async (req: Request, res: Response) => {
  try {
    const venues = await storage.getAllVenues();
    res.json(venues);
  } catch (error) {
    console.error("Error fetching venues:", error);
    res.status(500).json({ error: "Failed to fetch venues" });
  }
});

router.get("/stats", isAdmin, async (req: Request, res: Response) => {
  try {
    const stats = await storage.getVenueStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching venue stats:", error);
    res.status(500).json({ error: "Failed to fetch venue stats" });
  }
});

router.get("/discover", isAdmin, async (req: Request, res: Response) => {
  try {
    const minEvents = parseInt(req.query.minEvents as string) || 2;
    const locations = await storage.discoverPotentialVenues(minEvents);
    res.json(locations);
  } catch (error) {
    console.error("Error discovering venues:", error);
    res.status(500).json({ error: "Failed to discover potential venues" });
  }
});

router.get("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const venue = await storage.getVenueById(id);
    if (!venue) {
      return res.status(404).json({ error: "Venue not found" });
    }
    res.json(venue);
  } catch (error) {
    console.error("Error fetching venue:", error);
    res.status(500).json({ error: "Failed to fetch venue" });
  }
});

router.post("/", isAdmin, async (req: Request, res: Response) => {
  try {
    const venue = await storage.createVenue(req.body);
    res.status(201).json(venue);
  } catch (error) {
    console.error("Error creating venue:", error);
    res.status(500).json({ error: "Failed to create venue" });
  }
});

router.patch("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const venue = await storage.updateVenue(id, req.body);
    res.json(venue);
  } catch (error) {
    console.error("Error updating venue:", error);
    res.status(500).json({ error: "Failed to update venue" });
  }
});

router.delete("/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteVenue(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting venue:", error);
    res.status(500).json({ error: "Failed to delete venue" });
  }
});

router.get("/:id/events", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const events = await storage.getEventsByVenueId(id);
    res.json(events);
  } catch (error) {
    console.error("Error fetching venue events:", error);
    res.status(500).json({ error: "Failed to fetch venue events" });
  }
});

// ============ VENUE CONTACTS ============

router.get("/:id/contacts", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const contacts = await storage.getVenueContacts(venueId);
    res.json(contacts);
  } catch (error) {
    console.error("Error fetching venue contacts:", error);
    res.status(500).json({ error: "Failed to fetch venue contacts" });
  }
});

router.post("/:id/contacts", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const parsed = insertVenueContactSchema.parse({ ...req.body, venueId });
    const contact = await storage.createVenueContact(parsed);
    res.status(201).json(contact);
  } catch (error) {
    console.error("Error creating venue contact:", error);
    res.status(500).json({ error: "Failed to create venue contact" });
  }
});

router.patch("/contacts/:contactId", isAdmin, async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    const contact = await storage.updateVenueContact(contactId, req.body);
    res.json(contact);
  } catch (error) {
    console.error("Error updating venue contact:", error);
    res.status(500).json({ error: "Failed to update venue contact" });
  }
});

router.delete("/contacts/:contactId", isAdmin, async (req: Request, res: Response) => {
  try {
    const contactId = parseInt(req.params.contactId);
    await storage.deleteVenueContact(contactId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting venue contact:", error);
    res.status(500).json({ error: "Failed to delete venue contact" });
  }
});

// ============ VENUE NOTES ============

router.get("/:id/notes", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const notes = await storage.getVenueNotes(venueId);
    res.json(notes);
  } catch (error) {
    console.error("Error fetching venue notes:", error);
    res.status(500).json({ error: "Failed to fetch venue notes" });
  }
});

router.post("/:id/notes", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const parsed = insertVenueNoteSchema.parse({ ...req.body, venueId });
    const note = await storage.createVenueNote({ ...parsed, userId });
    res.status(201).json(note);
  } catch (error) {
    console.error("Error creating venue note:", error);
    res.status(500).json({ error: "Failed to create venue note" });
  }
});

router.patch("/notes/:noteId", isAdmin, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.noteId);
    const note = await storage.updateVenueNote(noteId, req.body);
    res.json(note);
  } catch (error) {
    console.error("Error updating venue note:", error);
    res.status(500).json({ error: "Failed to update venue note" });
  }
});

router.delete("/notes/:noteId", isAdmin, async (req: Request, res: Response) => {
  try {
    const noteId = parseInt(req.params.noteId);
    await storage.deleteVenueNote(noteId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting venue note:", error);
    res.status(500).json({ error: "Failed to delete venue note" });
  }
});

// ============ VENUE TASKS ============

router.get("/:id/tasks", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const tasks = await storage.getVenueTasks(venueId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching venue tasks:", error);
    res.status(500).json({ error: "Failed to fetch venue tasks" });
  }
});

router.get("/tasks/all", isAdmin, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const tasks = await storage.getAllVenueTasks(userId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching all venue tasks:", error);
    res.status(500).json({ error: "Failed to fetch venue tasks" });
  }
});

router.post("/:id/tasks", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const parsed = insertVenueTaskSchema.parse({ ...req.body, venueId });
    const task = await storage.createVenueTask({ 
      ...parsed, 
      userId, 
      createdByUserId: userId,
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : undefined,
    });
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating venue task:", error);
    res.status(500).json({ error: "Failed to create venue task" });
  }
});

router.patch("/tasks/:taskId", isAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const updateData = { 
      ...req.body,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
    };
    const task = await storage.updateVenueTask(taskId, updateData);
    res.json(task);
  } catch (error) {
    console.error("Error updating venue task:", error);
    res.status(500).json({ error: "Failed to update venue task" });
  }
});

router.delete("/tasks/:taskId", isAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    await storage.deleteVenueTask(taskId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting venue task:", error);
    res.status(500).json({ error: "Failed to delete venue task" });
  }
});

// ============ SPONSOR CAMPAIGNS ============

router.get("/:id/sponsors", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const sponsors = await storage.getSponsorCampaignsByVenue(venueId);
    res.json(sponsors);
  } catch (error) {
    console.error("Error fetching sponsor campaigns:", error);
    res.status(500).json({ error: "Failed to fetch sponsor campaigns" });
  }
});

router.get("/sponsors/all", isAdmin, async (req: Request, res: Response) => {
  try {
    const sponsors = await storage.getAllSponsorCampaigns();
    res.json(sponsors);
  } catch (error) {
    console.error("Error fetching all sponsor campaigns:", error);
    res.status(500).json({ error: "Failed to fetch sponsor campaigns" });
  }
});

router.post("/:id/sponsors", isAdmin, async (req: Request, res: Response) => {
  try {
    const venueId = parseInt(req.params.id);
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    const parsed = insertSponsorCampaignSchema.parse({ ...req.body, venueId });
    const campaign = await storage.createSponsorCampaign({ 
      ...parsed, 
      createdByUserId: userId,
      startDate: parsed.startDate ? new Date(parsed.startDate) : undefined,
      endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    });
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Error creating sponsor campaign:", error);
    res.status(500).json({ error: "Failed to create sponsor campaign" });
  }
});

router.patch("/sponsors/:campaignId", isAdmin, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    const updateData = { 
      ...req.body,
      startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
      endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
    };
    const campaign = await storage.updateSponsorCampaign(campaignId, updateData);
    res.json(campaign);
  } catch (error) {
    console.error("Error updating sponsor campaign:", error);
    res.status(500).json({ error: "Failed to update sponsor campaign" });
  }
});

router.delete("/sponsors/:campaignId", isAdmin, async (req: Request, res: Response) => {
  try {
    const campaignId = parseInt(req.params.campaignId);
    await storage.deleteSponsorCampaign(campaignId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting sponsor campaign:", error);
    res.status(500).json({ error: "Failed to delete sponsor campaign" });
  }
});

router.post("/from-location", isAdmin, async (req: Request, res: Response) => {
  try {
    const { address, name } = req.body;
    if (!address) {
      return res.status(400).json({ error: "Address is required" });
    }
    const venue = await storage.createVenueFromLocation(address, name);
    res.status(201).json(venue);
  } catch (error) {
    console.error("Error creating venue from location:", error);
    res.status(500).json({ error: "Failed to create venue from location" });
  }
});

export default router;
