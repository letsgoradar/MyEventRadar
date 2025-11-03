import { Router, type Request, Response } from "express";
import { generateUpcomingEventNotifications } from "../notification-scheduler";
import { isAuthenticated, isAdmin } from "../middleware/auth";

const router = Router();

// Manual trigger for notification generation (admin only)
router.post("/api/admin/generate-notifications", isAuthenticated, isAdmin, async (req: Request, res: Response) => {
  try {
    const result = await generateUpcomingEventNotifications();
    res.json(result);
  } catch (error) {
    console.error('Error in POST /api/admin/generate-notifications:', error);
    res.status(500).json({ message: "Internal server error", error: String(error) });
  }
});

export default router;
