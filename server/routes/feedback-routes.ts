import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { betaFeedback, users, FEEDBACK_TYPES, FEEDBACK_STATUS } from "@shared/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { isAdmin, attachUser } from "../middleware/auth";
import { sendFeedbackNotification } from "../services/email-service";

const router = Router();

const submitFeedbackSchema = z.object({
  pageUrl: z.string().min(1),
  feedbackType: z.enum(FEEDBACK_TYPES),
  message: z.string().min(5, "Feedback moet minimaal 5 tekens bevatten"),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  email: z.string().email().nullable().optional(),
});

router.post("/feedback", attachUser, async (req: Request, res: Response) => {
  try {
    const data = submitFeedbackSchema.parse(req.body);
    const userId = (req as any).user?.id || null;

    const [feedback] = await db
      .insert(betaFeedback)
      .values({
        userId,
        pageUrl: data.pageUrl,
        feedbackType: data.feedbackType,
        message: data.message,
        rating: data.rating ?? null,
        email: data.email ?? null,
        status: "nieuw",
      })
      .returning();

    let username: string | undefined;
    if (userId) {
      const [user] = await db.select({ name: users.name, username: users.username }).from(users).where(eq(users.id, userId));
      username = user?.name || user?.username || undefined;
    }

    sendFeedbackNotification({
      feedbackType: data.feedbackType,
      message: data.message,
      pageUrl: data.pageUrl,
      username,
      rating: data.rating,
      email: data.email,
    }).catch((err) => console.error("[Feedback] Email notificatie fout:", err));

    res.json({ success: true, id: feedback.id });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Ongeldige feedback data", details: error.errors });
    }
    console.error("[Feedback] Submit error:", error);
    res.status(500).json({ error: "Kon feedback niet opslaan" });
  }
});

router.get("/admin/feedback/stats", isAdmin, async (_req: Request, res: Response) => {
  try {
    const statusCounts = await db
      .select({
        status: betaFeedback.status,
        count: sql<number>`count(*)::int`,
      })
      .from(betaFeedback)
      .groupBy(betaFeedback.status);

    const typeCounts = await db
      .select({
        feedbackType: betaFeedback.feedbackType,
        count: sql<number>`count(*)::int`,
      })
      .from(betaFeedback)
      .groupBy(betaFeedback.feedbackType);

    res.json({ statusCounts, typeCounts });
  } catch (error) {
    console.error("[Feedback] Stats error:", error);
    res.status(500).json({ error: "Kon statistieken niet ophalen" });
  }
});

router.get("/admin/feedback", isAdmin, async (req: Request, res: Response) => {
  try {
    const { status, feedbackType } = req.query;

    const conditions = [];
    if (status && typeof status === "string" && FEEDBACK_STATUS.includes(status as any)) {
      conditions.push(eq(betaFeedback.status, status));
    }
    if (feedbackType && typeof feedbackType === "string" && FEEDBACK_TYPES.includes(feedbackType as any)) {
      conditions.push(eq(betaFeedback.feedbackType, feedbackType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: betaFeedback.id,
        userId: betaFeedback.userId,
        pageUrl: betaFeedback.pageUrl,
        feedbackType: betaFeedback.feedbackType,
        message: betaFeedback.message,
        rating: betaFeedback.rating,
        email: betaFeedback.email,
        status: betaFeedback.status,
        adminNotes: betaFeedback.adminNotes,
        createdAt: betaFeedback.createdAt,
        userName: users.name,
        userUsername: users.username,
      })
      .from(betaFeedback)
      .leftJoin(users, eq(betaFeedback.userId, users.id))
      .where(whereClause)
      .orderBy(desc(betaFeedback.createdAt));

    res.json(items);
  } catch (error) {
    console.error("[Feedback] List error:", error);
    res.status(500).json({ error: "Kon feedback niet ophalen" });
  }
});

router.patch("/admin/feedback/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Ongeldig ID" });

    const updateSchema = z.object({
      status: z.enum(FEEDBACK_STATUS).optional(),
      adminNotes: z.string().nullable().optional(),
    });

    const data = updateSchema.parse(req.body);

    const [updated] = await db
      .update(betaFeedback)
      .set(data)
      .where(eq(betaFeedback.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Feedback niet gevonden" });

    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Ongeldige data", details: error.errors });
    }
    console.error("[Feedback] Update error:", error);
    res.status(500).json({ error: "Kon feedback niet bijwerken" });
  }
});

export default router;
