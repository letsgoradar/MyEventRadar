import { db } from "./db";
import { eventTags, targetAudiences, seasonalThemes } from "@shared/schema";

// Helper to create slug from name
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Event Tags data based on agreed list
const EVENT_TAGS_DATA = [
  // Muziek
  { name: "Livemuziek", icon: "MicVocal", group: "Muziek", keywords: ["live muziek", "livemuziek", "live band", "live optreden"] },
  { name: "Concert", icon: "Music", group: "Muziek", keywords: ["concert", "concerten", "concertcyclus", "optreden"] },
  { name: "Tribute/Coverband", icon: "Disc", group: "Muziek", keywords: ["tribute", "coverband", "undercover", "roadshow"] },
  { name: "Jazz", icon: "Piano", group: "Muziek", keywords: ["jazz", "jazzcafé", "jazzclub", "swing"] },
  { name: "Klassiek", icon: "Music2", group: "Muziek", keywords: ["klassiek", "klassieke muziek", "orkest", "symfonieorkest", "baroque", "koor"] },
  { name: "DJ/Electronic", icon: "Headphones", group: "Muziek", keywords: ["dj", "electronic", "techno", "house", "dance", "club"] },
  { name: "Open Mic", icon: "Mic", group: "Muziek", keywords: ["open mic", "open podium", "jam session", "jam"] },
  { name: "Luistersessie", icon: "AudioLines", group: "Muziek", keywords: ["luistersessie", "listening session", "listening"] },
  
  // Podiumkunsten
  { name: "Theater", icon: "Theater", group: "Podiumkunsten", keywords: ["theater", "theatervoorstelling", "toneelstuk", "theatercollege"] },
  { name: "Musical", icon: "Sparkles", group: "Podiumkunsten", keywords: ["musical", "musicals"] },
  { name: "Cabaret", icon: "Laugh", group: "Podiumkunsten", keywords: ["cabaret", "cabaretvoorstelling", "cabaretier"] },
  { name: "Standup Comedy", icon: "Mic2", group: "Podiumkunsten", keywords: ["stand-up", "standup", "comedy", "comedian", "comedyclub"] },
  { name: "Kindertheater", icon: "Baby", group: "Podiumkunsten", keywords: ["kindertheater", "kindervoorstelling", "jeugdtheater", "poppenkast"] },
  { name: "Circus", icon: "Tent", group: "Podiumkunsten", keywords: ["circus", "circusvoorstelling", "acrobatiek", "clown"] },
  
  // Film
  { name: "Film", icon: "Film", group: "Film", keywords: ["film", "bioscoop", "pathé", "cinema", "filmavond", "movienight"] },
  
  // Kunst & Exposities
  { name: "Expositie", icon: "Frame", group: "Kunst", keywords: ["expositie", "tentoonstelling", "expo", "museum", "galerie"] },
  { name: "Design", icon: "Palette", group: "Kunst", keywords: ["design", "vormgeving", "industrieel design"] },
  { name: "Kunstfestival", icon: "Paintbrush", group: "Kunst", keywords: ["kunstfestival", "kunst & cultuur", "kunstmarkt"] },
  
  // Eten & Drinken
  { name: "Culinair Event", icon: "UtensilsCrossed", group: "Eten & Drinken", keywords: ["culinair", "eten", "foodtruck", "smullen", "koken"] },
  { name: "Proeverij", icon: "Wine", group: "Eten & Drinken", keywords: ["proeverij", "bierproeverij", "wijnproeverij", "whisky", "tasting"] },
  { name: "Diner", icon: "ChefHat", group: "Eten & Drinken", keywords: ["diner", "walking dinner", "restaurant", "gastronomisch"] },
  { name: "Foodfestival", icon: "Soup", group: "Eten & Drinken", keywords: ["foodfestival", "food festival", "streetfood", "food truck"] },
  
  // Leren & Ontdekken
  { name: "Workshop", icon: "Wrench", group: "Leren", keywords: ["workshop", "workshops", "doe-mee", "creatief", "maken", "bouwen", "schilderen"] },
  { name: "Cursus", icon: "BookOpen", group: "Leren", keywords: ["cursus", "cursussen", "lessen", "training", "abonnement"] },
  { name: "Lezing", icon: "Presentation", group: "Leren", keywords: ["lezing", "lezingen", "lecture", "presentatie", "spreker"] },
  { name: "Meditatie/Retraite", icon: "Flower2", group: "Leren", keywords: ["meditatie", "retraite", "yoga", "mindfulness", "zen", "bardo"] },
  { name: "Rondleiding", icon: "Landmark", group: "Leren", keywords: ["rondleiding", "tour", "guided tour", "gids", "bezoek", "excursie"] },
  
  // Feest & Uitgaan
  { name: "Festival", icon: "Ticket", group: "Feest", keywords: ["festival", "festivals", "festijn"] },
  { name: "Feest", icon: "PartyPopper", group: "Feest", keywords: ["feest", "party", "feestavond", "fuif"] },
  { name: "Carnaval", icon: "Crown", group: "Feest", keywords: ["carnaval", "carnavalsfeest", "vastelaovend"] },
  { name: "Carnavalsbal", icon: "CircleDot", group: "Feest", keywords: ["carnavalsbal", "prinsenbal", "vorstenbal", "hofbal"] },
  { name: "Carnavalsoptocht", icon: "Users", group: "Feest", keywords: ["optocht", "carnavalsoptocht", "stoet", "parade"] },
  { name: "Borrel", icon: "GlassWater", group: "Feest", keywords: ["borrel", "netwerkborrel", "kerstborrel", "vrijdagmiddagborrel"] },
  { name: "Kermis", icon: "Ferriswheel", group: "Feest", keywords: ["kermis", "kermissen", "attracties", "draaimolen"] },
  
  // Ontmoeten
  { name: "Speeddaten", icon: "Heart", group: "Ontmoeten", keywords: ["speeddaten", "speed date", "datingevent"] },
  { name: "Singles Event", icon: "Sparkle", group: "Ontmoeten", keywords: ["singles", "single", "vrijgezel", "meet & greet"] },
  
  // Sport & Beweging
  { name: "Voetbal", icon: "CircleDot", group: "Sport", keywords: ["voetbal", "voetbalwedstrijd", "eredivisie", "ajax", "psv", "feyenoord"] },
  { name: "Basketbal", icon: "Target", group: "Sport", keywords: ["basketbal", "basketball", "bnxt"] },
  { name: "Hardlopen", icon: "Footprints", group: "Sport", keywords: ["hardlopen", "run", "running", "marathon", "halve marathon", "10km"] },
  { name: "Schaatsen", icon: "Snowflake", group: "Sport", keywords: ["schaatsen", "ijsbaan", "schaatsles", "glad ijs"] },
  { name: "Fietsen", icon: "Bike", group: "Sport", keywords: ["fietsen", "fiets", "wielrennen", "mountainbike", "toertocht"] },
  
  // Wandelen & Rondleidingen
  { name: "Stadswandeling", icon: "MapPinned", group: "Wandelen", keywords: ["stadswandeling", "stadswandelen", "city walk"] },
  { name: "Natuurwandeling", icon: "Trees", group: "Wandelen", keywords: ["natuurwandeling", "natuurwandelen", "boswandeling", "wandeltocht"] },
  { name: "Speurtocht", icon: "Search", group: "Wandelen", keywords: ["speurtocht", "zoektocht", "scavenger hunt", "speuren"] },
  
  // Spel & Gezelligheid
  { name: "Pubquiz", icon: "HelpCircle", group: "Spel", keywords: ["pubquiz", "quiz", "quizavond", "trivia"] },
  { name: "Bingo", icon: "Grid3X3", group: "Spel", keywords: ["bingo", "muziekbingo", "kienen"] },
  { name: "Bordspellen", icon: "Puzzle", group: "Spel", keywords: ["bordspellen", "board game", "bordspel", "spelletjes"] },
  { name: "Kaarten", icon: "Spade", group: "Spel", keywords: ["kaarten", "kaartspel", "bridge", "klaverjassen", "poker"] },
  
  // Kinderactiviteiten
  { name: "Kinderfeest", icon: "Cake", group: "Kinderen", keywords: ["kinderfeest", "kinderparty", "kinderactiviteit"] },
  { name: "Voorlezen", icon: "BookOpenText", group: "Kinderen", keywords: ["voorlezen", "voorleespret", "boekjes", "verhaal"] },
  { name: "Kindermiddag", icon: "Candy", group: "Kinderen", keywords: ["kindermiddag", "kinderdag", "kinder"] },
  
  // Markten & Beurzen
  { name: "Weekmarkt", icon: "Store", group: "Markten", keywords: ["weekmarkt", "warenmarkt", "markt"] },
  { name: "Kerstmarkt", icon: "Gift", group: "Markten", keywords: ["kerstmarkt", "kerstmarktje", "wintermarkt"] },
  { name: "Rommelmarkt", icon: "Recycle", group: "Markten", keywords: ["rommelmarkt", "vlooienmarkt", "braderie", "tweedehands"] },
  { name: "Beurs", icon: "Building", group: "Markten", keywords: ["beurs", "vakbeurs", "expo", "trade show"] },
  { name: "Koopzondag", icon: "ShoppingCart", group: "Markten", keywords: ["koopzondag", "koopavond", "zondag open"] },
  
  // Seizoensgebonden
  { name: "Winterfestival", icon: "Snowflake", group: "Seizoen", keywords: ["winterfestival", "winter festival", "winterfeest"] },
  { name: "Zomerfestival", icon: "Sun", group: "Seizoen", keywords: ["zomerfestival", "zomer festival", "zomerfeest", "zomers"] },
  { name: "Nieuwjaarsfeest", icon: "Sparkles", group: "Seizoen", keywords: ["oud en nieuw", "nieuwjaar", "oudjaarsavond", "nye", "new years"] },
];

// Target Audiences data
const TARGET_AUDIENCES_DATA = [
  { name: "Iedereen", icon: "Users", keywords: ["voor iedereen", "alle leeftijden", "toegankelijk"] },
  { name: "Gezinnen", icon: "Home", keywords: ["gezin", "familie", "familiedag", "gezinsactiviteit"] },
  { name: "Kinderen (0-12)", icon: "Baby", keywords: ["kinderen", "kids", "kleuters", "peuters", "0-12", "basisschool"] },
  { name: "Tieners (12-18)", icon: "Gamepad2", keywords: ["tieners", "jongeren", "12-18", "middelbare school", "pubers"] },
  { name: "18+", icon: "Lock", keywords: ["18+", "volwassenen", "adults only", "achttien plus"] },
  { name: "Senioren (55+)", icon: "Glasses", keywords: ["senioren", "55+", "ouderen", "gepensioneerden", "65+"] },
  { name: "LGBTQ+", icon: "Rainbow", keywords: ["lgbtq", "pride", "gay", "queer", "transgender", "regenboog"] },
  { name: "Singles", icon: "Heart", keywords: ["singles", "alleenstaanden", "vrijgezel"] },
];

// Seasonal Themes data
const SEASONAL_THEMES_DATA = [
  { 
    name: "Kerst", 
    icon: "Gift", 
    keywords: ["kerst", "kerstmis", "christmas", "winterwonderland", "kerstmarkt", "kerstconcert"],
    startMonth: 12, startDay: 1, endMonth: 1, endDay: 6, isFloating: false 
  },
  { 
    name: "Sinterklaas", 
    icon: "Star", 
    keywords: ["sinterklaas", "sint", "pakjesavond", "pieten", "5 december"],
    startMonth: 11, startDay: 11, endMonth: 12, endDay: 5, isFloating: false 
  },
  { 
    name: "Carnaval", 
    icon: "Crown", 
    keywords: ["carnaval", "vastelaovend", "carnavalsoptocht", "prins carnaval"],
    startMonth: 2, startDay: 1, endMonth: 3, endDay: 1, isFloating: true, floatingRule: "carnival-period"
  },
  { 
    name: "Pasen", 
    icon: "Egg", 
    keywords: ["pasen", "easter", "paashaas", "eieren zoeken", "paasbrunch"],
    isFloating: true, floatingRule: "easter-2-weeks"
  },
  { 
    name: "Koningsdag", 
    icon: "Flag", 
    keywords: ["koningsdag", "27 april", "oranje", "vrijmarkt", "koningsnacht"],
    startMonth: 4, startDay: 20, endMonth: 4, endDay: 27, isFloating: false 
  },
  { 
    name: "Zomer", 
    icon: "Sun", 
    keywords: ["zomer", "summer", "zomervakantie", "zomerfestival"],
    startMonth: 6, startDay: 21, endMonth: 9, endDay: 21, isFloating: false 
  },
  { 
    name: "Pride", 
    icon: "Rainbow", 
    keywords: ["pride", "gay pride", "canal parade", "regenboog"],
    startMonth: 7, startDay: 15, endMonth: 8, endDay: 15, isFloating: false 
  },
  { 
    name: "Herfstvakantie", 
    icon: "Leaf", 
    keywords: ["herfst", "herfstvakantie", "autumn", "halloween"],
    startMonth: 10, startDay: 15, endMonth: 10, endDay: 31, isFloating: false 
  },
  { 
    name: "Meivakantie", 
    icon: "Flower", 
    keywords: ["mei", "meivakantie", "lente", "spring"],
    startMonth: 4, startDay: 25, endMonth: 5, endDay: 10, isFloating: false 
  },
];

export async function seedTagsAndAudiences() {
  console.log("Seeding event tags, audiences, and themes...");
  
  // Seed Event Tags
  for (let i = 0; i < EVENT_TAGS_DATA.length; i++) {
    const tag = EVENT_TAGS_DATA[i];
    try {
      await db.insert(eventTags).values({
        name: tag.name,
        slug: slugify(tag.name),
        icon: tag.icon,
        group: tag.group,
        keywords: tag.keywords,
        isActive: true,
        sortOrder: i,
      }).onConflictDoNothing();
    } catch (e) {
      console.log(`Tag ${tag.name} already exists or error:`, e);
    }
  }
  console.log(`Seeded ${EVENT_TAGS_DATA.length} event tags`);
  
  // Seed Target Audiences
  for (let i = 0; i < TARGET_AUDIENCES_DATA.length; i++) {
    const audience = TARGET_AUDIENCES_DATA[i];
    try {
      await db.insert(targetAudiences).values({
        name: audience.name,
        slug: slugify(audience.name),
        icon: audience.icon,
        keywords: audience.keywords,
        isActive: true,
        sortOrder: i,
      }).onConflictDoNothing();
    } catch (e) {
      console.log(`Audience ${audience.name} already exists or error:`, e);
    }
  }
  console.log(`Seeded ${TARGET_AUDIENCES_DATA.length} target audiences`);
  
  // Seed Seasonal Themes
  for (let i = 0; i < SEASONAL_THEMES_DATA.length; i++) {
    const theme = SEASONAL_THEMES_DATA[i];
    try {
      await db.insert(seasonalThemes).values({
        name: theme.name,
        slug: slugify(theme.name),
        icon: theme.icon,
        keywords: theme.keywords,
        startMonth: theme.startMonth,
        startDay: theme.startDay,
        endMonth: theme.endMonth,
        endDay: theme.endDay,
        isFloating: theme.isFloating || false,
        floatingRule: theme.floatingRule,
        isActive: true,
        sortOrder: i,
      }).onConflictDoNothing();
    } catch (e) {
      console.log(`Theme ${theme.name} already exists or error:`, e);
    }
  }
  console.log(`Seeded ${SEASONAL_THEMES_DATA.length} seasonal themes`);
  
  console.log("Seeding complete!");
}

// Run the seed
seedTagsAndAudiences()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
