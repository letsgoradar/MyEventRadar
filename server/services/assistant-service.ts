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

// Haal event context op voor de assistent
async function getEventContext(lat?: number, lng?: number, radius?: number): Promise<string> {
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
      .limit(20);
  } else {
    // Haal algemene upcoming events op
    eventList = await db.select()
      .from(events)
      .where(
        gte(events.startTime, new Date())
      )
      .orderBy(events.startTime)
      .limit(15);
  }
  
  if (eventList.length === 0) {
    return "Er zijn momenteel geen aankomende evenementen in de database.";
  }
  
  const eventSummaries = eventList.map(e => {
    const date = new Date(e.startTime).toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
    return `- "${e.title}" op ${date} in ${e.address || 'onbekende locatie'} (categorie: ${e.category})`;
  }).join('\n');
  
  return `Hier zijn de aankomende evenementen:\n${eventSummaries}`;
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
    // Haal event context op
    const eventContext = await getEventContext(lat, lng, radius);
    
    // Bouw de prompt
    const systemPrompt = `Je bent de letsgo radar assistent, een behulpzame AI die mensen helpt bij het vinden van leuke activiteiten en evenementen in hun buurt.

Je hebt toegang tot de volgende informatie over evenementen:
${eventContext}

Regels:
1. Beantwoord vragen over wat te doen, waar naartoe te gaan, of welke evenementen interessant zijn
2. Wees vriendelijk, enthousiast en behulpzaam
3. Als je een evenement aanbeveelt, noem dan de titel, datum en locatie
4. Als de vraag niet over evenementen gaat, probeer toch een relevant evenement te suggereren
5. Stel eventueel een vervolgvraag als je meer informatie nodig hebt
6. Houd je antwoorden beknopt maar informatief (max 150 woorden)
7. Antwoord altijd in het Nederlands`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Begrepen! Ik help je graag met het vinden van leuke activiteiten en evenementen." }] },
        { role: "user", parts: [{ text: question }] },
      ],
    });
    
    const assistantResponse = response.text || "Sorry, ik kon geen antwoord genereren.";
    
    // Haal resterende vragen op
    const { questionsRemaining } = await getWeeklyUsage(userId);
    
    return {
      success: true,
      response: assistantResponse,
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
