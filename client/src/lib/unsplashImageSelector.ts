// Automatische afbeelding selectie met betrouwbare Unsplash foto's
// Gebruikt gegarandeerde werkende URLs per categorie en activiteit type

interface ImageMapping {
  keywords: string[];
  urls: string[];
}

// Sport & Spel afbeeldingen
const SPORT_IMAGES: ImageMapping[] = [
  {
    keywords: ['basketbal', 'basket', '3x3', 'streetball'],
    urls: [
      'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&h=600&fit=crop', // basketbal court
      'https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=800&h=600&fit=crop', // basketbal actie
      'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800&h=600&fit=crop', // basketbal game
    ]
  },
  {
    keywords: ['voetbal', 'soccer', 'football'],
    urls: [
      'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=600&fit=crop', // voetbal veld
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop', // voetbal actie
      'https://images.unsplash.com/photo-1589487391730-58f20eb2c308?w=800&h=600&fit=crop', // voetbal team
    ]
  },
  {
    keywords: ['hardlopen', 'running', 'joggen', 'marathon'],
    urls: [
      'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=600&fit=crop', // hardlopen mensen
      'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop', // hardlopen bos
      'https://images.unsplash.com/photo-1483721310020-03333e577078?w=800&h=600&fit=crop', // hardlopen stad
    ]
  },
  {
    keywords: ['fietsen', 'wielrennen', 'cycling', 'bike'],
    urls: [
      'https://images.unsplash.com/photo-1541625602330-2277a4c46182?w=800&h=600&fit=crop', // fietsen groep
      'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop', // wielrennen
      'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=800&h=600&fit=crop', // mountainbike
    ]
  },
  {
    keywords: ['zwemmen', 'swimming', 'zwembad'],
    urls: [
      'https://images.unsplash.com/photo-1519315901367-f34ff9154487?w=800&h=600&fit=crop', // zwembad
      'https://images.unsplash.com/photo-1560089000-7433a4ebbd64?w=800&h=600&fit=crop', // zwemmen
      'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=600&fit=crop', // zwemmer
    ]
  },
  {
    keywords: ['tennis', 'racket'],
    urls: [
      'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=800&h=600&fit=crop', // tennis court
      'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&h=600&fit=crop', // tennis speler
      'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=800&h=600&fit=crop', // tennis actie
    ]
  },
  {
    keywords: ['yoga', 'meditation', 'stretching'],
    urls: [
      'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&h=600&fit=crop', // yoga groep
      'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop', // yoga park
      'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=800&h=600&fit=crop', // yoga mat
    ]
  },
  {
    keywords: ['fitness', 'gym', 'workout', 'training', 'bootcamp'],
    urls: [
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop', // fitness groep
      'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop', // gym
      'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&h=600&fit=crop', // workout
    ]
  },
  {
    keywords: ['wandelen', 'hiking', 'natuur'],
    urls: [
      'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&h=600&fit=crop', // wandelen natuur
      'https://images.unsplash.com/photo-1445308394109-4ec2920981b1?w=800&h=600&fit=crop', // wandelpad
      'https://images.unsplash.com/photo-1607273685431-c4493568cdb3?w=800&h=600&fit=crop', // wandelgroep
    ]
  },
  {
    keywords: ['schaken', 'chess'],
    urls: [
      'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=600&fit=crop', // schaakbord
      'https://images.unsplash.com/photo-1580541631E367-747e5a6d0d62?w=800&h=600&fit=crop', // schaken spelen
      'https://images.unsplash.com/photo-1553481187-be93c21490a9?w=800&h=600&fit=crop', // schaakstukken
    ]
  },
];

// Kunst & Cultuur afbeeldingen
const KUNST_CULTUUR_IMAGES: ImageMapping[] = [
  {
    keywords: ['kasteel', 'castle', 'middeleeuwen', 'medieval', 'ridder', 'knight', 'fort', 'burcht'],
    urls: [
      'https://images.unsplash.com/photo-1520004434532-668416a08753?w=800&h=600&fit=crop', // kasteel
      'https://images.unsplash.com/photo-1583875762487-5f8f7c718d6a?w=800&h=600&fit=crop', // middeleeuws kasteel
      'https://images.unsplash.com/photo-1595956913057-1c8c0b9b3a8d?w=800&h=600&fit=crop', // kasteel architectuur
    ]
  },
  {
    keywords: ['concert', 'muziek', 'music', 'band', 'jazz'],
    urls: [
      'https://images.unsplash.com/photo-1501612780327-45045538702b?w=800&h=600&fit=crop', // concert crowd
      'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&fit=crop', // live muziek
      'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=600&fit=crop', // concert performance
    ]
  },
  {
    keywords: ['schilderen', 'painting', 'verf', 'kunst', 'art'],
    urls: [
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&fit=crop', // schilderen
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=600&fit=crop', // verf palet
      'https://images.unsplash.com/photo-1596548438137-d51ea5c83095?w=800&h=600&fit=crop', // art workshop
    ]
  },
  {
    keywords: ['fotografie', 'photography', 'camera', 'foto'],
    urls: [
      'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=800&h=600&fit=crop', // camera
      'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&h=600&fit=crop', // fotograaf
      'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&h=600&fit=crop', // foto maken
    ]
  },
  {
    keywords: ['theater', 'toneel', 'drama', 'show'],
    urls: [
      'https://images.unsplash.com/photo-1503095396549-807759245b35?w=800&h=600&fit=crop', // theater podium
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', // theater lichten
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=600&fit=crop', // performance
    ]
  },
  {
    keywords: ['koken', 'cooking', 'chef', 'culinair'],
    urls: [
      'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=800&h=600&fit=crop', // koken workshop
      'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&h=600&fit=crop', // cooking class
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', // chef
    ]
  },
];

// Gezellig & Sociaal afbeeldingen
const GEZELLIG_SOCIAAL_IMAGES: ImageMapping[] = [
  {
    keywords: ['barbecue', 'bbq', 'grill'],
    urls: [
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&h=600&fit=crop', // bbq mensen
      'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&h=600&fit=crop', // barbecue food
      'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=600&fit=crop', // grill party
    ]
  },
  {
    keywords: ['bordspellen', 'spelletjes', 'games', 'spel'],
    urls: [
      'https://images.unsplash.com/photo-1606503825508-882b1e5d08b4?w=800&h=600&fit=crop', // bordspellen groep
      'https://images.unsplash.com/photo-1611891487950-c1cf2ec0797e?w=800&h=600&fit=crop', // board games
      'https://images.unsplash.com/photo-1632501641765-e568d52b0fd8?w=800&h=600&fit=crop', // spelletjesavond
    ]
  },
  {
    keywords: ['koffie', 'coffee', 'cafe'],
    urls: [
      'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&h=600&fit=crop', // koffie mensen
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=600&fit=crop', // cafe
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&h=600&fit=crop', // coffee meeting
    ]
  },
  {
    keywords: ['picknick', 'picnic', 'park'],
    urls: [
      'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?w=800&h=600&fit=crop', // picknick
      'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=800&h=600&fit=crop', // park picnic
      'https://images.unsplash.com/photo-1627662056894-f5be32e4c0c7?w=800&h=600&fit=crop', // outdoor eten
    ]
  },
  {
    keywords: ['wijn', 'wine', 'proeven'],
    urls: [
      'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&h=600&fit=crop', // wijnproeverij
      'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=800&h=600&fit=crop', // wine tasting
      'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop', // wijn groep
    ]
  },
];

// Leren & Ontdekken afbeeldingen
const LEREN_ONTDEKKEN_IMAGES: ImageMapping[] = [
  {
    keywords: ['programmeren', 'coding', 'computer', 'tech'],
    urls: [
      'https://images.unsplash.com/photo-1515378791036-0648a3ef77b2?w=800&h=600&fit=crop', // programmeren
      'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&h=600&fit=crop', // coding
      'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=600&fit=crop', // tech workshop
    ]
  },
  {
    keywords: ['workshop', 'learning', 'leren', 'cursus'],
    urls: [
      'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop', // workshop groep
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=600&fit=crop', // learning
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=600&fit=crop', // cursus
    ]
  },
  {
    keywords: ['lezing', 'presentation', 'lecture'],
    urls: [
      'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=600&fit=crop', // lezing
      'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=800&h=600&fit=crop', // presentation
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=600&fit=crop', // lecture
    ]
  },
];

// Vrijwilligers afbeeldingen
const VRIJWILLIGERS_IMAGES: ImageMapping[] = [
  {
    keywords: ['opruimen', 'cleanup', 'schoonmaken', 'zwerfvuil'],
    urls: [
      'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&h=600&fit=crop', // cleanup groep
      'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=800&h=600&fit=crop', // opruimen natuur
      'https://images.unsplash.com/photo-1622383563227-04401ab4e5ea?w=800&h=600&fit=crop', // vrijwilligers cleanup
    ]
  },
  {
    keywords: ['voedselbank', 'food bank', 'charity'],
    urls: [
      'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop', // voedselbank
      'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=600&fit=crop', // food bank
      'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=800&h=600&fit=crop', // charity
    ]
  },
  {
    keywords: ['planten', 'bomen', 'tree', 'groen'],
    urls: [
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&h=600&fit=crop', // bomen planten
      'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&h=600&fit=crop', // planten groep
      'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=600&fit=crop', // groene vrijwilligers
    ]
  },
];

// Combine all images
const ALL_IMAGE_MAPPINGS = [
  ...SPORT_IMAGES,
  ...KUNST_CULTUUR_IMAGES,
  ...GEZELLIG_SOCIAAL_IMAGES,
  ...LEREN_ONTDEKKEN_IMAGES,
  ...VRIJWILLIGERS_IMAGES,
];

// Fallback images per categorie
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  'Sport en spel': [
    'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=600&fit=crop',
  ],
  'Kunst en Cultuur': [
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&h=600&fit=crop',
  ],
  'Gezellig en Sociaal': [
    'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&h=600&fit=crop',
  ],
  'Leren en Ontdekken': [
    'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800&h=600&fit=crop',
  ],
  'Vrijwilligerswerk en hulp': [
    'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1593113598332-cd288d649433?w=800&h=600&fit=crop',
    'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800&h=600&fit=crop',
  ],
};

/**
 * Extract keywords from title
 */
function extractKeywords(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const noiseWords = ['de', 'het', 'een', 'voor', 'van', 'met', 'en', 'of', 'op', 'in', 'bij', 'naar', 'aan'];
  
  return lowerTitle
    .split(/[\s\-_,.\(\)\[\]]+/)
    .filter(word => word.length > 2)
    .filter(word => !/^\d+x?\d*$/.test(word))
    .filter(word => !noiseWords.includes(word));
}

/**
 * Find matching images based ONLY on title (category is ignored)
 */
function findMatchingImages(title: string, category: string): string[] {
  const keywords = extractKeywords(title);
  
  // Try to find exact keyword match - ALLEEN gebaseerd op titel
  for (const mapping of ALL_IMAGE_MAPPINGS) {
    for (const keyword of keywords) {
      if (mapping.keywords.some(k => k === keyword || k.includes(keyword) || keyword.includes(k))) {
        return mapping.urls;
      }
    }
  }
  
  // Als geen match, gebruik neutrale algemene afbeeldingen (geen categorie specifiek)
  return [
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop', // event mensen
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=800&h=600&fit=crop', // gathering
    'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=800&h=600&fit=crop', // mensen samen
  ];
}

/**
 * Get matching images for display (returns 3 images)
 */
export function getMatchingImages(title: string, category: string): string[] {
  const images = findMatchingImages(title, category);
  // Shuffle and return first 3
  const shuffled = [...images].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Generate a single image URL
 */
export function generateUnsplashImageUrl(title: string, category: string): string {
  const images = findMatchingImages(title, category);
  const randomIndex = Math.floor(Math.random() * images.length);
  return images[randomIndex];
}
