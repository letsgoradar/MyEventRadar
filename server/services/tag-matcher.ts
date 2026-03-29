import { db } from "../db";
import { eventTags, targetAudiences, seasonalThemes } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { EventTag, TargetAudience, SeasonalTheme } from "@shared/schema";

export interface TagMatchResult {
  eventTagIds: number[];
  targetAudienceIds: number[];
  seasonalThemeIds: number[];
  matchedTags: Array<{ id: number; name: string; group: string; parentCategory?: string | null }>;
  matchedAudiences: Array<{ id: number; name: string }>;
  matchedThemes: Array<{ id: number; name: string }>;
  suggestedCategory?: string; // First parentCategory found from matched tags
}

let cachedTags: EventTag[] | null = null;
let cachedAudiences: TargetAudience[] | null = null;
let cachedThemes: SeasonalTheme[] | null = null;
let cacheExpiry = 0;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadTagsCache(): Promise<void> {
  const now = Date.now();
  if (cachedTags && cachedAudiences && cachedThemes && now < cacheExpiry) {
    return;
  }

  const [tags, audiences, themes] = await Promise.all([
    db.select().from(eventTags).where(eq(eventTags.isActive, true)),
    db.select().from(targetAudiences).where(eq(targetAudiences.isActive, true)),
    db.select().from(seasonalThemes).where(eq(seasonalThemes.isActive, true)),
  ]);

  cachedTags = tags;
  cachedAudiences = audiences;
  cachedThemes = themes;
  cacheExpiry = now + CACHE_TTL_MS;
}

export function clearTagCache(): void {
  cachedTags = null;
  cachedAudiences = null;
  cachedThemes = null;
  cacheExpiry = 0;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9\s]/g, " ") // Replace non-alphanumeric with spaces
    .replace(/\s+/g, " ")
    .trim();
}

function matchKeywords(text: string, keywords: string[]): boolean {
  const normalizedText = normalizeText(text);
  
  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    // Check for word boundary match to avoid partial matches
    // e.g., "concert" should not match "concerto" unless "concerto" is also a keyword
    const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'i');
    if (wordBoundaryRegex.test(normalizedText)) {
      return true;
    }
  }
  
  return false;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function matchTags(
  title: string,
  description: string,
  eventDate?: Date
): Promise<TagMatchResult> {
  await loadTagsCache();

  if (!cachedTags || !cachedAudiences || !cachedThemes) {
    return {
      eventTagIds: [],
      targetAudienceIds: [],
      seasonalThemeIds: [],
      matchedTags: [],
      matchedAudiences: [],
      matchedThemes: [],
    };
  }

  const combinedText = `${title} ${description}`;
  
  // Match event tags
  const matchedTags = cachedTags.filter((tag) => 
    tag.keywords && tag.keywords.length > 0 && matchKeywords(combinedText, tag.keywords)
  );

  // Match target audiences
  const matchedAudiences = cachedAudiences.filter((audience) =>
    audience.keywords && audience.keywords.length > 0 && matchKeywords(combinedText, audience.keywords)
  );

  // Match seasonal themes (check both keywords and date range if applicable)
  const matchedThemes = cachedThemes.filter((theme) => {
    // First check keywords
    const keywordMatch = theme.keywords && theme.keywords.length > 0 && 
      matchKeywords(combinedText, theme.keywords);
    
    if (keywordMatch) return true;
    
    // If no keyword match and we have a date, check date range for fixed themes
    if (eventDate && !theme.isFloating && theme.startMonth && theme.endMonth) {
      const eventMonth = eventDate.getMonth() + 1;
      const eventDay = eventDate.getDate();
      
      // Handle year-spanning ranges (e.g., Dec 1 - Jan 6 for Christmas)
      if (theme.startMonth > theme.endMonth) {
        // Year-spanning: either in the end of the year or start of next
        const inEndOfYear = eventMonth > theme.startMonth || 
          (eventMonth === theme.startMonth && eventDay >= (theme.startDay || 1));
        const inStartOfYear = eventMonth < theme.endMonth ||
          (eventMonth === theme.endMonth && eventDay <= (theme.endDay || 31));
        return inEndOfYear || inStartOfYear;
      } else {
        // Normal range within same year
        const afterStart = eventMonth > theme.startMonth ||
          (eventMonth === theme.startMonth && eventDay >= (theme.startDay || 1));
        const beforeEnd = eventMonth < theme.endMonth ||
          (eventMonth === theme.endMonth && eventDay <= (theme.endDay || 31));
        return afterStart && beforeEnd;
      }
    }
    
    // For floating themes (Easter, Carnival), only keyword matching works
    return false;
  });

  // Derive suggested category from the first matched tag that has a parentCategory
  const suggestedCategory = matchedTags.find((t) => t.parentCategory)?.parentCategory ?? undefined;

  return {
    eventTagIds: matchedTags.map((t) => t.id),
    targetAudienceIds: matchedAudiences.map((a) => a.id),
    seasonalThemeIds: matchedThemes.map((t) => t.id),
    matchedTags: matchedTags.map((t) => ({ id: t.id, name: t.name, group: t.group, parentCategory: t.parentCategory })),
    matchedAudiences: matchedAudiences.map((a) => ({ id: a.id, name: a.name })),
    matchedThemes: matchedThemes.map((t) => ({ id: t.id, name: t.name })),
    suggestedCategory: suggestedCategory || undefined,
  };
}

export async function getTagsById(tagIds: number[]): Promise<EventTag[]> {
  await loadTagsCache();
  if (!cachedTags) return [];
  return cachedTags.filter((t) => tagIds.includes(t.id));
}

export async function getAudiencesById(audienceIds: number[]): Promise<TargetAudience[]> {
  await loadTagsCache();
  if (!cachedAudiences) return [];
  return cachedAudiences.filter((a) => audienceIds.includes(a.id));
}

export async function getThemesById(themeIds: number[]): Promise<SeasonalTheme[]> {
  await loadTagsCache();
  if (!cachedThemes) return [];
  return cachedThemes.filter((t) => themeIds.includes(t.id));
}
