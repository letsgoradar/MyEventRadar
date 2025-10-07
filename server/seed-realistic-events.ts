import { db } from './db';
import { events } from '@shared/schema';

// Nederlandse steden met coördinaten voor goede spreiding
const DUTCH_CITIES = [
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041, address: 'Amsterdam Centrum' },
  { name: 'Rotterdam', lat: 51.9225, lng: 4.47917, address: 'Rotterdam Centrum' },
  { name: 'Utrecht', lat: 52.0907, lng: 5.1214, address: 'Utrecht Centrum' },
  { name: 'Den Haag', lat: 52.0705, lng: 4.3007, address: 'Den Haag Centrum' },
  { name: 'Eindhoven', lat: 51.4416, lng: 5.4697, address: 'Eindhoven Centrum' },
  { name: 'Groningen', lat: 53.2194, lng: 6.5665, address: 'Groningen Centrum' },
  { name: 'Tilburg', lat: 51.5555, lng: 5.0913, address: 'Tilburg Centrum' },
  { name: 'Almere', lat: 52.3508, lng: 5.2647, address: 'Almere Centrum' },
  { name: 'Breda', lat: 51.5719, lng: 4.7683, address: 'Breda Centrum' },
  { name: 'Nijmegen', lat: 51.8126, lng: 5.8372, address: 'Nijmegen Centrum' },
  { name: 'Enschede', lat: 52.2215, lng: 6.8937, address: 'Enschede Centrum' },
  { name: 'Haarlem', lat: 52.3874, lng: 4.6462, address: 'Haarlem Centrum' },
  { name: 'Arnhem', lat: 51.9851, lng: 5.8987, address: 'Arnhem Centrum' },
  { name: 'Zaandam', lat: 52.4389, lng: 4.8258, address: 'Zaandam Centrum' },
  { name: 'Amersfoort', lat: 52.1561, lng: 5.3878, address: 'Amersfoort Centrum' },
  { name: 'Apeldoorn', lat: 52.2112, lng: 5.9699, address: 'Apeldoorn Centrum' },
  { name: 'Zwolle', lat: 52.5168, lng: 6.0830, address: 'Zwolle Centrum' },
  { name: 'Leiden', lat: 52.1601, lng: 4.4970, address: 'Leiden Centrum' },
  { name: 'Maastricht', lat: 50.8514, lng: 5.6910, address: 'Maastricht Centrum' },
  { name: 'Delft', lat: 52.0116, lng: 4.3571, address: 'Delft Centrum' },
];

// Realistische events met passende afbeeldingen
const REALISTIC_EVENTS = [
  // Sport en spel
  {
    title: 'Voetbaltoernooi Jeugd',
    description: 'Jaarlijks jeugdvoetbaltoernooi voor kinderen van 8-12 jaar. Teams uit heel de regio komen strijden om de felbegeerde beker. Gezellige sportdag met gratis lunch voor alle deelnemers.',
    category: 'Sport en spel',
    imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=600&fit=crop',
    tags: ['voetbal', 'jeugd', 'sport', 'competitie'],
    isPaid: false,
    maxParticipants: 100,
  },
  {
    title: 'Hardloopgroep Beginners',
    description: 'Wekelijkse hardloopsessie voor beginners. We starten rustig en bouwen samen op naar 5km. Professionele begeleiding en leuke groepssfeer. Iedereen welkom!',
    category: 'Sport en spel',
    imageUrl: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=600&fit=crop',
    tags: ['hardlopen', 'fitness', 'beginners', 'groep'],
    isPaid: false,
    maxParticipants: 25,
    recurrence: 'weekly',
  },
  {
    title: 'Yoga in het Park',
    description: 'Ontspannende yogasessie in de buitenlucht. Geschikt voor alle niveaus. Neem je eigen mat mee en geniet van een uur rust en beweging in de natuur.',
    category: 'Sport en spel',
    imageUrl: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop',
    tags: ['yoga', 'buiten', 'ontspanning', 'gezondheid'],
    isPaid: true,
    price: 8.50,
    maxParticipants: 30,
  },
  {
    title: 'Tennis Clinic voor Volwassenen',
    description: 'Leer de basis van tennis of verbeter je techniek. 2 uur intensieve training onder begeleiding van gediplomeerde trainer. Rackets beschikbaar.',
    category: 'Sport en spel',
    imageUrl: 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=600&fit=crop',
    tags: ['tennis', 'training', 'volwassenen', 'sport'],
    isPaid: true,
    price: 25.00,
    maxParticipants: 12,
  },
  {
    title: 'Schaaktoernooi Open',
    description: 'Maandelijks schaaktoernooi voor alle niveaus. Van beginner tot gevorderd, iedereen is welkom. Prijzen voor de top 3. Koffie en thee aanwezig.',
    category: 'Sport en spel',
    imageUrl: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=600&fit=crop',
    tags: ['schaken', 'denksport', 'toernooi', 'prijzen'],
    isPaid: false,
    maxParticipants: 40,
  },

  // Kunst en Cultuur
  {
    title: 'Live Jazz Avond',
    description: 'Geniet van een avond vol swingend jazz met lokale muzikanten. Intieme setting, goede sfeer en geweldige muziek. Bar aanwezig.',
    category: 'Kunst en Cultuur',
    imageUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800&h=600&fit=crop',
    tags: ['muziek', 'jazz', 'live', 'concert'],
    isPaid: true,
    price: 15.00,
    maxParticipants: 80,
  },
  {
    title: 'Schilderworkshop Aquarel',
    description: 'Leer de basis van aquarelschilderen. Alle materialen worden verstrekt. Geen ervaring nodig. Neem je creativiteit mee en ga naar huis met je eigen kunstwerk!',
    category: 'Kunst en Cultuur',
    imageUrl: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&fit=crop',
    tags: ['schilderen', 'workshop', 'kunst', 'creatief'],
    isPaid: true,
    price: 35.00,
    maxParticipants: 15,
  },
  {
    title: 'Fotografie Wandeling',
    description: 'Fotografeer de mooiste plekjes van de stad. Professionele fotograaf deelt tips en tricks. Neem je camera mee en ontdek de stad door een lens.',
    category: 'Kunst en Cultuur',
    imageUrl: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=600&fit=crop',
    tags: ['fotografie', 'wandelen', 'cursus', 'stad'],
    isPaid: false,
    maxParticipants: 20,
  },
  {
    title: 'Theater Voorstelling Amateurgezelschap',
    description: 'Lokaal amateurtheatergezelschap presenteert een hilarische komedie. 2 uur vermaak gegarandeerd. Voorverkoop aanbevolen.',
    category: 'Kunst en Cultuur',
    imageUrl: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=600&fit=crop',
    tags: ['theater', 'komedie', 'voorstelling', 'cultuur'],
    isPaid: true,
    price: 12.50,
    maxParticipants: 150,
  },
  {
    title: 'Open Podium Muzikanten',
    description: 'Open podium voor alle muzikanten. Deel je talent, probeer nieuw materiaal of kom gewoon luisteren. Gezellige sfeer, supportive publiek.',
    category: 'Kunst en Cultuur',
    imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=600&fit=crop',
    tags: ['muziek', 'open podium', 'live', 'talent'],
    isPaid: false,
    maxParticipants: 60,
  },

  // Gezellig en Sociaal
  {
    title: 'Buurtbarbecue',
    description: 'Gezellige buurtbarbecue voor jong en oud. Leer je buren kennen, geniet van lekker eten en gezelligheid. Iedereen neemt iets mee te delen.',
    category: 'Gezellig en Sociaal',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop',
    tags: ['buurt', 'barbecue', 'gezellig', 'eten'],
    isPaid: false,
    maxParticipants: 50,
  },
  {
    title: 'Spelletjesavond Volwassenen',
    description: 'Gezellige avond vol bordspellen en kaartspellen. Van strategy tot party games. Drankjes en snacks aanwezig. Nieuwe mensen ontmoeten!',
    category: 'Gezellig en Sociaal',
    imageUrl: 'https://images.unsplash.com/photo-1606503825508-882b1e5d08b4?w=800&h=600&fit=crop',
    tags: ['spellen', 'gezellig', 'sociaal', 'volwassenen'],
    isPaid: true,
    price: 5.00,
    maxParticipants: 30,
  },
  {
    title: 'Koffieochtend 50+',
    description: 'Wekelijkse koffieochtend voor senioren. Gezellig samenzijn, nieuwtjes uitwisselen en nieuwe vrienden maken. Gratis koffie en gebak.',
    category: 'Gezellig en Sociaal',
    imageUrl: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop',
    tags: ['senioren', 'koffie', 'sociaal', 'gezellig'],
    isPaid: false,
    maxParticipants: 40,
    recurrence: 'weekly',
  },
  {
    title: 'Picknick in het Park',
    description: 'Gemeenschappelijke picknick voor gezinnen. Neem je picknickmand mee en geniet van een middag buiten. Spelletjes voor kinderen georganiseerd.',
    category: 'Gezellig en Sociaal',
    imageUrl: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800&h=600&fit=crop',
    tags: ['picknick', 'gezinnen', 'buiten', 'kinderen'],
    isPaid: false,
    maxParticipants: 100,
  },
  {
    title: 'Wijnproeverij',
    description: 'Proef 6 heerlijke wijnen onder begeleiding van een sommelier. Leer over verschillende druivensoorten en regio\'s. Kaas en hapjes inbegrepen.',
    category: 'Gezellig en Sociaal',
    imageUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=600&fit=crop',
    tags: ['wijn', 'proeven', 'culinair', 'volwassenen'],
    isPaid: true,
    price: 28.50,
    maxParticipants: 25,
  },

  // Leren en Ontdekken
  {
    title: 'Workshop Programmeren Kinderen',
    description: 'Leer kinderen de basis van programmeren met Scratch. Leuke, interactieve sessie waar ze hun eigen game maken. Voor kinderen 8-14 jaar.',
    category: 'Leren en Ontdekken',
    imageUrl: 'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&h=600&fit=crop',
    tags: ['programmeren', 'kinderen', 'technologie', 'educatie'],
    isPaid: true,
    price: 20.00,
    maxParticipants: 16,
  },
  {
    title: 'Natuurwandeling met Gids',
    description: 'Ontdek de lokale flora en fauna met een ervaren natuurgids. 2 uur wandelen en leren over de natuur om je heen. Geschikt voor alle leeftijden.',
    category: 'Leren en Ontdekken',
    imageUrl: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop',
    tags: ['natuur', 'wandelen', 'educatie', 'buiten'],
    isPaid: false,
    maxParticipants: 25,
  },
  {
    title: 'Cursus Eerste Hulp',
    description: 'Basiscursus Eerste Hulp. Leer levensreddende technieken in noodsituaties. Inclusief reanimatietraining en officieel certificaat.',
    category: 'Leren en Ontdekken',
    imageUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&h=600&fit=crop',
    tags: ['EHBO', 'cursus', 'veiligheid', 'certificaat'],
    isPaid: true,
    price: 75.00,
    maxParticipants: 12,
  },
  {
    title: 'Lezing Duurzaamheid',
    description: 'Inspirerende lezing over duurzaam leven. Praktische tips om je CO2 footprint te verkleinen. Vragenronde en gratis e-book voor deelnemers.',
    category: 'Leren en Ontdekken',
    imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&h=600&fit=crop',
    tags: ['duurzaamheid', 'lezing', 'milieu', 'educatie'],
    isPaid: false,
    maxParticipants: 80,
  },
  {
    title: 'Workshops Historische Stadswandeling',
    description: 'Verken de rijke geschiedenis van de stad met lokale historicus. Fascinerende verhalen en verborgen plekjes. 2,5 uur cultuur en geschiedenis.',
    category: 'Leren en Ontdekken',
    imageUrl: 'https://images.unsplash.com/photo-1464983308776-8f2b13912e4a?w=800&h=600&fit=crop',
    tags: ['geschiedenis', 'wandeling', 'cultuur', 'educatie'],
    isPaid: true,
    price: 12.50,
    maxParticipants: 30,
  },

  // Vrijwilligerswerk en hulp
  {
    title: 'Opruimactie Stadpark',
    description: 'Help mee het stadpark schoon te maken. Samen maken we onze groene ruimte weer mooi. Materialen worden verstrekt, enthousiasme breng je zelf mee!',
    category: 'Vrijwilligerswerk en hulp',
    imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&h=600&fit=crop',
    tags: ['opruimen', 'vrijwilligers', 'milieu', 'park'],
    isPaid: false,
    maxParticipants: 50,
  },
  {
    title: 'Voedselbank Sorteren',
    description: 'Vrijwilligers gezocht voor het sorteren van donaties bij de voedselbank. 3 uur waar je echt het verschil maakt. Gezellige groep vrijwilligers.',
    category: 'Vrijwilligerswerk en hulp',
    imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop',
    tags: ['voedselbank', 'vrijwilligers', 'helpen', 'sociaal'],
    isPaid: false,
    maxParticipants: 20,
  },
  {
    title: 'Taalmaatjes voor Nieuwkomers',
    description: 'Word taalmaatje en help nieuwkomers met Nederlands oefenen. 1-op-1 of kleine groepjes. Maak het verschil en leer zelf ook nieuwe mensen kennen.',
    category: 'Vrijwilligerswerk en hulp',
    imageUrl: 'https://images.unsplash.com/photo-1491841573634-28140fc7ced7?w=800&h=600&fit=crop',
    tags: ['taal', 'nieuwkomers', 'vrijwilligers', 'integratie'],
    isPaid: false,
    maxParticipants: 15,
    recurrence: 'weekly',
  },
  {
    title: 'Repair Café',
    description: 'Breng je kapotte spullen mee en leer ze te repareren met hulp van vakkundige vrijwilligers. Duurzaam, gezellig en leerzaam!',
    category: 'Vrijwilligerswerk en hulp',
    imageUrl: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=800&h=600&fit=crop',
    tags: ['repareren', 'duurzaam', 'vrijwilligers', 'klusjes'],
    isPaid: false,
    maxParticipants: 35,
  },
  {
    title: 'Bomen Planten Actie',
    description: 'Help mee bij het planten van 100 nieuwe bomen in ons stadswoud. Fysiek werk, maar ontzettend zinvol. Handschoenen en gereedschap aanwezig.',
    category: 'Vrijwilligerswerk en hulp',
    imageUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop',
    tags: ['bomen', 'natuur', 'vrijwilligers', 'groen'],
    isPaid: false,
    maxParticipants: 60,
  },
];

// Functie om een random datum te genereren in de komende 3 maanden
function getRandomFutureDate(): Date {
  const now = new Date();
  const daysInFuture = Math.floor(Math.random() * 90); // 0-90 dagen vooruit
  const hours = 8 + Math.floor(Math.random() * 13); // 8-20 uur
  const minutes = Math.random() > 0.5 ? 0 : 30; // 00 of 30 minuten
  
  const date = new Date(now);
  date.setDate(date.getDate() + daysInFuture);
  date.setHours(hours, minutes, 0, 0);
  
  return date;
}

// Functie om eindtijd te berekenen (1-4 uur na start)
function getEndTime(startTime: Date): Date {
  const duration = 1 + Math.floor(Math.random() * 3); // 1-4 uur
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + duration);
  return endTime;
}

async function seedRealisticEvents() {
  try {
    console.log('🌱 Starting realistic event seeding...');

    // Verwijder alle bestaande events eerst (optioneel - commentaar weg om te behouden)
    // await db.delete(events);
    // console.log('🗑️  Cleared existing events');

    const eventsToCreate = [];

    // Maak 3-4 events per stad voor goede spreiding
    for (const city of DUTCH_CITIES) {
      // Kies random 3-4 events voor deze stad
      const numEvents = 3 + Math.floor(Math.random() * 2); // 3 of 4 events
      const selectedEvents = [...REALISTIC_EVENTS]
        .sort(() => Math.random() - 0.5)
        .slice(0, numEvents);

      for (const eventTemplate of selectedEvents) {
        const startTime = getRandomFutureDate();
        const endTime = getEndTime(startTime);

        eventsToCreate.push({
          title: eventTemplate.title,
          description: eventTemplate.description,
          latitude: city.lat.toString(),
          longitude: city.lng.toString(),
          address: `${city.address}, ${city.name}`,
          notificationReach: '2.5', // 2.5 km radius
          startTime,
          endTime,
          category: eventTemplate.category,
          secondaryCategory: null,
          isPaid: eventTemplate.isPaid || false,
          price: eventTemplate.price?.toString() || null,
          maxParticipants: eventTemplate.maxParticipants || null,
          hostId: 1, // testuser als host
          recurrence: eventTemplate.recurrence || 'once',
          tags: eventTemplate.tags || [],
          imageUrl: eventTemplate.imageUrl || null,
          isHighlighted: false,
          highlightStartDate: null,
          highlightEndDate: null,
          highlightPriority: 0,
        });
      }
    }

    // Voeg alle events toe
    await db.insert(events).values(eventsToCreate);

    console.log(`✅ Successfully seeded ${eventsToCreate.length} realistic events!`);
    console.log(`📍 Events spread across ${DUTCH_CITIES.length} Dutch cities`);
    console.log(`🎨 ${REALISTIC_EVENTS.length} different event types used`);
    
    // Toon statistieken per categorie
    const categoryStats: Record<string, number> = {};
    eventsToCreate.forEach(event => {
      categoryStats[event.category] = (categoryStats[event.category] || 0) + 1;
    });
    
    console.log('\n📊 Events per category:');
    Object.entries(categoryStats).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} events`);
    });

  } catch (error) {
    console.error('❌ Error seeding events:', error);
    throw error;
  }
}

// Run de seeding functie
seedRealisticEvents()
  .then(() => {
    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed:', error);
    process.exit(1);
  });
