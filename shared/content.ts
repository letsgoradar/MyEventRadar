export interface ContentVariant {
  id: string;
  type: 'intro' | 'description' | 'cta' | 'faq';
  template: string;
}

export const CITY_INTRO_VARIANTS: ContentVariant[] = [
  {
    id: 'intro-1',
    type: 'intro',
    template: 'Ontdek de leukste evenementen in {city}! Van gezellige buurtactiviteiten tot culturele hoogtepunten - er is altijd iets te beleven in {city}.'
  },
  {
    id: 'intro-2',
    type: 'intro',
    template: 'Op zoek naar wat te doen in {city}? Bekijk het complete overzicht van evenementen, festivals en activiteiten in jouw buurt.'
  },
  {
    id: 'intro-3',
    type: 'intro',
    template: '{city} bruist van de activiteiten! Vind hier alle evenementen bij jou in de buurt, van sport tot cultuur en alles daartussenin.'
  },
  {
    id: 'intro-4',
    type: 'intro',
    template: 'Wat is er te doen in {city}? Ontdek lokale evenementen, workshops, markten en meer. Altijd op de hoogte van wat er speelt in {city}.'
  },
  {
    id: 'intro-5',
    type: 'intro',
    template: 'Welkom bij de evenementenkalender van {city}! Hier vind je een actueel overzicht van alle activiteiten in {city} en omgeving.'
  }
];

export const CITY_DESCRIPTION_VARIANTS: ContentVariant[] = [
  {
    id: 'desc-1',
    type: 'description',
    template: '{city} is een bruisende stad in {province} met een rijk cultureel aanbod. Van lokale markten tot grote festivals - er is voor ieder wat wils.'
  },
  {
    id: 'desc-2',
    type: 'description',
    template: 'In {city} is altijd wat te beleven. De stad staat bekend om haar diverse aanbod aan evenementen en activiteiten voor jong en oud.'
  },
  {
    id: 'desc-3',
    type: 'description',
    template: 'Of je nu op zoek bent naar sport, cultuur of gezelligheid - {city} heeft het allemaal. Bekijk hieronder de actuele evenementen.'
  }
];

export const CITY_CTA_VARIANTS: ContentVariant[] = [
  {
    id: 'cta-1',
    type: 'cta',
    template: 'Wil je op de hoogte blijven van evenementen in {city}? Schrijf je in voor onze nieuwsbrief!'
  },
  {
    id: 'cta-2',
    type: 'cta',
    template: 'Mis geen enkel evenement meer in {city}. Meld je aan en ontvang wekelijks de beste tips!'
  },
  {
    id: 'cta-3',
    type: 'cta',
    template: 'Ontvang gratis de leukste evenementen in {city} in je inbox. Schrijf je nu in!'
  }
];

export const CATEGORY_INTRO_VARIANTS: Record<string, ContentVariant[]> = {
  'sport-en-spel': [
    { id: 'sport-1', type: 'intro', template: 'Sportieve evenementen in {city}! Van hardlopen tot voetbal en alles daartussenin.' },
    { id: 'sport-2', type: 'intro', template: 'Op zoek naar sport en beweging in {city}? Bekijk alle sportieve activiteiten bij jou in de buurt.' }
  ],
  'kunst-en-cultuur': [
    { id: 'cultuur-1', type: 'intro', template: 'Culturele evenementen in {city}! Ontdek exposities, theater, muziek en meer.' },
    { id: 'cultuur-2', type: 'intro', template: 'Kunst en cultuur in {city} - van museumbezoek tot live optredens.' }
  ],
  'gezellig-en-sociaal': [
    { id: 'sociaal-1', type: 'intro', template: 'Gezellige evenementen in {city}! Van buurtfeesten tot borrels en markten.' },
    { id: 'sociaal-2', type: 'intro', template: 'Op zoek naar gezelligheid in {city}? Ontdek sociale activiteiten bij jou in de buurt.' }
  ],
  'leren-en-ontdekken': [
    { id: 'leren-1', type: 'intro', template: 'Workshops en cursussen in {city}! Leer iets nieuws of ontwikkel je vaardigheden.' },
    { id: 'leren-2', type: 'intro', template: 'Educatieve evenementen in {city} - van lezingen tot hands-on workshops.' }
  ],
  'vrijwilligerswerk-en-hulp': [
    { id: 'vrijwillig-1', type: 'intro', template: 'Vrijwilligerswerk in {city}! Draag bij aan je community en ontmoet nieuwe mensen.' },
    { id: 'vrijwillig-2', type: 'intro', template: 'Wil je iets betekenen voor {city}? Bekijk de vrijwilligersmogelijkheden.' }
  ]
};

export function getRandomVariant(variants: ContentVariant[]): ContentVariant {
  const index = Math.floor(Math.random() * variants.length);
  return variants[index];
}

export function getConsistentVariant(variants: ContentVariant[], seed: string): ContentVariant {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const index = Math.abs(hash) % variants.length;
  return variants[index];
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

export function getCityContent(citySlug: string, cityName: string, provinceName: string): {
  intro: string;
  description: string;
  cta: string;
} {
  const introVariant = getConsistentVariant(CITY_INTRO_VARIANTS, citySlug + '-intro');
  const descVariant = getConsistentVariant(CITY_DESCRIPTION_VARIANTS, citySlug + '-desc');
  const ctaVariant = getConsistentVariant(CITY_CTA_VARIANTS, citySlug + '-cta');

  const variables = { city: cityName, province: provinceName };

  return {
    intro: renderTemplate(introVariant.template, variables),
    description: renderTemplate(descVariant.template, variables),
    cta: renderTemplate(ctaVariant.template, variables)
  };
}

export function getCategorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export function getCategoryFromSlug(slug: string): string | undefined {
  const categories: Record<string, string> = {
    'sport-en-spel': 'Sport en spel',
    'kunst-en-cultuur': 'Kunst en Cultuur',
    'gezellig-en-sociaal': 'Gezellig en Sociaal',
    'leren-en-ontdekken': 'Leren en Ontdekken',
    'vrijwilligerswerk-en-hulp': 'Vrijwilligerswerk en hulp'
  };
  return categories[slug];
}
