import { db } from '../db';
import { events, CATEGORIES } from '../../shared/schema';
import { addDays, addHours, setHours, setMinutes } from 'date-fns';

// Nederlandse steden met coördinaten
const CENTER_COORDS = {
  lat: 52.3676,
  lng: 4.9041
};

const RADIUS_KM = 150;

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomCoordinates(centerLat: number, centerLng: number, radiusKm: number) {
  // Convert radius from kilometers to degrees (approximate)
  const radiusLat = radiusKm / 111.32;
  const radiusLng = radiusKm / (111.32 * Math.cos(centerLat * Math.PI / 180));

  const randomLat = centerLat + (Math.random() - 0.5) * radiusLat * 2;
  const randomLng = centerLng + (Math.random() - 0.5) * radiusLng * 2;

  return { lat: randomLat, lng: randomLng };
}

function generateRandomDescription(): string {
  const descriptions = [
    'Een geweldig evenement dat je niet mag missen! Met veel activiteiten en entertainment voor iedereen.',
    'Kom langs en geniet van deze unieke ervaring. Perfect voor het hele gezin.',
    'Een spannend evenement met veel verrassingen. Zorg dat je erbij bent!',
    'Een gezellige dag uit met vrienden en familie. Voor ieder wat wils.',
    'Ontdek nieuwe dingen en ontmoet interessante mensen op dit speciale evenement.'
  ];
  return getRandomElement(descriptions);
}

async function generateTestEvents(count: number) {
  const eventsToCreate = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const coords = getRandomCoordinates(CENTER_COORDS.lat, CENTER_COORDS.lng, RADIUS_KM);
    const category = getRandomElement(CATEGORIES);
    const daysFromNow = getRandomInt(1, 30);
    const startTime = setMinutes(
      setHours(addDays(now, daysFromNow), getRandomInt(9, 20)),
      0
    );
    const duration = getRandomInt(1, 8);
    const endTime = addHours(startTime, duration);
    const isPaid = Math.random() < 0.3; // 30% chance of being paid

    const event = {
      title: `${category} Event #${i + 1}`,
      description: generateRandomDescription(),
      latitude: coords.lat,
      longitude: coords.lng,
      notificationReach: Math.random() * 4 + 1, // 1-5 km
      startTime: startTime,
      endTime: endTime,
      category,
      isPaid: isPaid,
      price: isPaid ? getRandomInt(5, 50) : null,
      maxParticipants: getRandomInt(20, 200),
      hostId: 1,
      recurrence: 'once' as const,
    };

    eventsToCreate.push(event);
  }

  try {
    // Clear existing events first
    await db.delete(events);
    // Insert new events
    await db.insert(events).values(eventsToCreate);
    console.log(`Successfully generated ${count} test events`);
  } catch (error) {
    console.error('Error generating test events:', error);
  }
}

// Generate 150 test events
generateTestEvents(150);