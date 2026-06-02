import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'wouter';
import { MapPin, Calendar, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeadForm } from '@/components/Public/LeadForm';
import { CategoryIcon } from '@/components/CategoryIcon';
import { CATEGORIES, type EventInterface } from '@shared/schema';
import type { CityConfig } from '@shared/cities';
import { getBrandCityTitle, type BrandConfig } from '@shared/brands';
import { RadarLogoWithText } from '@/components/RadarLogo';
import { getCurrentBrand } from '@/lib/brand';

interface CityPageData {
  city: CityConfig;
  content: {
    intro: string;
    description: string;
    cta: string;
  };
  eventCount: number;
}

interface CityEventsData {
  events: EventInterface[];
  count: number;
}

function JsonLdSchema({ city, events, eventCount, brand }: { city: CityConfig; events: EventInterface[]; eventCount: number; brand: BrandConfig }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : `https://${brand.displayName}`;
  const noun = brand.seo.eventNoun;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${noun.charAt(0).toUpperCase() + noun.slice(1)} in ${city.name}`,
    "description": `Ontdek ${eventCount} ${noun} in ${city.name}, ${city.province}`,
    "url": `${origin}/${city.provinceSlug}/${city.slug}/evenementen`,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": eventCount,
      "itemListElement": events.slice(0, 10).map((event, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "Event",
          "name": event.title,
          "description": event.description?.substring(0, 200),
          "startDate": event.startTime,
          "endDate": event.endTime || undefined,
          "location": {
            "@type": "Place",
            "name": event.address || city.name,
            "address": {
              "@type": "PostalAddress",
              "addressLocality": city.name,
              "addressRegion": city.province,
              "addressCountry": "NL"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": event.latitude,
              "longitude": event.longitude
            }
          },
          "image": event.imageUrl || undefined,
          "offers": event.isPaid ? {
            "@type": "Offer",
            "price": event.price || 0,
            "priceCurrency": "EUR"
          } : undefined
        }
      }))
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default function CityPage() {
  const params = useParams();
  const citySlug = params.city as string;
  const provinceSlug = params.province as string;
  const brand = getCurrentBrand();
  const noun = brand.seo.eventNoun;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  const cityApiUrl = citySlug && provinceSlug 
    ? `/api/public/city/${citySlug}?provinceSlug=${encodeURIComponent(provinceSlug)}`
    : null;
    
  const { data: cityData, isLoading: isCityLoading, isError: isCityError } = useQuery<CityPageData>({
    queryKey: ['/api/public/city', provinceSlug, citySlug],
    queryFn: async () => {
      if (!cityApiUrl) throw new Error('Missing params');
      const response = await fetch(cityApiUrl);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'City not found');
      }
      return response.json();
    },
    enabled: !!citySlug && !!provinceSlug,
  });

  const eventsApiUrl = citySlug && provinceSlug
    ? `/api/public/events/${citySlug}?provinceSlug=${encodeURIComponent(provinceSlug)}`
    : null;

  const { data: eventsData, isLoading: isEventsLoading } = useQuery<CityEventsData>({
    queryKey: ['/api/public/events', provinceSlug, citySlug],
    queryFn: async () => {
      if (!eventsApiUrl) throw new Error('Missing params');
      const response = await fetch(eventsApiUrl);
      if (!response.ok) return { events: [], count: 0 };
      return response.json();
    },
    enabled: !!citySlug && !!provinceSlug && !!cityData?.city,
  });

  useEffect(() => {
    if (cityData?.city) {
      document.title = getBrandCityTitle(brand, cityData.city.name);
      
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        metaDesc.setAttribute('content', cityData.content.intro);
      }
    }
  }, [cityData]);

  if (isCityLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-24 w-full mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!cityData?.city) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Stad niet gevonden
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Deze stad is nog niet beschikbaar.
          </p>
          <Link href="/">
            <Button>Terug naar home</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { city, content, eventCount } = cityData;
  const events = eventsData?.events || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {events.length > 0 && (
        <JsonLdSchema city={city} events={events} eventCount={eventCount} brand={brand} />
      )}

      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Terug</span>
                </Button>
              </Link>
              <div className="flex items-center">
                <RadarLogoWithText height={34} />
              </div>
            </div>
            <Link href="/app">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Open App
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6" data-testid="breadcrumb">
          <Link href="/" className="hover:text-primary">Home</Link>
          <ChevronRight className="w-4 h-4" />
          <Link href={`/${city.provinceSlug}`} className="hover:text-primary">{city.province}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 dark:text-white font-medium">{city.name}</span>
        </nav>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <MapPin className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="text-city-name">
                {Noun} in {city.name}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {city.province} · {eventCount} {noun}
              </p>
            </div>
          </div>
          
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl" data-testid="text-city-intro">
            {content.intro}
          </p>
        </div>

        <div className="mb-8">
          <LeadForm 
            citySlug={city.slug} 
            cityName={city.name}
            ctaText={content.cta}
          />
        </div>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Komende {noun} in {city.name}
          </h2>
          
          {isEventsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                Nog geen {noun}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Er zijn momenteel geen {noun} in {city.name}. Meld je aan om op de hoogte te blijven!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(event => (
                <Card 
                  key={event.id} 
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                  data-testid={`card-event-${event.id}`}
                >
                  {event.imageUrl && (
                    <div className="h-32 overflow-hidden">
                      <img 
                        src={event.imageUrl} 
                        alt={event.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CategoryIcon 
                        category={event.category as typeof CATEGORIES[number]} 
                        size={16} 
                      />
                      <span className="text-xs text-gray-500">{event.category}</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2">
                      {event.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(event.startTime)}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Over {noun} in {city.name}
          </h2>
          <div className="prose dark:prose-invert max-w-none">
            <p>{content.description}</p>
          </div>
        </section>
      </main>

      <footer className="bg-white dark:bg-gray-800 border-t mt-12 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center">
              <RadarLogoWithText height={28} />
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} {brand.displayName}. Alle rechten voorbehouden.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
