import { db } from '../db';
import { events, CATEGORIES } from '../../shared/schema';
import { addDays, addHours, setHours, setMinutes } from 'date-fns';

// Oss coordinates
const OSS_COORDINATES = { lat: 51.7650, lng: 5.5279 };

const EVENT_TITLES = {
  'Sport en spel': [
    'Voetbaltoernooi OSS', 
    'Schaaktoernooi Bibliotheek',
    'Fietspuzzeltocht',
    'Bootcamp in het park',
    'Zaalvoetbalcompetitie',
    'Tennis clinic',
    'Hardloopevenement',
    'Zwemwedstrijd De Warande',
    'Volleybaltoernooi'
  ],
  'Kunst en Cultuur': [
    'Expositie Museum Jan Cunen',
    'Theatervoorstelling De Lievekamp',
    'Kunstmarkt Centrum',
    'Muziekfestival Oss',
    'Open Podium TalentenTheater',
    'Filmavond Cultuurpodium',
    'Poëzieavond Bibliotheek',
    'Dansvoorstelling'
  ],
  'Gezellig en Sociaal': [
    'Buurtborrel Ruwaard',
    'Zomerfeest Centrum',
    'Netwerkborrel Ondernemers',
    'Spelletjesavond De Groene Engel',
    'BBQ & Muziek Festival',
    'Vrijdagmiddagborrel',
    'Buurtfeest Schadewijk',
    'Koopavond Centrum'
  ],
  'Leren en Ontdekken': [
    'Workshop Fotografie',
    'Lezing Stadsarchief',
    'Cursus Brabantse Keuken',
    'Masterclass Ondernemen',
    'Tech Meetup Pivot Park',
    'Taalcafé Bibliotheek',
    'Natuurexcursie Maashorst',
    'Historische Stadswandeling'
  ],
  'Vrijwilligerswerk en hulp': [
    'Buurtschoonmaak Oss-Zuid',
    'Voedselbank Actiedag',
    'NLdoet in Oss',
    'Repair Café',
    'Hulp Ouderen Dag',
    'Dierenasiel Open Dag',
    'Vrijwilligersmarkt',
    'Buurtpreventie Meeting'
  ]
};

const EVENT_DESCRIPTIONS = [
  'Een unieke gelegenheid om elkaar te ontmoeten in het hart van Oss. Met interessante activiteiten en natuurlijk volop ruimte voor gezelligheid.',
  'Geniet van een dag vol entertainment en heerlijk eten. Perfect voor het hele gezin!',
  'Ontdek de nieuwste ontwikkelingen in onze regio. Met lokale experts en ondernemers.',
  'Een gezellige dag uit voor jong en oud met activiteiten voor iedereen.',
  'Leer nieuwe vaardigheden van ervaren professionals uit de regio.',
  'Een spectaculaire show met lokale en regionale artiesten.',
  'Kom langs en laat je inspireren door de beste sprekers van dit moment.',
  'Een dag vol activiteiten en workshops. Voor ieder wat wils!',
  'Ervaar de Brabantse gezelligheid tijdens dit unieke evenement.',
  'Een leerzame ervaring met praktische tips van lokale experts.'
];

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomCoordinates(radiusKm: number) {
  // Convert radius from kilometers to degrees (approximate)
  const radiusLat = radiusKm / 111.32;
  const radiusLng = radiusKm / (111.32 * Math.cos(OSS_COORDINATES.lat * Math.PI / 180));

  const randomLat = OSS_COORDINATES.lat + (Math.random() - 0.5) * radiusLat * 2;
  const randomLng = OSS_COORDINATES.lng + (Math.random() - 0.5) * radiusLng * 2;

  return { lat: randomLat, lng: randomLng };
}

async function generateTestEvents(count: number) {
  const eventsToCreate = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const coords = getRandomCoordinates(50); // 50km radius around Oss
    const category = getRandomElement(CATEGORIES);
    const titleOptions = EVENT_TITLES[category];
    const titlePrefix = getRandomElement(titleOptions);
    const daysFromNow = getRandomInt(1, 30);
    const startTime = setMinutes(
      setHours(addDays(now, daysFromNow), getRandomInt(9, 20)),
      0
    );
    const duration = getRandomInt(1, 8);
    const endTime = addHours(startTime, duration);
    const isPaid = Math.random() < 0.3; // 30% chance of being paid

    // 30% chance of having a secondary category
    const hasSecondaryCategory = Math.random() < 0.3;
    const secondaryCategory = hasSecondaryCategory
      ? getRandomElement(CATEGORIES.filter(c => c !== category))
      : null;

    const event = {
      title: titlePrefix,
      description: getRandomElement(EVENT_DESCRIPTIONS),
      latitude: String(coords.lat),
      longitude: String(coords.lng),
      notificationReach: String(Math.random() * 4 + 1), // 1-5 km
      startTime,
      endTime,
      category,
      secondaryCategory,
      isPaid,
      price: isPaid ? String(getRandomInt(5, 50)) : null,
      maxParticipants: getRandomInt(20, 200),
      hostId: 1,
      recurrence: 'once',
      tags: []
    };

    eventsToCreate.push(event);
  }

  try {
    // Clear existing events first
    await db.delete(events);
    // Insert new events
    await db.insert(events).values(eventsToCreate);
    console.log(`Successfully generated ${count} test events around Oss`);
  } catch (error) {
    console.error('Error generating test events:', error);
  }
}

// Generate 200 test events
generateTestEvents(200);