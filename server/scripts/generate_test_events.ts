import { db } from '../db';
import { events } from '../../shared/schema';
import { addDays, addHours, setHours, setMinutes } from 'date-fns';

// Nederlandse steden met coördinaten
const DUTCH_CITIES = [
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Rotterdam', lat: 51.9225, lng: 4.4792 },
  { name: 'Den Haag', lat: 52.0705, lng: 4.3007 },
  { name: 'Utrecht', lat: 52.0907, lng: 5.1214 },
  { name: 'Eindhoven', lat: 51.4416, lng: 5.4697 },
  { name: 'Groningen', lat: 53.2194, lng: 6.5665 },
  { name: 'Tilburg', lat: 51.5719, lng: 5.0722 },
  { name: 'Almere', lat: 52.3508, lng: 5.2647 },
  { name: 'Breda', lat: 51.5719, lng: 4.7683 },
  { name: 'Nijmegen', lat: 51.8426, lng: 5.8546 }
];

const EVENT_CATEGORIES = [
  'festival',
  'food',
  'culture',
  'sports',
  'market',
  'education',
  'music',
  'technology',
  'gaming',
  'health',
  'nature'
];

const EVENT_TITLES = [
  'Workshop',
  'Festival',
  'Markt',
  'Concert',
  'Conferentie',
  'Expositie',
  'Beurs',
  'Voorstelling',
  'Wedstrijd',
  'Training'
];

const EVENT_DESCRIPTIONS = [
  'Een unieke gelegenheid om nieuwe mensen te ontmoeten en te netwerken.',
  'Geniet van een dag vol entertainment, muziek en heerlijk eten.',
  'Ontdek de nieuwste trends en innovaties in de industrie.',
  'Een gezellige dag uit voor het hele gezin.',
  'Leer nieuwe vaardigheden van experts in het veld.',
  'Een spectaculaire show die je niet mag missen!',
  'Kom langs en laat je inspireren door de beste sprekers.',
  'Een dag vol activiteiten en workshops voor jong en oud.',
  'Ervaar de magie van live optredens en shows.',
  'Een leerzame ervaring met praktische tips en tricks.'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomCoordinates(baseLocation: { lat: number, lng: number }, radiusKm: number) {
  // Convert radius from kilometers to degrees (approximate)
  const radiusLat = radiusKm / 111.32;
  const radiusLng = radiusKm / (111.32 * Math.cos(baseLocation.lat * Math.PI / 180));

  const randomLat = baseLocation.lat + (Math.random() - 0.5) * radiusLat * 2;
  const randomLng = baseLocation.lng + (Math.random() - 0.5) * radiusLng * 2;

  return { lat: randomLat, lng: randomLng };
}

async function generateTestEvents(count: number) {
  const events = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const city = getRandomElement(DUTCH_CITIES);
    const coords = getRandomCoordinates(city, 20); // 20km radius around city center
    const category = getRandomElement(EVENT_CATEGORIES);
    const titlePrefix = getRandomElement(EVENT_TITLES);
    const daysFromNow = getRandomInt(1, 30);
    const startTime = setMinutes(
      setHours(addDays(now, daysFromNow), getRandomInt(9, 20)),
      0
    );
    const duration = getRandomInt(1, 8);
    const endTime = addHours(startTime, duration);
    const isPaid = Math.random() < 0.3; // 30% chance of being paid

    const event = {
      title: `${titlePrefix} ${category}`,
      description: getRandomElement(EVENT_DESCRIPTIONS),
      latitude: coords.lat.toString(),
      longitude: coords.lng.toString(),
      notification_reach: (Math.random() * 4 + 1).toString(), // 1-5 km
      start_time: startTime,
      end_time: endTime,
      category,
      subcategory: '',
      is_paid: isPaid,
      price: isPaid ? getRandomInt(5, 50) : null,
      max_participants: getRandomInt(20, 200),
      host_id: 1,
      recurrence: 'once'
    };

    events.push(event);
  }

  try {
    await db.insert(events).into('events');
    console.log(`Successfully generated ${count} test events`);
  } catch (error) {
    console.error('Error generating test events:', error);
  }
}

// Generate 500 test events
generateTestEvents(500);
