import { Router, Request, Response } from "express";
import { isAdmin } from "../middleware/auth";
import { storage } from "../storage";

const router = Router();

let lastBackupTimestamp: { events?: string; users?: string } = {};
let lastBackupCounts: { events?: number; users?: number } = {};

router.post("/events", isAdmin, async (req: Request, res: Response) => {
  try {
    const events = await storage.getAllEvents();
    lastBackupTimestamp.events = new Date().toISOString();
    lastBackupCounts.events = events.length;

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="events-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json({ exportedAt: lastBackupTimestamp.events, count: events.length, data: events });
  } catch (error) {
    console.error("Error exporting events backup:", error);
    res.status(500).json({ message: "Failed to export events" });
  }
});

router.post("/users", isAdmin, async (req: Request, res: Response) => {
  try {
    const users = await storage.getAllUsers();
    const usersWithoutPasswords = users.map((user) => {
      const { password, ...rest } = user;
      return rest;
    });
    lastBackupTimestamp.users = new Date().toISOString();
    lastBackupCounts.users = usersWithoutPasswords.length;

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="users-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json({
      exportedAt: lastBackupTimestamp.users,
      count: usersWithoutPasswords.length,
      data: usersWithoutPasswords,
    });
  } catch (error) {
    console.error("Error exporting users backup:", error);
    res.status(500).json({ message: "Failed to export users" });
  }
});

router.get("/status", isAdmin, async (req: Request, res: Response) => {
  try {
    const eventCount = await storage.getEventCount();
    const userCount = await storage.getUserCount();

    res.json({
      currentCounts: { events: eventCount, users: userCount },
      lastBackup: {
        events: lastBackupTimestamp.events
          ? { timestamp: lastBackupTimestamp.events, count: lastBackupCounts.events }
          : null,
        users: lastBackupTimestamp.users
          ? { timestamp: lastBackupTimestamp.users, count: lastBackupCounts.users }
          : null,
      },
    });
  } catch (error) {
    console.error("Error getting backup status:", error);
    res.status(500).json({ message: "Failed to get backup status" });
  }
});

export default router;
