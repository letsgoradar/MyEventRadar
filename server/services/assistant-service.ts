import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { aiAssistantUsage, users, events } from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

// Replit AI Integrations - Gemini toegang zonder eigen API key
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const FREE_QUESTIONS_PER_WEEK = 5;

// Bereken de maandag van de huidige week (start van de week)
function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Maandag
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// Check hoeveel vragen de gebruiker deze week al heeft gesteld
export async function getWeeklyUsage(userId: number): Promise<{
  questionsUsed: number;
  questionsRemaining: number;
  isPremium: boolean;
  weekStart: Date;
}> {
  const weekStart = getWeekStart();
  
  // Check of gebruiker premium is
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const isPremium = user?.isPremium ?? false;
  
  // Haal usage op voor deze week
  const [usage] = await db.select()
    .from(aiAssistantUsage)
    .where(
      and(
        eq(aiAssistantUsage.userId, userId),
        eq(aiAssistantUsage.weekStart, weekStart)
      )
    );
  
  const questionsUsed = usage?.questionCount ?? 0;
  const questionsRemaining = isPremium 
    ? Infinity 
    : Math.max(0, FREE_QUESTIONS_PER_WEEK - questionsUsed);
  
  return {
    questionsUsed,
    questionsRemaining,
    isPremium,
    weekStart,
  };
}

// Registreer een nieuwe vraag
export async function recordQuestion(userId: number): Promise<boolean> {
  const weekStart = getWeekStart();
  
  // Check limiet
  const { questionsRemaining, isPremium } = await getWeeklyUsage(userId);
  
  if (!isPremium && questionsRemaining <= 0) {
    return false; // Limiet bereikt
  }
  
  // Upsert de usage
  await db.insert(aiAssistantUsage)
    .values({
      userId,
      questionCount: 1,
      weekStart,
    })
    .onConflictDoUpdate({
      target: [aiAssistantUsage.userId, aiAssistantUsage.weekStart],
      set: {
        questionCount: sql`${aiAssistantUsage.questionCount} + 1`,
        updatedAt: new Date(),
      },
    });
  
  return true;
}

// Haal event context op voor de assistent (met event data voor ID lookup)
async function getEventContextWithData(lat?: number, lng?: number, radius?: number): Promise<{
  eventList: typeof events.$inferSelect[];
  eventContext: string;
}> {
  // Haal recente/nabije events op
  let eventList: typeof events.$inferSelect[] = [];
  
  if (lat && lng && radius) {
    // Haal events in de buurt op
    eventList = await db.select()
      .from(events)
      .where(
        gte(events.startTime, new Date())
      )
      .orderBy(events.startTime)
      .limit(25);
  } else {
    // Haal algemene upcoming events op
    eventList = await db.select()
      .from(events)
      .where(
        gte(events.startTime, new Date())
      )
      .orderBy(events.startTime)
      .limit(20);
  }
  
  if (eventList.length === 0) {
    return {
      eventList: [],
      eventContext: "Geen evenementen beschikbaar."
    };
  }
  
  // Maak compacte context met IDs voor de AI
  const eventSummaries = eventList.map(e => {
    const date = new Date(e.startTime).toLocaleDateString('nl-NL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    return `ID:${e.id} - "${e.title}" (${e.category}) op ${date}`;
  }).join('\n');
  
  return {
    eventList,
    eventContext: eventSummaries
  };
}

// Event data type for recommendations
interface RecommendedEvent {
  id: number;
  title: string;
  date: string;
  location: string;
  category: string;
  imageUrl: string | null;
}

// Genereer assistent response
export async function generateAssistantResponse(
  userId: number,
  question: string,
  lat?: number,
  lng?: number,
  radius?: number
): Promise<{
  success: boolean;
  response?: string;
  recommendedEvents?: RecommendedEvent[];
  error?: string;
  questionsRemaining?: number;
}> {
  // Check en registreer vraag
  const canAsk = await recordQuestion(userId);
  
  if (!canAsk) {
    const { isPremium } = await getWeeklyUsage(userId);
    return {
      success: false,
      error: isPremium 
        ? "Er is een fout opgetreden" 
        : "Je hebt je gratis vragen voor deze week opgebruikt. Upgrade naar Premium voor onbeperkte vragen!",
    };
  }
  
  try {
    // Haal events op en bereid context voor
    const { eventList, eventContext } = await getEventContextWithData(lat, lng, radius);
    
    // Bouw de prompt - KORT en met event IDs
    const systemPrompt = `Je bent de letsgo radar assistent. Help mensen leuke activiteiten te vinden.

BESCHIKBARE EVENEMENTEN (gebruik deze IDs om aan te bevelen):
${eventContext}

BELANGRIJKE REGELS:
1. Geef een KORT antwoord (max 2-3 zinnen)
2. Noem 1-3 relevante evenement IDs die passen bij de vraag
3. Antwoord ALLEEN in dit JSON formaat:
{
  "message": "Je korte antwoord hier",
  "eventIds": [123, 456, 789]
}

Kies de meest relevante events voor de vraag. Als niets past, kies dan populaire/recente events.
Antwoord altijd in het Nederlands.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: '{"message": "Begrepen!", "eventIds": []}' }] },
        { role: "user", parts: [{ text: question }] },
      ],
    });
    
    const rawResponse = response.text || '{"message": "Sorry, ik kon geen antwoord genereren.", "eventIds": []}';
    
    // Parse de JSON response
    let message = "Hier zijn enkele suggesties voor je!";
    let eventIds: number[] = [];
    
    try {
      // Probeer JSON te parsen (strip markdown code blocks indien aanwezig)
      const cleanJson = rawResponse.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      message = parsed.message || message;
      eventIds = Array.isArray(parsed.eventIds) ? parsed.eventIds.slice(0, 3) : [];
    } catch {
      // Als JSON parsing faalt, gebruik de raw text
      message = rawResponse;
    }
    
    // Haal de aanbevolen events op met alle benodigde data
    const recommendedEvents: RecommendedEvent[] = eventIds
      .map(id => eventList.find(e => e.id === id))
      .filter((e): e is typeof events.$inferSelect => e !== undefined)
      .map(e => ({
        id: e.id,
        title: e.title,
        date: new Date(e.startTime).toLocaleDateString('nl-NL', {
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }),
        location: e.address || 'Locatie onbekend',
        category: e.category,
        imageUrl: e.imageUrl,
      }));
    
    // Haal resterende vragen op
    const { questionsRemaining } = await getWeeklyUsage(userId);
    
    return {
      success: true,
      response: message,
      recommendedEvents,
      questionsRemaining: questionsRemaining === Infinity ? -1 : questionsRemaining,
    };
  } catch (error) {
    console.error("Assistant error:", error);
    return {
      success: false,
      error: "Er is een fout opgetreden bij het genereren van een antwoord. Probeer het later opnieuw.",
    };
  }
}
