import { db } from "../server/db";
import { events } from "@shared/schema";
import { lt } from "drizzle-orm";

const dutchCities = [
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "Rotterdam", lat: 51.9225, lng: 4.47917 },
  { name: "Den Haag", lat: 52.0705, lng: 4.3007 },
  { name: "Utrecht", lat: 52.0907, lng: 5.1214 },
  { name: "Eindhoven", lat: 51.4416, lng: 5.4697 },
  { name: "Groningen", lat: 53.2194, lng: 6.5665 },
  { name: "Tilburg", lat: 51.5555, lng: 5.0913 },
  { name: "Almere", lat: 52.3508, lng: 5.2647 },
  { name: "Breda", lat: 51.5719, lng: 4.7683 },
  { name: "Nijmegen", lat: 51.8426, lng: 5.8527 },
  { name: "Enschede", lat: 52.2215, lng: 6.8937 },
  { name: "Apeldoorn", lat: 52.2112, lng: 5.9699 },
  { name: "Haarlem", lat: 52.3874, lng: 4.6462 },
  { name: "Arnhem", lat: 51.9851, lng: 5.8987 },
  { name: "Maastricht", lat: 50.8514, lng: 5.6910 },
  { name: "Leiden", lat: 52.1601, lng: 4.4970 },
  { name: "Zwolle", lat: 52.5168, lng: 6.0830 },
];

const eventTemplates = [
  { title: "Yoga in het Park", category: "Sport en spel", description: "Geniet van een ontspannende yoga sessie in de openlucht." },
  { title: "Kunstmarkt", category: "Kunst en Cultuur", description: "Ontdek lokale kunstenaars en hun prachtige creaties." },
  { title: "Buurtkoffie", category: "Gezellig en Sociaal", description: "Kom gezellig koffie drinken en nieuwe mensen ontmoeten." },
  { title: "Workshop Fotografie", category: "Leren en Ontdekken", description: "Leer de basis van fotografie van een professional." },
  { title: "Speeltuin Opknappen", category: "Vrijwilligerswerk en hulp", description: "Help mee om onze lokale speeltuin op te knappen." },
  { title: "Voetbaltoernooi", category: "Sport en spel", description: "Doe mee aan ons gezellige voetbaltoernooi voor alle leeftijden." },
  { title: "Live Muziek Avond", category: "Kunst en Cultuur", description: "Geniet van live optredens van lokale bands." },
  { title: "Buurtbarbecue", category: "Gezellig en Sociaal", description: "Kom gezellig barbecueën met de buurt." },
  { title: "Taalcafé", category: "Leren en Ontdekken", description: "Oefen je Nederlands in een ontspannen setting." },
  { title: "Voedselbankactie", category: "Vrijwilligerswerk en hulp", description: "Help mee met het inpakken van voedselpakketten." },
];

const unsplashImages = [
  "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=400&h=300&fit=crop&auto=format",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=300&fit=crop&auto=format",
];

async function addTestEvents() {
  console.log('Deleting old events...');
  const today = new Date();
  await db.delete(events).where(lt(events.startTime, today));
  console.log('Old events deleted');
  
  const newEvents = [];
  
  for (const city of dutchCities) {
    const numEvents = Math.floor(Math.random() * 4) + 2;
    
    for (let i = 0; i < numEvents; i++) {
      const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)];
      const daysFromNow = Math.floor(Math.random() * 60);
      const startTime = new Date();
      startTime.setDate(startTime.getDate() + daysFromNow);
      startTime.setHours(10 + Math.floor(Math.random() * 12), 0, 0, 0);
      
      const endTime = new Date(startTime);
      endTime.setHours(startTime.getHours() + 2);
      
      newEvents.push({
        title: `${template.title} ${city.name}`,
        description: template.description,
        latitude: (city.lat + (Math.random() - 0.5) * 0.02).toString(),
        longitude: (city.lng + (Math.random() - 0.5) * 0.02).toString(),
        address: `${city.name}, Nederland`,
        notificationReach: "2.5",
        startTime,
        endTime,
        category: template.category,
        isPaid: Math.random() > 0.7,
        price: Math.random() > 0.7 ? (Math.floor(Math.random() * 30) + 5).toString() : null,
        maxParticipants: Math.floor(Math.random() * 100) + 20,
        hostId: 1,
        recurrence: "once",
        tags: [],
        imageUrl: unsplashImages[Math.floor(Math.random() * unsplashImages.length)],
        isHighlighted: Math.random() > 0.85,
        highlightPriority: Math.floor(Math.random() * 5),
      });
    }
  }
  
  await db.insert(events).values(newEvents);
  console.log(`Added ${newEvents.length} new test events`);
  process.exit(0);
}

addTestEvents().catch(console.error);
