// Slimme afbeelding selectie gebaseerd op titel keywords
// Gebruikt betrouwbare Unsplash photo IDs met werkend URL formaat

interface KeywordMapping {
  keywords: string[];
  photoIds: string[];
}

// Sport & Spel keywords
const SPORT_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['basketbal', 'basket', '3x3', 'streetball', 'basketball'],
    photoIds: ['photo-1546519638-68e109498ffc', 'photo-1519861531473-9200e868bedb', 'photo-1504450758481-7338eba7524a']
  },
  {
    keywords: ['voetbal', 'soccer', 'football'],
    photoIds: ['photo-1575361204480-aadea25e6e68', 'photo-1431324155629-1a6deb1dec8d', 'photo-1540379708242-14a809b1e51c']
  },
  {
    keywords: ['hardlopen', 'running', 'joggen', 'marathon', 'run'],
    photoIds: ['photo-1552674605-db6ffd4facb5', 'photo-1476480862126-209bfaa8edc8', 'photo-1483721310020-03333e577078']
  },
  {
    keywords: ['fietsen', 'wielrennen', 'cycling', 'bike', 'mtb'],
    photoIds: ['photo-1517649763962-0c623066013b', 'photo-1532298229144-0ec0c57515c7', 'photo-1541625602330-2277a4c46182']
  },
  {
    keywords: ['zwemmen', 'swimming', 'zwembad', 'swim'],
    photoIds: ['photo-1519315901367-f34ff9154487', 'photo-1560089000-7433a4ebbd64', 'photo-1571902943202-507ec2618e8f']
  },
  {
    keywords: ['tennis', 'racket'],
    photoIds: ['photo-1622279457486-62dcc4a431d6', 'photo-1554068865-24cecd4e34b8', 'photo-1587280501635-68a0e82cd5ff']
  },
  {
    keywords: ['yoga', 'meditation', 'meditatie', 'stretching'],
    photoIds: ['photo-1544367567-0f2fcb009e0b', 'photo-1506126613408-eca07ce68773', 'photo-1599901860904-17e6ed7083a0']
  },
  {
    keywords: ['fitness', 'gym', 'workout', 'training', 'bootcamp', 'sport'],
    photoIds: ['photo-1534438327276-14e5300c3a48', 'photo-1517836357463-d25dfeac3438', 'photo-1571019614242-c5c5dee9f50b']
  },
  {
    keywords: ['wandelen', 'hiking', 'wandel', 'hike'],
    photoIds: ['photo-1551632811-561732d1e306', 'photo-1445308394109-4ec2920981b1', 'photo-1607273685431-c4493568cdb3']
  },
  {
    keywords: ['schaken', 'chess', 'schaak'],
    photoIds: ['photo-1529699211952-734e80c4d42b', 'photo-1580541631367-747e5a6d0d62', 'photo-1553481187-be93c21490a9']
  },
  {
    keywords: ['pokemon', 'pokémon'],
    photoIds: ['photo-1613771404784-3a5686aa2be3', 'photo-1614926037384-4159c33e2d20', 'photo-1628968434441-d9c2941768db']
  },
];

// Kunst & Cultuur keywords
const KUNST_CULTUUR_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['kasteel', 'castle', 'middeleeuwen', 'medieval', 'ridder', 'knight', 'fort', 'burcht'],
    photoIds: ['photo-1499781350541-7783f6c6a0c8', 'photo-1518998053901-5348d3961a04', 'photo-1605729465641-d827512cad30']
  },
  {
    keywords: ['concert', 'muziek', 'music', 'band', 'jazz', 'live'],
    photoIds: ['photo-1501612780327-45045538702b', 'photo-1470229722913-7c0e2dbbafd3', 'photo-1514320291840-2e0a9bf2a9ae']
  },
  {
    keywords: ['schilderen', 'painting', 'verf', 'kunst', 'art', 'schilder'],
    photoIds: ['photo-1513364776144-60967b0f800f', 'photo-1460661419201-fd4cecdf8a8b', 'photo-1596548438137-d51ea5c83095']
  },
  {
    keywords: ['fotografie', 'photography', 'camera', 'foto'],
    photoIds: ['photo-1452587925148-ce544e77e70d', 'photo-1542038784456-1ea8e935640e', 'photo-1554048612-b6a482bc67e5']
  },
  {
    keywords: ['theater', 'toneel', 'drama', 'show', 'voorstelling'],
    photoIds: ['photo-1503095396549-807759245b35', 'photo-1507003211169-0a1dd7228f2d', 'photo-1485846234645-a62644f84728']
  },
  {
    keywords: ['museum', 'expositie', 'tentoonstelling', 'gallery'],
    photoIds: ['photo-1499781350541-7783f6c6a0c8', 'photo-1518998053901-5348d3961a04', 'photo-1605729465641-d827512cad30']
  },
  {
    keywords: ['film', 'cinema', 'movie', 'filmavond'],
    photoIds: ['photo-1489599849927-2ee91cede3ba', 'photo-1517604931442-7e0c8ed2963c', 'photo-1478720568477-152d9b164e26']
  },
];

// Gezellig & Sociaal keywords  
const GEZELLIG_SOCIAAL_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['barbecue', 'bbq', 'grill'],
    photoIds: ['photo-1555939594-58d7cb561ad1', 'photo-1529193591184-b1d58069ecdd', 'photo-1544025162-d76694265947']
  },
  {
    keywords: ['bordspellen', 'spelletjes', 'games', 'spel', 'game'],
    photoIds: ['photo-1606503825508-882b1e5d08b4', 'photo-1611891487950-c1cf2ec0797e', 'photo-1632501641765-e568d52b0fd8']
  },
  {
    keywords: ['koffie', 'coffee', 'cafe', 'café'],
    photoIds: ['photo-1511920170033-f8396924c348', 'photo-1554118811-1e0d58224f24', 'photo-1509042239860-f550ce710b93']
  },
  {
    keywords: ['picknick', 'picnic', 'picknicken'],
    photoIds: ['photo-1506368249639-73a05d6f6488', 'photo-1551218808-94e220e084d2', 'photo-1627662056894-f5be32e4c0c7']
  },
  {
    keywords: ['wijn', 'wine', 'proeven', 'wijnproeverij'],
    photoIds: ['photo-1510812431401-41d2bd2722f3', 'photo-1558346490-a72e53ae2d4f', 'photo-1556679343-c7306c1976bc']
  },
  {
    keywords: ['borrel', 'drinks', 'cocktail', 'bar'],
    photoIds: ['photo-1529333166437-7750a6dd5a70', 'photo-1543007630-9710e4a00a20', 'photo-1514525253161-7a46d19cd819']
  },
  {
    keywords: ['feest', 'party', 'festival', 'zomerfeest'],
    photoIds: ['photo-1492684223066-81342ee5ff30', 'photo-1511578314322-379afb476865', 'photo-1533174072545-7a4b6ad7a6c3']
  },
  {
    keywords: ['koken', 'cooking', 'chef', 'culinair', 'kook'],
    photoIds: ['photo-1556910103-1c02745aae4d', 'photo-1556911220-e15b29be8c8f', 'photo-1507003211169-0a1dd7228f2d']
  },
];

// Leren & Ontdekken keywords
const LEREN_ONTDEKKEN_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['programmeren', 'coding', 'code', 'developer', 'tech'],
    photoIds: ['photo-1515378791036-0648a3ef77b2', 'photo-1517694712202-14dd9538aa97', 'photo-1461749280684-dccba630e2f6']
  },
  {
    keywords: ['workshop', 'learning', 'leren', 'cursus', 'masterclass'],
    photoIds: ['photo-1524178232363-1fb2b075b655', 'photo-1552664730-d307ca884978', 'photo-1523240795612-9a054b0db644']
  },
  {
    keywords: ['lezing', 'presentation', 'lecture', 'presentatie'],
    photoIds: ['photo-1505373877841-8d25f7d46678', 'photo-1591115765373-5207764f72e7', 'photo-1475721027785-f74eccf877e2']
  },
  {
    keywords: ['boek', 'book', 'lezen', 'bibliotheek', 'library'],
    photoIds: ['photo-1481627834876-b7833e8f5570', 'photo-1507842217343-583bb7270b66', 'photo-1524995997946-a1c2e315a42f']
  },
  {
    keywords: ['geschiedenis', 'history', 'historisch'],
    photoIds: ['photo-1461360370896-922624d12aa1', 'photo-1523554888454-84137e72c3ce', 'photo-1520004434532-668416a08753']
  },
];

// Vrijwilligers keywords
const VRIJWILLIGERS_KEYWORDS: KeywordMapping[] = [
  {
    keywords: ['opruimen', 'cleanup', 'schoonmaken', 'zwerfvuil', 'opschonen'],
    photoIds: ['photo-1532996122724-e3c354a0b15b', 'photo-1618477461853-cf6ed80faba5', 'photo-1622383563227-04401ab4e5ea']
  },
  {
    keywords: ['voedselbank', 'food bank', 'charity', 'hulp'],
    photoIds: ['photo-1488521787991-ed7bbaae773c', 'photo-1593113598332-cd288d649433', 'photo-1532629345422-7515f3d16bb6']
  },
  {
    keywords: ['planten', 'bomen', 'tree', 'groen', 'planting'],
    photoIds: ['photo-1542601906990-b4d3fb778b09', 'photo-1466692476868-aef1dfb1e735', 'photo-1587098616619-e2a8f30c34f9']
  },
];

// Combineer alle mappings
const ALL_KEYWORD_MAPPINGS = [
  ...SPORT_KEYWORDS,
  ...KUNST_CULTUUR_KEYWORDS,
  ...GEZELLIG_SOCIAAL_KEYWORDS,
  ...LEREN_ONTDEKKEN_KEYWORDS,
  ...VRIJWILLIGERS_KEYWORDS,
];

// Fallback afbeeldingen (algemene mensen/events)
const FALLBACK_PHOTO_IDS = [
  'photo-1492684223066-81342ee5ff30', // mensen event
  'photo-1511578314322-379afb476865', // gathering
  'photo-1505373877841-8d25f7d46678', // mensen samen
];

/**
 * Converteer photo ID naar werkende Unsplash URL
 */
function photoIdToUrl(photoId: string): string {
  return `https://images.unsplash.com/${photoId}?q=80&w=1000`;
}

/**
 * Extraheer keywords uit titel
 */
function extractKeywords(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const noiseWords = ['de', 'het', 'een', 'voor', 'van', 'met', 'en', 'of', 'op', 'in', 'bij', 'naar', 'aan', 'om'];
  
  return lowerTitle
    .split(/[\s\-_,.\(\)\[\]]+/)
    .filter(word => word.length > 2)
    .filter(word => !/^\d+x?\d*$/.test(word))
    .filter(word => !noiseWords.includes(word));
}

/**
 * Vind matching photo IDs op basis van titel keywords
 */
function findMatchingPhotoIds(title: string): string[] | null {
  const titleWords = extractKeywords(title);
  
  // Zoek naar een keyword match
  for (const mapping of ALL_KEYWORD_MAPPINGS) {
    for (const titleWord of titleWords) {
      // Check of het woord exact matcht of bevat wordt in een keyword
      if (mapping.keywords.some(k => k === titleWord || k.includes(titleWord) || titleWord.includes(k))) {
        return mapping.photoIds;
      }
    }
  }
  
  return null;
}

/**
 * Get matching images voor display (returns 3 URLs)
 */
export function getMatchingImages(title: string, category: string): string[] {
  console.log('🔍 getMatchingImages called with title:', title, 'category:', category);
  
  // Probeer eerst match op basis van titel (ALLEEN TITEL, categorie wordt genegeerd)
  const photoIds = findMatchingPhotoIds(title);
  console.log('📸 Found photo IDs:', photoIds);
  
  if (photoIds && photoIds.length > 0) {
    // Shuffle en return eerste 3
    const shuffled = [...photoIds].sort(() => Math.random() - 0.5);
    const urls = shuffled.slice(0, 3).map(photoIdToUrl);
    console.log('✅ Generated URLs:', urls);
    return urls;
  }
  
  // Als geen match, gebruik fallback afbeeldingen
  const fallbackUrls = FALLBACK_PHOTO_IDS.map(photoIdToUrl);
  console.log('⚠️ Using fallback URLs:', fallbackUrls);
  return fallbackUrls;
}

/**
 * Generate single image URL
 */
export function generateUnsplashImageUrl(title: string, category: string): string {
  const images = getMatchingImages(title, category);
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}
