import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "../db";
import { advertiserProfiles, promoterInvitations, users } from "@shared/schema";
import { and, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import { sendPromoterInvitationEmail } from "../services/email-service";

const router = Router();
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const input = z.object({ organizationName: z.string().trim().min(1).max(200), email: z.string().email().max(255) });

async function issueInvitation(req: Request, organizationName: string, email: string, resend = false) {
  const normalized = normalizeEmail(email);
  const now = new Date();
  const existing = await db.select().from(promoterInvitations)
    .where(and(eq(promoterInvitations.email, normalized), eq(promoterInvitations.status, "active")));
  const current = existing[0];
  if (current && current.expiresAt > now && !resend) return { invitation: current, token: undefined, idempotent: true };
  if (current) {
    await db.update(promoterInvitations).set({ status: current.expiresAt <= now ? "expired" : "revoked", revokedAt: now })
      .where(and(eq(promoterInvitations.id, current.id), eq(promoterInvitations.status, "active")));
  }
  const token = randomBytes(32).toString("base64url");
  const [invitation] = await db.insert(promoterInvitations).values({
    organizationName, email: normalized, tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  }).returning();
  const base = `${req.get("x-forwarded-proto") || req.protocol}://${req.get("host")}`;
  const sent = await sendPromoterInvitationEmail(normalized, organizationName, token, base);
  if (!sent) {
    await db.update(promoterInvitations)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(promoterInvitations.id, invitation.id));
    throw new Error("De uitnodigingsmail kon niet worden verzonden");
  }
  return { invitation, token, idempotent: false };
}

router.get("/", isAdmin, async (_req, res) => {
  const invitations = await db.select({
    id: promoterInvitations.id,
    organizationName: promoterInvitations.organizationName,
    email: promoterInvitations.email,
    status: promoterInvitations.status,
    expiresAt: promoterInvitations.expiresAt,
    acceptedAt: promoterInvitations.acceptedAt,
    createdAt: promoterInvitations.createdAt,
  }).from(promoterInvitations).orderBy(desc(promoterInvitations.createdAt));
  res.json({ invitations });
});

router.post("/", isAdmin, async (req, res) => {
  try {
    const data = input.parse(req.body);
    const result = await issueInvitation(req, data.organizationName, data.email);
    res.status(result.idempotent ? 200 : 201).json({ invitation: result.invitation, idempotent: result.idempotent });
  } catch (e: any) { res.status(400).json({ error: e.message || "Uitnodiging mislukt" }); }
});
router.post("/:id/resend", isAdmin, async (req, res) => {
  try {
    const [old] = await db.select().from(promoterInvitations).where(eq(promoterInvitations.id, Number(req.params.id)));
    if (!old) return res.status(404).json({ error: "Uitnodiging niet gevonden" });
    const result = await issueInvitation(req, old.organizationName, old.email, true);
    res.json({ invitation: result.invitation });
  } catch (e: any) { res.status(400).json({ error: e.message || "Opnieuw verzenden mislukt" }); }
});
router.post("/:id/revoke", isAdmin, async (req, res) => {
  const [updated] = await db.update(promoterInvitations).set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(promoterInvitations.id, Number(req.params.id)), eq(promoterInvitations.status, "active"))).returning();
  if (!updated) return res.status(404).json({ error: "Actieve uitnodiging niet gevonden" });
  res.json({ invitation: updated });
});

// Safe prefill: never return the token or any account credentials.
router.get("/accept", async (req, res) => {
  const token = String(req.query.token || "");
  const [invitation] = await db.select().from(promoterInvitations).where(and(eq(promoterInvitations.tokenHash, hashToken(token)), eq(promoterInvitations.status, "active")));
  if (!invitation || invitation.expiresAt < new Date()) return res.status(410).json({ error: "Uitnodiging is ongeldig of verlopen" });
  res.json({ organizationName: invitation.organizationName, email: invitation.email, expiresAt: invitation.expiresAt });
});

router.post("/accept", isAuthenticated, async (req, res) => {
  try {
    const token = z.string().min(20).parse(req.body.token);
    const user = req.user!;
    const profile = await db.transaction(async (tx) => {
      const [invitation] = await tx.update(promoterInvitations)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(and(
          eq(promoterInvitations.tokenHash, hashToken(token)),
          eq(promoterInvitations.status, "active"),
          gt(promoterInvitations.expiresAt, new Date()),
        ))
        .returning();
      if (!invitation) throw Object.assign(new Error("Uitnodiging is ongeldig of verlopen"), { httpStatus: 410 });
      if (normalizeEmail(String(user.email || "")) !== invitation.email) {
        throw Object.assign(new Error("Log in met het uitgenodigde e-mailadres"), { httpStatus: 403 });
      }
      const [existing] = await tx.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, user.id));
      if (existing) {
        throw Object.assign(new Error("Dit account heeft al een promotorprofiel"), { httpStatus: 409, code: "PROFILE_EXISTS" });
      }
      const [created] = await tx.insert(advertiserProfiles).values({
        userId: user.id, companyName: invitation.organizationName, businessCategory: "overig",
        verificationEmail: invitation.email, emailVerified: true, status: "active",
      }).returning();
      return created;
    });
    res.status(201).json({ profile });
  } catch (e: any) {
    const status = e?.httpStatus || (e?.code === "23505" ? 409 : 400);
    res.status(status).json({ error: e.message || "Uitnodiging accepteren mislukt", ...(e?.code === "PROFILE_EXISTS" ? { code: e.code } : {}) });
  }
});
export default router;