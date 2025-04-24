import { db } from '../db';
import { events } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Lijst met afbeelding URLs voor verschillende categorieën
const EVENT_IMAGES = {
  "Sport en spel": [
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1000",
    "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?q=80&w=1000",
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=1000",
    "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=1000",
    "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?q=80&w=1000"
  ],
  "Kunst en Cultuur": [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?q=80&w=1000",
    "https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?q=80&w=1000",
    "https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=1000",
    "https://images.unsplash.com/photo-1605729465641-d827512cad30?q=80&w=1000",
    "https://images.unsplash.com/photo-1515401131817-e1be5a9ee622?q=80&w=1000"
  ],
  "Educatie": [
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=1000",
    "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?q=80&w=1000",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1000",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1000",
    "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=1000"
  ],
  "Gezellig en Sociaal": [
    "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?q=80&w=1000",
    "https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=1000",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000",
    "https://images.unsplash.com/photo-1486299267070-83823f5448dd?q=80&w=1000",
    "https://images.unsplash.com/photo-1516476892398-bdcab4c8dab8?q=80&w=1000"
  ],
  "Muziek": [
    "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1000",
    "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1000",
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1000",
    "https://images.unsplash.com/photo-1501612780327-45045538702b?q=80&w=1000",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?q=80&w=1000"
  ],
  "Markten": [
    "https://images.unsplash.com/photo-1573246123716-6b1782bfc499?q=80&w=1000",
    "https://images.unsplash.com/photo-1534723452862-4c874018d66d?q=80&w=1000",
    "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?q=80&w=1000",
    "https://images.unsplash.com/photo-1501523460185-2aa5d2a0f981?q=80&w=1000",
    "https://images.unsplash.com/photo-1506484381205-f7945653044d?q=80&w=1000"
  ],
  "Technologie": [
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000",
    "https://images.unsplash.com/photo-1526666923127-b2970f64b422?q=80&w=1000",
    "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1000",
    "https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?q=80&w=1000"
  ],
  "Zakelijk": [
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=1000",
    "https://images.unsplash.com/photo-1573164713988-8665fc963095?q=80&w=1000",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?q=80&w=1000",
    "https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=1000",
    "https://images.unsplash.com/photo-1554774853-aae0a22c8aa4?q=80&w=1000"
  ],
  "Natuur en Gezondheid": [
    "https://images.unsplash.com/photo-1563299796-17596ed6b017?q=80&w=1000",
    "https://images.unsplash.com/photo-1532274402911-5a369e4c4bb5?q=80&w=1000",
    "https://images.unsplash.com/photo-1475666675596-cca2035b3d79?q=80&w=1000",
    "https://images.unsplash.com/photo-1511715282680-fbf93a50e721?q=80&w=1000",
    "https://images.unsplash.com/photo-1561154464-82e9adf32764?q=80&w=1000"
  ],
  "Community": [
    "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=1000",
    "https://images.unsplash.com/photo-1525026198548-4baa812f1183?q=80&w=1000",
    "https://images.unsplash.com/photo-1536421651038-e939d04c500c?q=80&w=1000",
    "https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=1000",
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=1000"
  ],
  "Anders": [
    "https://images.unsplash.com/photo-1576085898323-218337e3e43c?q=80&w=1000",
    "https://images.unsplash.com/photo-1546074177-31bfa593f731?q=80&w=1000",
    "https://images.unsplash.com/photo-1519750783826-e2420f4d687f?q=80&w=1000",
    "https://images.unsplash.com/photo-1483706600674-e0c87d3fe85b?q=80&w=1000",
    "https://images.unsplash.com/photo-1531058020387-3be344556be6?q=80&w=1000"
  ],
};

// Pokemon gerelateerde afbeeldingen
const POKEMON_IMAGES = [
  "https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?q=80&w=1000",
  "https://images.unsplash.com/photo-1614926037384-4159c33e2d20?q=80&w=1000",
  "https://images.unsplash.com/photo-1628968434441-d9c2941768db?q=80&w=1000",
  "https://images.unsplash.com/photo-1542779283-429940ce8336?q=80&w=1000",
  "https://images.unsplash.com/photo-1613771404520-1ec336a5f2a3?q=80&w=1000",
];

// Basketbal gerelateerde afbeeldingen
const BASKETBALL_IMAGES = [
  "https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=1000",
  "https://images.unsplash.com/photo-1519861531473-9200e868bedb?q=80&w=1000", 
  "https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=1000",
  "https://images.unsplash.com/photo-1505666287802-931a7e7d3f1a?q=80&w=1000",
  "https://images.unsplash.com/photo-1587384474964-3a06ce193ce0?q=80&w=1000",
];

// Voetbal gerelateerde afbeeldingen
const FOOTBALL_IMAGES = [
  "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?q=80&w=1000",
  "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?q=80&w=1000",
  "https://images.unsplash.com/photo-1540379708242-14a809b1e51c?q=80&w=1000",
  "https://images.unsplash.com/photo-1580675900059-358ee775c5ae?q=80&w=1000",
  "https://images.unsplash.com/photo-1562552052-296a49627146?q=80&w=1000",
];

// Helper functie om een willekeurige afbeelding te kiezen
function getRandomImage(category: string, title: string): string {
  if (title.toLowerCase().includes('pokemon')) {
    return POKEMON_IMAGES[Math.floor(Math.random() * POKEMON_IMAGES.length)];
  } else if (title.toLowerCase().includes('basketbal') || title.toLowerCase().includes('basket')) {
    return BASKETBALL_IMAGES[Math.floor(Math.random() * BASKETBALL_IMAGES.length)];
  } else if (title.toLowerCase().includes('voetbal')) {
    return FOOTBALL_IMAGES[Math.floor(Math.random() * FOOTBALL_IMAGES.length)];
  }
  
  // Anders, kies afbeelding op basis van categorie
  const categoryImages = EVENT_IMAGES[category as keyof typeof EVENT_IMAGES] || EVENT_IMAGES["Anders"];
  return categoryImages[Math.floor(Math.random() * categoryImages.length)];
}

async function addUniqueImagesToEvents() {
  try {
    // Haal alle events op
    const allEvents = await db.select().from(events);
    console.log(`Verwerken van ${allEvents.length} evenementen...`);
    
    // Loop door elk event en voeg unieke afbeeldingen toe
    for (const event of allEvents) {
      if (!event.imageUrl) {
        const imageUrl = getRandomImage(event.category, event.title);
        
        // Update het event met de nieuwe afbeelding
        await db.update(events)
          .set({ imageUrl })
          .where(eq(events.id, event.id));
        
        console.log(`Evenement '${event.title}' bijgewerkt met afbeelding: ${imageUrl}`);
      }
    }
    
    console.log('Alle evenementen zijn succesvol bijgewerkt met unieke afbeeldingen!');
  } catch (error) {
    console.error('Fout bij het bijwerken van afbeeldingen:', error);
  }
}

// Voer het script uit
addUniqueImagesToEvents()
  .then(() => {
    console.log('Script succesvol uitgevoerd!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script uitvoering mislukt:', error);
    process.exit(1);
  });