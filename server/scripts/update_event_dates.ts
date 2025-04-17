import { db } from "../db";
import { events } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// Functie om een willekeurige datum te genereren tussen startDate en endDate
function getRandomDate(startDate: Date, endDate: Date): Date {
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();
  const randomTime = startTime + Math.random() * (endTime - startTime);
  return new Date(randomTime);
}

// Functie om een willekeurige duur in uren te genereren (tussen 1 en 8 uur)
function getRandomDuration(): number {
  return Math.floor(Math.random() * 7) + 1; // 1 tot 8 uur
}

async function updateEventDates() {
  try {
    console.log("Ophalen van alle events...");
    const allEvents = await db.select().from(events);
    console.log(`${allEvents.length} events gevonden.`);

    // Datumgrenzen instellen
    const startDate = new Date("2025-04-04");
    const endDate = new Date("2025-09-01");

    // Teller voor bijgewerkte events
    let updateCount = 0;

    // Loop door alle events en update hun datums
    for (const event of allEvents) {
      try {
        // Genereer een willekeurige start datum
        const newStartDate = getRandomDate(startDate, endDate);
        
        // Genereer een willekeurige duur
        const durationHours = getRandomDuration();
        
        // Bereken de einddatum op basis van de startdatum + duur
        const newEndDate = new Date(newStartDate.getTime() + durationHours * 60 * 60 * 1000);
        
        // Update het event in de database met sql raw 
        await db.execute(
          sql`UPDATE events SET 
            start_time = ${newStartDate.toISOString()}, 
            end_time = ${newEndDate.toISOString()} 
            WHERE id = ${event.id}`
        );
        
        updateCount++;
        
        // Log voortgang elke 50 updates
        if (updateCount % 50 === 0) {
          console.log(`${updateCount} events bijgewerkt...`);
        }
      } catch (err) {
        console.error(`Fout bij het bijwerken van event ${event.id}:`, err);
      }
    }

    console.log(`Klaar! ${updateCount} events zijn bijgewerkt met willekeurige datums.`);
  } catch (error) {
    console.error("Fout bij het bijwerken van event datums:", error);
  }
}

// Voer de functie uit
updateEventDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Onverwachte fout:", error);
    process.exit(1);
  });