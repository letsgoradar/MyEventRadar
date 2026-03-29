import { storage } from "./storage";
import { CATEGORIES } from "@shared/schema";
import { addDays, addHours, setHours } from "date-fns";

// Verschillende steden in Nederland met hun coördinaten
const DUTCH_CITIES = [
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
  { name: "Rotterdam", lat: 51.9244, lng: 4.4777 },
  { name: "Den Haag", lat: 52.0705, lng: 4.3007 },
  { name: "Utrecht", lat: 52.0907, lng: 5.1214 },
  { name: "Eindhoven", lat: 51.4416, lng: 5.4697 },
  { name: "Groningen", lat: 53.2194, lng: 6.5665 },
  { name: "Tilburg", lat: 51.5719, lng: 5.0722 },
  { name: "Almere", lat: 52.3508, lng: 5.2647 },
  { name: "Breda", lat: 51.5719, lng: 4.7683 },
  { name: "Nijmegen", lat: 51.8426, lng: 5.8546 },
  { name: "Enschede", lat: 52.2215, lng: 6.8937 },
  { name: "Haarlem", lat: 52.3874, lng: 4.6462 },
  { name: "Arnhem", lat: 51.9851, lng: 5.8987 },
  { name: "Zaanstad", lat: 52.4537, lng: 4.8137 },
  { name: "Den Bosch", lat: 51.6988, lng: 5.3037 }
];

// Event titels per categorie
const EVENT_TITLES: Record<string, string[]> = {
  "Tentoonstelling": [
    "Kunstexpositie",
    "Fototentoonstelling",
    "Galerie opening",
    "Museum rondleiding"
  ],
  "Voorstelling": [
    "Theatervoorstelling",
    "Muziekconcert",
    "Dansvoorstelling",
    "Filmfestival",
    "Cabaretavond"
  ],
  "Activiteit": [
    "Voetbaltoernooi",
    "Tennis clinic",
    "Sportdag",
    "Yoga sessie",
    "Fietstochtje"
  ],
  "Stappen & Borrel": [
    "Buurtborrel",
    "BBQ & Muziek",
    "Zomerfeest",
    "Netwerkevent"
  ],
  "Markt & Beurs": [
    "Rommelmarkt",
    "Boerenmarkt",
    "Kerstmarkt",
    "Antiekbeurs"
  ],
  "Quiz & Spelletjes": [
    "Pubquiz",
    "Bordspelenavond",
    "Trivia night",
    "Game-avond"
  ],
  "Leren & Ontdekken": [
    "Workshop fotografie",
    "Lezing geschiedenis",
    "Cursus koken",
    "Tech meetup",
    "Masterclass"
  ],
  "Eten & Drinken": [
    "Proeverij",
    "Food festival",
    "Wijnproeverij",
    "Culinaire tour"
  ]
};

async function seedEvents() {
  const events = [];
  const now = new Date();

  // Genereer events voor de komende 30 dagen
  for (let i = 0; i < 60; i++) {
    const city = DUTCH_CITIES[Math.floor(Math.random() * DUTCH_CITIES.length)];
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    const titles = EVENT_TITLES[category];
    const title = `${titles[Math.floor(Math.random() * titles.length)]} ${city.name}`;

    // Random offset binnen 1km van stadscentrum
    const latOffset = (Math.random() - 0.5) * 0.02;
    const lngOffset = (Math.random() - 0.5) * 0.02;

    // Random dag in de komende 30 dagen
    const eventDate = addDays(now, Math.floor(Math.random() * 30));
    // Zet tijd tussen 9:00 en 21:00
    const startTime = setHours(eventDate, 9 + Math.floor(Math.random() * 12));
    // Event duurt 1-4 uur
    const endTime = addHours(startTime, 1 + Math.floor(Math.random() * 3));

    const isPaid = Math.random() > 0.6;
    const price = isPaid ? Math.floor(Math.random() * 30) + 5 : null;

    events.push({
      title,
      description: `${title} - Een geweldig evenement in ${city.name}. Kom langs en doe mee!`,
      location: {
        lat: city.lat + latOffset,
        lng: city.lng + lngOffset,
        notificationReach: Math.floor(Math.random() * 4) + 1,
      },
      startTime,
      endTime,
      category,
      isPaid,
      price,
      maxParticipants: Math.floor(Math.random() * 100) + 10,
      hostId: 1,
      recurrence: ['once', 'daily', 'weekly', 'monthly'][Math.floor(Math.random() * 4)],
      tags: [city.name.toLowerCase(), category.toLowerCase(), isPaid ? 'betaald' : 'gratis'],
    });
  }

  // Clear existing events (blocked in production)
  if (process.env.NODE_ENV === 'production') {
    console.error('ERROR: seed.ts cannot clear events in production environment');
    return;
  }
  await storage.clearEvents();

  // Create new events
  for (const event of events) {
    try {
      await storage.createEvent(event);
      console.log(`Created event: ${event.title}`);
    } catch (error) {
      console.error(`Error creating event ${event.title}:`, error);
    }
  }

  console.log("Test events created successfully!");
}

seedEvents().catch(console.error);