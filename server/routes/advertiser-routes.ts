import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { db } from "../db";
import {
  eventPromotions, events, pricingConfig, businessAds, adImpressions, adCampaigns, adInteractions, walletTransactions,
  venues,
  advertiserProfiles, users,
  RADIUS_OPTIONS, PROMOTION_PERIOD, BUSINESS_CATEGORIES, PRICING_PRODUCT_TYPE, CAMPAIGN_PLACEMENTS,
  CAMPAIGN_DESTINATIONS, CAMPAIGN_STATUS, CAMPAIGN_PRICING_MODELS,
} from "@shared/schema";
import { eq, and, gte, lte, sql, desc, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { attachUser, isAuthenticated, isAdmin } from "../middleware/auth";
import { getStripe, isStripeConfigured } from "../stripe";
import { sendVerificationEmail } from "../services/email-service";
import rateLimit from "express-rate-limit";
import { ensureAdCampaignSchema } from "../migrations/ad-campaigns";

const impressionClickLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const id = req.params.id || req.body?.adId || "unknown";
    return `${ip}-${id}`;
  },
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

router.get("/active", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      lat: z.coerce.number(),
      lng: z.coerce.number(),
    });

    const { lat, lng } = schema.parse({
      lat: req.query.lat,
      lng: req.query.lng,
    });

    const now = new Date();

    await db.update(adCampaigns).set({ status: "expired" })
      .where(and(eq(adCampaigns.placement, "event_boost"), lte(adCampaigns.endDate, now),
        sql`${adCampaigns.status} IN ('active','scheduled')`));

    const activePromotions = await db
      .select({
        promotion: adCampaigns,
        event: events,
        profile: advertiserProfiles,
      })
      .from(adCampaigns)
      .innerJoin(events, eq(events.id, adCampaigns.eventId))
      .innerJoin(advertiserProfiles, eq(advertiserProfiles.id, adCampaigns.advertiserId))
      .where(
        and(
          eq(adCampaigns.placement, "event_boost"), eq(adCampaigns.status, "active"),
          eq(advertiserProfiles.status, "active"),
          lte(adCampaigns.startDate, now), gte(adCampaigns.endDate, now)
        )
      );

    const filtered = activePromotions.filter((row) => {
      if (row.promotion.pricingModel === "cpm" &&
          (row.promotion.spentCents >= row.promotion.budgetCents ||
           row.profile.balanceCents <= 0 ||
           (row.profile.monthlyBudgetCapCents !== null &&
            row.profile.currentMonthSpendCents >= row.profile.monthlyBudgetCapCents))) {
        return false;
      }
      if (row.promotion.targetRadiusKm === 0) return true;
      const eventLat = Number(row.event.latitude);
      const eventLng = Number(row.event.longitude);
      const distance = calculateDistance(lat, lng, eventLat, eventLng);
      return distance <= row.promotion.targetRadiusKm;
    });

    const shuffled = filtered.sort(() => Math.random() - 0.5);

    const result = shuffled.map((row) => ({
      ...row.event,
      promotionId: row.promotion.id,
      isPromoted: true,
       promotionPeriod: "campaign",
       promotionEndDate: row.promotion.endDate,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching active promotions:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors });
    } else {
      res.status(500).json({ message: "Internal server error" });
    }
  }
});

router.post("/:id(\\d+)/impression", impressionClickLimiter, async (req: Request, res: Response) => {
  try {
    const promotionId = parseInt(req.params.id);
    if (isNaN(promotionId)) {
      return res.status(400).json({ message: "Ongeldig promotie-ID" });
    }

    const { idempotencyKey, eventId } = z.object({
      idempotencyKey: z.string().max(200).optional(),
      eventId: z.number().optional(),
    }).parse(req.body || {});
    const result = await db.transaction(async (tx) => {
      const [campaign] = await tx.select().from(adCampaigns)
        .where(and(
          eq(adCampaigns.id, promotionId),
          eq(adCampaigns.placement, "event_boost"),
          eq(adCampaigns.status, "active")
        )).for("update");
      if (!campaign) return { success: false, reason: "campaign_not_found" };
      const inserted = await tx.insert(adInteractions).values({
        campaignId: campaign.id, type: "impression", eventId: eventId || null,
        idempotencyKey: idempotencyKey || null,
      }).onConflictDoNothing().returning({ id: adInteractions.id });
      if (!inserted.length) return { success: true, duplicate: true, campaignId: campaign.id };

      const costCents = campaign.pricingModel === "fixed"
        ? 0
        : Math.max(1, Math.round(campaign.unitPriceCents / 1000));
      const [profile] = await tx.select().from(advertiserProfiles)
        .where(eq(advertiserProfiles.id, campaign.advertiserId)).for("update");
      if (!profile || profile.balanceCents < costCents) {
        throw new Error("Onvoldoende wallet-saldo voor deze impressie");
      }
      if (campaign.spentCents + costCents > campaign.budgetCents) {
        await tx.update(adCampaigns).set({ status: "exhausted", updatedAt: new Date() })
          .where(eq(adCampaigns.id, campaign.id));
        throw new Error("Campagnebudget bereikt");
      }
      if (profile.monthlyBudgetCapCents &&
          profile.currentMonthSpendCents + costCents > profile.monthlyBudgetCapCents) {
        throw new Error("Maandbudget bereikt");
      }

      await tx.update(adInteractions).set({ costCents }).where(eq(adInteractions.id, inserted[0].id));
      await tx.update(adCampaigns).set({
        impressions: sql`${adCampaigns.impressions} + 1`,
        spentCents: sql`${adCampaigns.spentCents} + ${costCents}`,
      })
        .where(eq(adCampaigns.id, campaign.id));
      await tx.update(businessAds).set({
        impressions: sql`${businessAds.impressions} + 1`,
        totalSpendCents: sql`${businessAds.totalSpendCents} + ${costCents}`,
      }).where(eq(businessAds.id, campaign.adId));
      if (costCents > 0) {
        await tx.update(advertiserProfiles).set({
          balanceCents: sql`${advertiserProfiles.balanceCents} - ${costCents}`,
          currentMonthSpendCents: sql`${advertiserProfiles.currentMonthSpendCents} + ${costCents}`,
        }).where(eq(advertiserProfiles.id, profile.id));
      }
      return { success: true, campaignId: campaign.id };
    });
    res.json(result);
  } catch (error) {
    console.error("Error recording promotion impression:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/:id(\\d+)/click", impressionClickLimiter, async (req: Request, res: Response) => {
  try {
    const promotionId = parseInt(req.params.id);
    if (isNaN(promotionId)) {
      return res.status(400).json({ message: "Ongeldig promotie-ID" });
    }

    const [campaign] = await db.select().from(adCampaigns).where(eq(adCampaigns.id, promotionId));
    if (!campaign || campaign.placement !== "event_boost") {
      return res.status(404).json({ message: "Campagne niet gevonden" });
    }
    const { idempotencyKey, eventId } = z.object({
      idempotencyKey: z.string().max(200).optional(),
      eventId: z.number().optional(),
    }).parse(req.body || {});
    const result = await db.transaction(async (tx) => {
      const inserted = await tx.insert(adInteractions).values({
        campaignId: campaign.id, type: "click", eventId: eventId || null,
        idempotencyKey: idempotencyKey || null,
      }).onConflictDoNothing().returning({ id: adInteractions.id });
      if (!inserted.length) return { success: true, duplicate: true, campaignId: campaign.id };
      await tx.update(adCampaigns).set({ clicks: sql`${adCampaigns.clicks} + 1` })
        .where(eq(adCampaigns.id, campaign.id));
      return { success: true, campaignId: campaign.id };
    });
    res.json(result);
  } catch (error) {
    console.error("Error recording promotion click:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/pricing", async (_req: Request, res: Response) => {
  try {
    const pricing = await db
      .select()
      .from(pricingConfig)
      .where(eq(pricingConfig.productType, "event_promotion"));

    res.json(pricing);
  } catch (error) {
    console.error("Error fetching promotion pricing:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// ============ BUSINESS ADS SERVING ============

router.get("/ads/serve", attachUser, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      lat: z.coerce.number(),
      lng: z.coerce.number(),
      eventCategory: z.string().optional(),
      placement: z.enum(["banner", "external_interstitial"]).default("banner"),
    });

    const { lat, lng, eventCategory, placement } = schema.parse({
      lat: req.query.lat,
      lng: req.query.lng,
      eventCategory: req.query.eventCategory,
      placement: req.query.placement,
    });

    const activeAds = await db
      .select({
        campaign: adCampaigns,
        ad: businessAds,
        profile: advertiserProfiles,
      })
      .from(adCampaigns)
      .innerJoin(businessAds, eq(adCampaigns.adId, businessAds.id))
      .innerJoin(advertiserProfiles, eq(adCampaigns.advertiserId, advertiserProfiles.id))
      .where(
        and(
          eq(adCampaigns.status, "active"),
          eq(advertiserProfiles.status, "active"),
          eq(businessAds.status, "active"),
          eq(adCampaigns.placement, placement)
        )
      );

    const candidates = activeAds.filter(({ campaign, ad, profile }) => {
      if (campaign.startDate > new Date() || campaign.endDate < new Date() || campaign.spentCents >= campaign.budgetCents) return false;
      if (profile.balanceCents <= 0) return false;

      if (
        profile.monthlyBudgetCapCents &&
        profile.currentMonthSpendCents >= profile.monthlyBudgetCapCents
      ) return false;

      if (profile.latitude && profile.longitude) {
        const distance = calculateDistance(
          lat,
          lng,
          parseFloat(profile.latitude as string),
          parseFloat(profile.longitude as string)
        );
        if (campaign.targetRadiusKm > 0 && distance > campaign.targetRadiusKm) return false;
      }

      if (
        eventCategory &&
        campaign.targetCategories &&
        campaign.targetCategories.length > 0
      ) {
        if (!campaign.targetCategories.includes(eventCategory)) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      return res.json(null);
    }

    const totalWeight = candidates.reduce(
      (sum, c) => sum + c.profile.balanceCents,
      0
    );
    let random = Math.random() * totalWeight;
    let selected = candidates[0];
    for (const candidate of candidates) {
      random -= candidate.profile.balanceCents;
      if (random <= 0) {
        selected = candidate;
        break;
      }
    }

    res.json({
      id: selected.ad.id,
      campaignId: selected.campaign.id,
      title: selected.ad.title,
      description: selected.ad.description,
      imageUrl: selected.ad.imageUrl,
      ctaUrl: selected.campaign.destinationUrl || selected.ad.ctaUrl,
      ctaText: selected.ad.ctaText || "Meer info",
      companyName: selected.profile.companyName,
      logoUrl: selected.profile.logoUrl,
      cpmCents: selected.campaign.unitPriceCents,
    });
  } catch (error) {
    console.error("Error serving ad:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.errors });
    } else {
      res.status(500).json({ error: "Failed to serve ad" });
    }
  }
});

router.post("/ads/impression", impressionClickLimiter, attachUser, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      adId: z.number(),
      eventId: z.number().optional(),
      campaignId: z.number().optional(),
      idempotencyKey: z.string().max(200).optional(),
    });

    const { adId, eventId, campaignId, idempotencyKey } = schema.parse(req.body);
    const userId = (req as any).user?.id || null;

    const result = await db.transaction(async (tx) => {
      if (idempotencyKey) {
        const [existing] = await tx.select().from(adInteractions)
          .where(eq(adInteractions.idempotencyKey, idempotencyKey));
        if (existing) return { tracked: false, duplicate: true, campaignId: existing.campaignId, costCents: 0 };
      }

      const [campaign] = await tx.select().from(adCampaigns)
        .where(and(
          campaignId ? eq(adCampaigns.id, campaignId) : eq(adCampaigns.adId, adId),
          eq(adCampaigns.adId, adId),
          eq(adCampaigns.status, "active")
        ))
        .for("update");
      if (!campaign) return { tracked: false, reason: "no_active_campaign", campaignId: null, costCents: 0 };

      const [ad] = await tx.select().from(businessAds)
        .where(eq(businessAds.id, campaign.adId))
        .for("update");
      const [profile] = await tx.select().from(advertiserProfiles)
        .where(eq(advertiserProfiles.id, campaign.advertiserId))
        .for("update");
      if (!ad || !profile) return { tracked: false, reason: "campaign_not_deliverable", campaignId: campaign.id, costCents: 0 };

      const costCents = campaign.pricingModel === "fixed"
        ? 0
        : Math.max(1, Math.round(campaign.unitPriceCents / 1000));
      if (campaign.spentCents + costCents > campaign.budgetCents) {
        await tx.update(adCampaigns).set({ status: "exhausted" }).where(eq(adCampaigns.id, campaign.id));
        return { tracked: false, reason: "campaign_budget_reached", campaignId: campaign.id, costCents: 0 };
      }
      if (profile.balanceCents < costCents) {
        return { tracked: false, reason: "insufficient_balance", campaignId: campaign.id, costCents: 0 };
      }
      if (profile.monthlyBudgetCapCents &&
          profile.currentMonthSpendCents + costCents > profile.monthlyBudgetCapCents) {
        return { tracked: false, reason: "monthly_budget_cap_reached", campaignId: campaign.id, costCents: 0 };
      }

      await tx.insert(adInteractions).values({
        campaignId: campaign.id, type: "impression", userId, eventId: eventId || null,
        idempotencyKey: idempotencyKey || null, costCents,
      });
      await tx.insert(adImpressions).values({ adId, eventId: eventId || null, userId, costCents });
      await tx.update(adCampaigns).set({
        impressions: sql`${adCampaigns.impressions} + 1`,
        spentCents: sql`${adCampaigns.spentCents} + ${costCents}`,
      }).where(eq(adCampaigns.id, campaign.id));
      await tx.update(businessAds).set({
        impressions: sql`${businessAds.impressions} + 1`,
        totalSpendCents: sql`${businessAds.totalSpendCents} + ${costCents}`,
      }).where(eq(businessAds.id, adId));
      await tx.update(advertiserProfiles).set({
        balanceCents: sql`${advertiserProfiles.balanceCents} - ${costCents}`,
        currentMonthSpendCents: sql`${advertiserProfiles.currentMonthSpendCents} + ${costCents}`,
      }).where(eq(advertiserProfiles.id, profile.id));

      return { tracked: true, campaignId: campaign.id, costCents };
    });
    res.json(result);
  } catch (error) {
    console.error("Error tracking impression:", error);
    res.status(500).json({ error: "Failed to track impression" });
  }
});

router.post("/ads/click", impressionClickLimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      adId: z.number(),
      campaignId: z.number().optional(),
      idempotencyKey: z.string().max(200).optional(),
    });

    const { adId, campaignId, idempotencyKey } = schema.parse(req.body);
    if (!campaignId) return res.json({ tracked: false, reason: "campaign_id_required" });
    const result = await db.transaction(async (tx) => {
      const [campaign] = await tx.select().from(adCampaigns)
        .where(and(eq(adCampaigns.id, campaignId), eq(adCampaigns.adId, adId)));
      if (!campaign) return { tracked: false, reason: "campaign_not_found" };
      const inserted = await tx.insert(adInteractions).values({
        campaignId: campaign.id, type: "click", idempotencyKey: idempotencyKey || null,
      }).onConflictDoNothing().returning({ id: adInteractions.id });
      if (!inserted.length) return { tracked: false, duplicate: true, campaignId: campaign.id };
      await tx.update(adCampaigns).set({ clicks: sql`${adCampaigns.clicks} + 1` })
        .where(eq(adCampaigns.id, campaign.id));
      await tx.update(businessAds).set({ clicks: sql`${businessAds.clicks} + 1` })
        .where(eq(businessAds.id, adId));
      return { tracked: true, campaignId: campaign.id };
    });
    res.json(result);
  } catch (error) {
    console.error("Error tracking click:", error);
    res.status(500).json({ error: "Failed to track click" });
  }
});
router.post("/ads/close", impressionClickLimiter, async (req: Request, res: Response) => {
  try {
    const { campaignId, eventId, idempotencyKey } = z.object({ campaignId: z.number(), eventId: z.number().optional(), idempotencyKey: z.string().optional() }).parse(req.body);
    const result = await db.transaction(async (tx) => {
      const inserted = await tx.insert(adInteractions).values({
        campaignId, eventId: eventId || null, type: "close", idempotencyKey: idempotencyKey || null,
      }).onConflictDoNothing().returning({ id: adInteractions.id });
      if (!inserted.length) return { tracked: false, duplicate: true, campaignId };
      const updated = await tx.update(adCampaigns).set({ closes: sql`${adCampaigns.closes} + 1` })
        .where(eq(adCampaigns.id, campaignId)).returning({ id: adCampaigns.id });
      return updated.length
        ? { tracked: true, campaignId }
        : { tracked: false, reason: "campaign_not_found", campaignId };
    });
    res.json(result);
  } catch (e: any) { res.status(400).json({ error: e.message || "Close tracking failed" }); }
});

router.get("/ads/pricing", async (_req: Request, res: Response) => {
  try {
    const prices = await db
      .select()
      .from(pricingConfig)
      .where(
        and(
          eq(pricingConfig.productType, "business_ad"),
          eq(pricingConfig.isActive, true)
        )
      );

    const pricingMatrix = prices.map((p) => ({
      radiusKm: p.radiusKm,
      cpmCents: p.priceCents,
    }));

    res.json(pricingMatrix);
  } catch (error) {
    console.error("Error fetching ad pricing:", error);
    res.status(500).json({ error: "Failed to fetch pricing" });
  }
});

// ============ FULL PRICING MATRIX ============

router.get("/pricing-matrix", async (_req: Request, res: Response) => {
  try {
    const prices = await db.select().from(pricingConfig).where(eq(pricingConfig.isActive, true));
    const matrix: Record<string, Record<string, Record<string, number>>> = {
      event_promotion: {},
      business_ad: {},
    };
    for (const p of prices) {
      if (p.productType === "event_promotion" && p.period) {
        if (!matrix.event_promotion[String(p.radiusKm)]) matrix.event_promotion[String(p.radiusKm)] = {};
        matrix.event_promotion[String(p.radiusKm)][p.period] = p.priceCents;
      } else if (p.productType === "business_ad") {
        if (!matrix.business_ad[String(p.radiusKm)]) matrix.business_ad[String(p.radiusKm)] = {};
        matrix.business_ad[String(p.radiusKm)]["cpm"] = p.priceCents;
      }
    }
    res.json({ pricing: matrix, radiusOptions: RADIUS_OPTIONS, periods: PROMOTION_PERIOD });
  } catch (error) {
    console.error("Error fetching pricing matrix:", error);
    res.status(500).json({ error: "Kon prijzen niet ophalen" });
  }
});

// ============ EVENT SEARCH FOR PROMOTIONS ============

router.get("/events/search", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").trim();
    if (q.length < 2) {
      return res.json([]);
    }
    const searchPattern = `%${q}%`;
    const results = await db.select({
      id: events.id,
      title: events.title,
      startTime: events.startTime,
      address: events.address,
      imageUrl: events.imageUrl,
      category: events.category,
      latitude: events.latitude,
      longitude: events.longitude,
    }).from(events)
      .where(
        or(
          ilike(events.title, searchPattern),
          ilike(events.address, searchPattern),
        )
      )
      .orderBy(desc(events.startTime))
      .limit(20);
    res.json(results);
  } catch (error) {
    console.error("Error searching events:", error);
    res.status(500).json({ error: "Kon events niet zoeken" });
  }
});

// ============ ADVERTISER PROFILE ============

const registerAdvertiserSchema = z.object({
  companyName: z.string().min(2),
  description: z.string().optional(),
  logoUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  address: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  businessCategory: z.enum(BUSINESS_CATEGORIES),
  phone: z.string().optional(),
  verificationEmail: z.string().email("Voer een geldig e-mailadres in"),
});

router.post("/register", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = registerAdvertiserSchema.parse(req.body);
    const userId = (req.user as any).id;
    const existing = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Je hebt al een adverteerdersprofiel" });
    }
    const token = randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const [profile] = await db.insert(advertiserProfiles).values({
      userId,
      companyName: data.companyName,
      description: data.description,
      logoUrl: data.logoUrl,
      websiteUrl: data.websiteUrl,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      businessCategory: data.businessCategory,
      phone: data.phone,
      status: "pending",
      verificationEmail: data.verificationEmail,
      emailVerified: false,
      verificationToken: token,
      tokenExpiresAt: tokenExpires,
    }).returning();
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const requestBaseUrl = `${proto}://${req.get('host')}`;
    await sendVerificationEmail(data.verificationEmail, token, data.companyName, requestBaseUrl);
    res.json({ profile, verificationSent: true });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Registratie mislukt" });
  }
});

router.get("/verify/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const [profile] = await db.select().from(advertiserProfiles)
      .where(eq(advertiserProfiles.verificationToken, token));
    if (!profile) {
      return res.redirect("/advertiser/verify?status=invalid");
    }
    if (profile.tokenExpiresAt && new Date() > profile.tokenExpiresAt) {
      return res.redirect("/advertiser/verify?status=expired");
    }
    if (profile.emailVerified) {
      return res.redirect("/advertiser/verify?status=already");
    }
    await db.update(advertiserProfiles)
      .set({
        emailVerified: true,
        status: "active",
        verificationToken: null,
        tokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(advertiserProfiles.id, profile.id));
    return res.redirect("/advertiser/verify?status=success");
  } catch (error) {
    console.error("[Verify] Error:", error);
    return res.redirect("/advertiser/verify?status=error");
  }
});

router.post("/resend-verification", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles)
      .where(eq(advertiserProfiles.userId, userId));
    if (!profile) {
      return res.status(404).json({ error: "Geen adverteerdersprofiel gevonden" });
    }
    if (profile.emailVerified) {
      return res.status(400).json({ error: "E-mail is al geverifieerd" });
    }
    if (!profile.verificationEmail) {
      return res.status(400).json({ error: "Geen verificatie e-mailadres ingesteld" });
    }
    const token = randomUUID();
    const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(advertiserProfiles)
      .set({ verificationToken: token, tokenExpiresAt: tokenExpires, updatedAt: new Date() })
      .where(eq(advertiserProfiles.id, profile.id));
    const proto = req.get('x-forwarded-proto') || req.protocol || 'https';
    const requestBaseUrl = `${proto}://${req.get('host')}`;
    await sendVerificationEmail(profile.verificationEmail, token, profile.companyName, requestBaseUrl);
    res.json({ success: true, message: "Verificatie-e-mail opnieuw verzonden" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Kon verificatie niet opnieuw verzenden" });
  }
});

router.get("/profile", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(404).json({ error: "Geen adverteerdersprofiel gevonden" });
    res.json({ profile });
  } catch (error) {
    res.status(500).json({ error: "Kon profiel niet ophalen" });
  }
});

router.patch("/profile", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const data = registerAdvertiserSchema.partial().parse(req.body);
    const [updated] = await db.update(advertiserProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(advertiserProfiles.userId, userId))
      .returning();
    if (!updated) return res.status(404).json({ error: "Profiel niet gevonden" });
    res.json({ profile: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Update mislukt" });
  }
});

// ============ STRIPE PAYMENT ============

router.post("/setup-payment", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: "Betalingen zijn nog niet geconfigureerd" });
    }
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(404).json({ error: "Maak eerst een adverteerdersprofiel aan" });

    const stripe = getStripe();
    let customerId = profile.stripeCustomerId;
    if (!customerId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const customer = await stripe.customers.create({
        email: user?.email,
        name: profile.companyName,
        metadata: { advertiserProfileId: String(profile.id), userId: String(userId) },
      });
      customerId = customer.id;
      await db.update(advertiserProfiles)
        .set({ stripeCustomerId: customerId })
        .where(eq(advertiserProfiles.id, profile.id));
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card", "sepa_debit"],
      metadata: { advertiserProfileId: String(profile.id) },
    });
    res.json({ clientSecret: setupIntent.client_secret, customerId });
  } catch (error: any) {
    console.error("Error setting up payment:", error);
    res.status(500).json({ error: "Kon betaling niet instellen" });
  }
});

router.post("/top-up", isAuthenticated, async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: "Betalingen zijn nog niet geconfigureerd" });
    }
    const { amountCents } = z.object({ amountCents: z.number().min(1000) }).parse(req.body);
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile || !profile.stripeCustomerId) {
      return res.status(400).json({ error: "Stel eerst een betaalmethode in" });
    }
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents, currency: "eur", customer: profile.stripeCustomerId,
      metadata: { type: "top_up", advertiserProfileId: String(profile.id) },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Opwaardering mislukt" });
  }
});

router.get("/balance", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(404).json({ error: "Geen profiel gevonden" });
    res.json({
      balanceCents: profile.balanceCents,
      currentMonthSpendCents: profile.currentMonthSpendCents,
      monthlyBudgetCapCents: profile.monthlyBudgetCapCents,
    });
  } catch (error) {
    res.status(500).json({ error: "Kon saldo niet ophalen" });
  }
});

router.patch("/budget-cap", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { monthlyBudgetCapCents } = z.object({
      monthlyBudgetCapCents: z.number().min(0).nullable(),
    }).parse(req.body);
    const userId = (req.user as any).id;
    const [updated] = await db.update(advertiserProfiles)
      .set({ monthlyBudgetCapCents, updatedAt: new Date() })
      .where(eq(advertiserProfiles.userId, userId))
      .returning();
    res.json({ profile: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============ PROMOTION PURCHASE ============

const purchasePromotionSchema = z.object({
  eventId: z.number(),
  period: z.enum(["day", "week", "month"]),
  radiusKm: z.number().refine(v => [0, 5, 10, 15, 20, 25, 30, 40, 50].includes(v), "Ongeldige radius"),
});

router.post("/purchase", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = purchasePromotionSchema.parse(req.body);
    const userId = (req.user as any).id;

    const [advertiser] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!advertiser) {
      return res.status(403).json({ error: "Je hebt een bedrijfsaccount nodig om events te promoten" });
    }
    if (!advertiser.emailVerified) {
      return res.status(403).json({ error: "Verifieer eerst je bedrijfs e-mailadres voordat je events kunt promoten" });
    }

    const [price] = await db.select().from(pricingConfig)
      .where(and(
        eq(pricingConfig.productType, "event_promotion"),
        eq(pricingConfig.radiusKm, data.radiusKm),
        eq(pricingConfig.period, data.period),
        eq(pricingConfig.isActive, true),
      ));
    if (!price) return res.status(400).json({ error: "Geen prijs gevonden voor deze combinatie" });

    const [event] = await db.select().from(events).where(eq(events.id, data.eventId));
    if (!event) return res.status(404).json({ error: "Event niet gevonden" });

    const now = new Date();
    let endDate: Date;
    if (data.period === "day") endDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    else if (data.period === "week") endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    else endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const campaign = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(advertiserProfiles).where(eq(advertiserProfiles.id, advertiser.id)).for("update");
      if (!locked || locked.balanceCents < price.priceCents) throw new Error("Onvoldoende saldo in wallet");
      let [creative] = await tx.select().from(businessAds).where(and(eq(businessAds.advertiserId, advertiser.id), ilike(businessAds.title, event.title))).limit(1);
      if (!creative) [creative] = await tx.insert(businessAds).values({
        advertiserId: advertiser.id, title: event.title, description: "Event promotie",
        imageUrl: event.imageUrl, ctaUrl: event.externalUrl || `https://evenementenradar.nl/events/${event.id}`,
        targetRadiusKm: data.radiusKm, status: "pending", cpmCents: price.priceCents,
      }).returning();
      await tx.update(advertiserProfiles).set({ balanceCents: sql`${advertiserProfiles.balanceCents} - ${price.priceCents}` }).where(eq(advertiserProfiles.id, advertiser.id));
      await tx.insert(walletTransactions).values({ advertiserId: advertiser.id, amountCents: -price.priceCents, type: "event_boost_purchase", idempotencyKey: `event-boost-${userId}-${data.eventId}-${now.getTime()}` });
      const [created] = await tx.insert(adCampaigns).values({
        advertiserId: advertiser.id, adId: creative.id, name: `Event boost: ${event.title}`, placement: "event_boost",
        destinationType: "event", eventId: data.eventId, startDate: now, endDate, budgetCents: price.priceCents,
        targetRadiusKm: data.radiusKm, status: "active", pricingModel: "fixed", unitPriceCents: price.priceCents,
      }).returning();
      return created;
    });
    res.json({ campaign, paymentRequired: false });
  } catch (error: any) {
    console.error("Error purchasing promotion:", error);
    res.status(400).json({ error: error.message || "Aankoop mislukt" });
  }
});

// ============ BUSINESS AD CRUD (Advertiser) ============

const createBusinessAdSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaUrl: z.string().url(),
  ctaText: z.string().max(30).optional(),
  targetRadiusKm: z.number().refine(v => [0, 5, 10, 15, 20, 25, 30, 40, 50].includes(v)),
  targetCategories: z.array(z.string()).optional(),
});

router.post("/create-ad", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = createBusinessAdSchema.parse(req.body);
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(403).json({ error: "Maak eerst een adverteerdersprofiel aan" });

    const [cpmPrice] = await db.select().from(pricingConfig)
      .where(and(
        eq(pricingConfig.productType, "business_ad"),
        eq(pricingConfig.radiusKm, data.targetRadiusKm),
        eq(pricingConfig.isActive, true),
      ));
    if (!cpmPrice) return res.status(400).json({ error: "Geen CPM prijs gevonden voor deze radius" });

    const [ad] = await db.insert(businessAds).values({
      advertiserId: profile.id, title: data.title, description: data.description,
      imageUrl: data.imageUrl, ctaUrl: data.ctaUrl, ctaText: data.ctaText || "Meer info",
      targetRadiusKm: data.targetRadiusKm, targetCategories: data.targetCategories || null,
      cpmCents: cpmPrice.priceCents, status: "pending",
    }).returning();
    res.json({ ad });
  } catch (error: any) {
    res.status(400).json({ error: error.message || "Advertentie aanmaken mislukt" });
  }
});

router.get("/my-ads", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(404).json({ error: "Geen profiel gevonden" });
    const ads = await db.select().from(businessAds)
      .where(eq(businessAds.advertiserId, profile.id))
      .orderBy(desc(businessAds.createdAt));
    res.json({ ads });
  } catch (error) {
    res.status(500).json({ error: "Kon advertenties niet ophalen" });
  }
});

router.patch("/my-ads/:id/status", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const adId = parseInt(req.params.id);
    const { status } = z.object({ status: z.enum(["paused", "active"]) }).parse(req.body);
    const userId = (req.user as any).id;
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, userId));
    if (!profile) return res.status(403).json({ error: "Niet geautoriseerd" });
    const [ad] = await db.select().from(businessAds)
      .where(and(eq(businessAds.id, adId), eq(businessAds.advertiserId, profile.id)));
    if (!ad) return res.status(404).json({ error: "Advertentie niet gevonden" });
    if (status === "active" && ad.status !== "paused") {
      return res.status(403).json({ error: "Alleen goedgekeurde, gepauzeerde advertenties kunnen worden hervat" });
    }
    if (status === "paused" && ad.status !== "active") {
      return res.status(403).json({ error: "Alleen actieve advertenties kunnen worden gepauzeerd" });
    }
    const [updated] = await db.update(businessAds)
      .set({ status, updatedAt: new Date() }).where(eq(businessAds.id, adId)).returning();
    res.json({ ad: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/my-promotions", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any).id;
    const promotions = await db.select({ promotion: eventPromotions, event: events })
      .from(eventPromotions).innerJoin(events, eq(eventPromotions.eventId, events.id))
      .where(eq(eventPromotions.purchasedByUserId, userId))
      .orderBy(desc(eventPromotions.createdAt));
    res.json({ promotions });
  } catch (error) {
    res.status(500).json({ error: "Kon promoties niet ophalen" });
  }
});

// ============ CANONICAL CAMPAIGNS ============
const campaignBodySchema = z.object({
  name: z.string().min(1).max(120), adId: z.number().int().positive(),
  placement: z.enum(CAMPAIGN_PLACEMENTS), destinationType: z.enum(CAMPAIGN_DESTINATIONS),
  venueId: z.number().int().positive().optional(), eventId: z.number().int().positive().optional(),
  destinationUrl: z.string().url().optional(), startDate: z.coerce.date(), endDate: z.coerce.date(),
  budgetCents: z.number().int().positive(), targetRadiusKm: z.number().int().min(0).default(10),
  targetCategories: z.array(z.string()).optional(), status: z.enum(CAMPAIGN_STATUS).optional(),
  pricingModel: z.enum(CAMPAIGN_PRICING_MODELS).default("cpm"), unitPriceCents: z.number().int().nonnegative().optional(),
  advertiserId: z.number().int().positive().optional(),
});
async function campaignResults(where?: any) {
  const rows = await db.select({ campaign: adCampaigns, ad: businessAds, profile: advertiserProfiles,
    event: events, venue: venues }).from(adCampaigns)
    .innerJoin(businessAds, eq(adCampaigns.adId, businessAds.id))
    .innerJoin(advertiserProfiles, eq(adCampaigns.advertiserId, advertiserProfiles.id))
    .leftJoin(events, eq(adCampaigns.eventId, events.id)).leftJoin(venues, eq(adCampaigns.venueId, venues.id))
    .where(where || sql`true`).orderBy(desc(adCampaigns.createdAt));
  return rows;
}

router.get("/campaigns", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, (req.user as any).id));
    if (!profile) return res.status(404).json({ error: "Geen profiel gevonden" });
    res.json({ campaigns: await campaignResults(eq(adCampaigns.advertiserId, profile.id)) });
  } catch (e) { res.status(500).json({ error: "Kon campagnes niet ophalen" }); }
});
router.post("/campaigns", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const data = campaignBodySchema.parse(req.body);
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, (req.user as any).id));
    if (!profile || (data.advertiserId && data.advertiserId !== profile.id)) return res.status(403).json({ error: "Niet geautoriseerd" });
    const [ad] = await db.select().from(businessAds).where(and(eq(businessAds.id, data.adId), eq(businessAds.advertiserId, profile.id)));
    if (!ad) return res.status(404).json({ error: "Creative niet gevonden" });
    if (data.endDate <= data.startDate) return res.status(400).json({ error: "Einddatum moet na de startdatum liggen" });
    if (data.placement === "event_boost" && !data.eventId) return res.status(400).json({ error: "Kies een event voor een eventcampagne" });
    if (data.placement === "venue_spotlight" && !data.venueId) return res.status(400).json({ error: "Kies een locatie voor een locatiecampagne" });
    const [campaign] = await db.insert(adCampaigns).values({ ...data, advertiserId: profile.id,
      unitPriceCents: ad.cpmCents, status: data.status === "draft" ? "draft" : "pending" }).returning();
    res.status(201).json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message || "Campagne ongeldig" }); }
});
router.patch("/campaigns/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id), [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, (req.user as any).id));
    if (!profile) return res.status(403).json({ error: "Niet geautoriseerd" });
    const data = campaignBodySchema.partial().omit({ adId: true, advertiserId: true, status: true, unitPriceCents: true }).parse(req.body);
    const [campaign] = await db.update(adCampaigns).set({ ...data, updatedAt: new Date() })
      .where(and(eq(adCampaigns.id, id), eq(adCampaigns.advertiserId, profile.id))).returning();
    if (!campaign) return res.status(404).json({ error: "Campagne niet gevonden" });
    res.json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.patch("/campaigns/:id/status", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(["active", "paused"]) }).parse(req.body);
    const [profile] = await db.select().from(advertiserProfiles).where(eq(advertiserProfiles.userId, (req.user as any).id));
    const allowedCurrentStatus = status === "paused" ? "active" : "paused";
    const [campaign] = profile ? await db.update(adCampaigns).set({ status, updatedAt: new Date() })
      .where(and(
        eq(adCampaigns.id, Number(req.params.id)),
        eq(adCampaigns.advertiserId, profile.id),
        eq(adCampaigns.status, allowedCurrentStatus)
      )).returning() : [];
    if (!campaign) return res.status(404).json({ error: "Campagne niet gevonden" });
    res.json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.get("/admin/campaigns", isAdmin, async (req: Request, res: Response) => {
  try { const advertiserId = req.query.advertiserId ? Number(req.query.advertiserId) : undefined;
    res.json({ campaigns: await campaignResults(advertiserId ? eq(adCampaigns.advertiserId, advertiserId) : undefined) });
  } catch (e) { res.status(500).json({ error: "Kon campagnes niet ophalen" }); }
});
router.post("/admin/campaigns", isAdmin, async (req: Request, res: Response) => {
  try {
    const data = campaignBodySchema.extend({ advertiserId: z.number().int().positive() }).parse(req.body);
    const [ad] = await db.select().from(businessAds).where(and(eq(businessAds.id, data.adId), eq(businessAds.advertiserId, data.advertiserId)));
    if (!ad) return res.status(400).json({ error: "Creative hoort niet bij deze advertiser" });
    const [campaign] = await db.insert(adCampaigns).values({ ...data, unitPriceCents: data.unitPriceCents ?? ad.cpmCents, status: data.status ?? "draft" }).returning();
    res.status(201).json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.patch("/admin/campaigns/:id/status", isAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = z.object({ status: z.enum(CAMPAIGN_STATUS) }).parse(req.body);
    const campaign = await db.transaction(async (tx) => {
      const [updated] = await tx.update(adCampaigns).set({ status, updatedAt: new Date() })
        .where(eq(adCampaigns.id, Number(req.params.id))).returning();
      if (updated && status === "active") {
        await tx.update(businessAds).set({ status: "active", updatedAt: new Date() })
          .where(eq(businessAds.id, updated.adId));
      }
      return updated;
    });
    if (!campaign) return res.status(404).json({ error: "Campagne niet gevonden" });
    res.json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});
router.patch("/admin/campaigns/:id", isAdmin, async (req: Request, res: Response) => {
  try { const data = campaignBodySchema.partial().omit({ adId: true, advertiserId: true, status: true, unitPriceCents: true }).parse(req.body);
    const [campaign] = await db.update(adCampaigns).set({ ...data, updatedAt: new Date() }).where(eq(adCampaigns.id, Number(req.params.id))).returning();
    if (!campaign) return res.status(404).json({ error: "Campagne niet gevonden" }); res.json({ campaign });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ============ ADMIN ENDPOINTS ============

router.get("/admin/advertisers", isAdmin, async (_req: Request, res: Response) => {
  try {
    const profiles = await db.select({ profile: advertiserProfiles, user: users })
      .from(advertiserProfiles).innerJoin(users, eq(advertiserProfiles.userId, users.id))
      .orderBy(desc(advertiserProfiles.createdAt));
    res.json({ advertisers: profiles });
  } catch (error) {
    res.status(500).json({ error: "Kon adverteerders niet ophalen" });
  }
});

router.patch("/admin/advertisers/:id/status", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = z.object({ status: z.enum(["pending", "active", "suspended"]) }).parse(req.body);
    const [updated] = await db.update(advertiserProfiles)
      .set({ status, updatedAt: new Date() }).where(eq(advertiserProfiles.id, id)).returning();
    res.json({ profile: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/admin/all-ads", isAdmin, async (_req: Request, res: Response) => {
  try {
    const ads = await db.select({ ad: businessAds, profile: advertiserProfiles })
      .from(businessAds).innerJoin(advertiserProfiles, eq(businessAds.advertiserId, advertiserProfiles.id))
      .orderBy(desc(businessAds.createdAt));
    res.json({ ads });
  } catch (error) {
    res.status(500).json({ error: "Kon advertenties niet ophalen" });
  }
});

router.patch("/admin/ads/:id/status", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = z.object({ status: z.enum(["draft", "pending", "active", "paused", "exhausted"]) }).parse(req.body);
    const [updated] = await db.update(businessAds)
      .set({ status, updatedAt: new Date() }).where(eq(businessAds.id, id)).returning();
    res.json({ ad: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/admin/all-promotions", isAdmin, async (_req: Request, res: Response) => {
  try {
    const promotions = await db.select({ promotion: eventPromotions, event: events })
      .from(eventPromotions).innerJoin(events, eq(eventPromotions.eventId, events.id))
      .orderBy(desc(eventPromotions.createdAt));
    res.json({ promotions });
  } catch (error) {
    res.status(500).json({ error: "Kon promoties niet ophalen" });
  }
});

router.get("/admin/revenue", isAdmin, async (_req: Request, res: Response) => {
  try {
    const [adSpend] = await db.select({ total: sql<number>`COALESCE(SUM(${businessAds.totalSpendCents}), 0)` }).from(businessAds);
    const [promoRevenue] = await db.select({ total: sql<number>`COALESCE(SUM(${eventPromotions.priceCents}), 0)` }).from(eventPromotions);
    const [activeAds] = await db.select({ count: sql<number>`COUNT(*)` }).from(businessAds).where(eq(businessAds.status, "active"));
    const [activePromos] = await db.select({ count: sql<number>`COUNT(*)` }).from(eventPromotions).where(eq(eventPromotions.status, "active"));
    res.json({
      totalAdSpendCents: adSpend?.total || 0,
      totalPromotionRevenueCents: promoRevenue?.total || 0,
      activeAds: activeAds?.count || 0,
      activePromotions: activePromos?.count || 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Kon revenue niet ophalen" });
  }
});

router.get("/admin/pricing", isAdmin, async (_req: Request, res: Response) => {
  try {
    const prices = await db.select().from(pricingConfig).orderBy(pricingConfig.productType, pricingConfig.radiusKm);
    res.json({ pricing: prices });
  } catch (error) {
    res.status(500).json({ error: "Kon prijzen niet ophalen" });
  }
});

router.patch("/admin/pricing/:id", isAdmin, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { priceCents, isActive } = z.object({
      priceCents: z.number().min(0).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const updates: any = { updatedAt: new Date() };
    if (priceCents !== undefined) updates.priceCents = priceCents;
    if (isActive !== undefined) updates.isActive = isActive;
    const [updated] = await db.update(pricingConfig).set(updates).where(eq(pricingConfig.id, id)).returning();
    res.json({ pricing: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// ============ STRIPE WEBHOOK ============

router.post("/stripe-webhook", async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) return res.status(503).json({ error: "Stripe niet geconfigureerd" });
    const stripe = getStripe();
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured — rejecting request");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    if (!sig) {
      console.warn("[Stripe Webhook] Missing stripe-signature header — rejecting request");
      return res.status(400).json({ error: "Missing signature" });
    }
    let event;
    try {
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
      if (!rawBody) return res.status(400).json({ error: "Raw webhook body unavailable" });
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err: any) {
      console.error("[Stripe Webhook] Signature verification failed:", err.message);
      return res.status(400).json({ error: "Invalid signature" });
    }
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        if (pi.metadata?.type === "top_up") {
          const profileId = parseInt(pi.metadata.advertiserProfileId);
          await db.transaction(async (tx) => {
            await tx.select().from(advertiserProfiles)
              .where(eq(advertiserProfiles.id, profileId)).for("update");
            const inserted = await tx.insert(walletTransactions).values({
              advertiserId: profileId, amountCents: pi.amount, type: "stripe_top_up",
              idempotencyKey: `stripe-payment-intent:${pi.id}`, stripePaymentIntentId: pi.id,
            }).onConflictDoNothing().returning({ id: walletTransactions.id });
            if (inserted.length) {
              await tx.update(advertiserProfiles).set({
                balanceCents: sql`${advertiserProfiles.balanceCents} + ${pi.amount}`,
              }).where(eq(advertiserProfiles.id, profileId));
            }
          });
        } else if (pi.metadata?.type === "event_promotion") {
          await db.transaction(async (tx) => {
            const [promotion] = await tx.update(eventPromotions).set({ status: "active" })
              .where(eq(eventPromotions.stripePaymentIntentId, pi.id)).returning({ id: eventPromotions.id });
            if (promotion) {
              const [campaign] = await tx.update(adCampaigns).set({ status: "active", updatedAt: new Date() })
                .where(eq(adCampaigns.legacyEventPromotionId, promotion.id)).returning({ adId: adCampaigns.adId });
              if (campaign) {
                await tx.update(businessAds).set({ status: "active", updatedAt: new Date() })
                  .where(eq(businessAds.id, campaign.adId));
              }
            }
          });
        }
        break;
      }
      case "setup_intent.succeeded": {
        const si = event.data.object;
        const profileId = parseInt(si.metadata?.advertiserProfileId || "");
        if (!Number.isFinite(profileId)) break;
        await db.update(advertiserProfiles).set({
          status: "active",
        }).where(eq(advertiserProfiles.id, profileId));
        break;
      }
    }
    res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    res.status(400).json({ error: error.message });
  }
});

// ============ CRON TASKS ============

export async function expirePromotions() {
  try {
    await ensureAdCampaignSchema();
    const now = new Date();
    const result = await db
      .update(eventPromotions)
      .set({ status: "expired" })
      .where(
        and(
          eq(eventPromotions.status, "active"),
          lte(eventPromotions.endDate, now)
        )
      )
      .returning();
    await db.update(adCampaigns).set({ status: "expired", updatedAt: new Date() })
      .where(and(lte(adCampaigns.endDate, now), sql`${adCampaigns.status} IN ('active','scheduled')`));

    if (result.length > 0) {
      console.log(`[Promotions] ${result.length} promoties verlopen`);
    }
    return result.length;
  } catch (error) {
    console.error("[Promotions] Fout bij verlopen promoties:", error);
    return 0;
  }
}

export default router;
