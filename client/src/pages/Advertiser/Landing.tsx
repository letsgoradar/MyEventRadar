import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadarLogoWithText } from '@/components/RadarLogo';
import {
  Megaphone,
  Star,
  MapPin,
  Eye,
  MousePointerClick,
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Calculator,
  Building2,
} from 'lucide-react';
import { RADIUS_OPTIONS } from '@shared/schema';

const PERIOD_LABELS: Record<string, string> = {
  day: '1 dag',
  week: '1 week',
  month: '1 maand',
};

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export default function AdvertiserLanding() {
  const [selectedRadius, setSelectedRadius] = useState<number>(10);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('week');
  const [activeTab, setActiveTab] = useState<string>('promotions');

  const { data: pricingData } = useQuery<{
    pricing: {
      event_promotion: Record<string, Record<string, number>>;
      business_ad: Record<string, Record<string, number>>;
    };
    radiusOptions: number[];
    periods: string[];
  }>({
    queryKey: ['/api/promotions/pricing-matrix'],
  });

  const promotionPrice = pricingData?.pricing?.event_promotion?.[String(selectedRadius)]?.[selectedPeriod];
  const adCpmPrice = pricingData?.pricing?.business_ad?.[String(selectedRadius)]?.cpm;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <RadarLogoWithText height={24} />
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/advertiser/dashboard">Dashboard</Link>
            </Button>
            <Button asChild>
              <Link href="/advertiser/dashboard">
                Start nu <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
            Bereik duizenden lokale bezoekers
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Adverteren op Evenementenradar.nl
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Breng jouw bedrijf of evenement onder de aandacht van actieve bezoekers in jouw regio. 
            Twee advertentieproducten, eerlijke prijzen die meeschalen met je bereik.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" asChild>
              <Link href="/advertiser/dashboard">
                Gratis account aanmaken <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>
              <Calculator className="mr-2 h-4 w-4" />
              Bekijk prijzen
            </Button>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Twee advertentieproducten</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Megaphone className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Bedrijfsadvertenties</CardTitle>
                    <CardDescription>CPM-model (betaal per vertoning)</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Jouw bedrijf verschijnt als advertentie wanneer bezoekers evenementen bekijken. 
                  Ideaal voor musea, restaurants, pretparken en andere hospitality-bedrijven.
                </p>
                <ul className="space-y-2">
                  {[
                    'Betaal alleen voor vertoningen (CPM)',
                    'Stel een maandelijks budgetlimiet in',
                    'Kies je doelradius (5-50 km of landelijk)',
                    'Automatische incasso via Stripe',
                    'Real-time statistieken',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-amber-500/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Star className="h-6 w-6 text-amber-500" />
                  </div>
                  <div>
                    <CardTitle>Gepromote Events</CardTitle>
                    <CardDescription>Vooraf betaald per periode</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Jouw evenement verschijnt als "Gepromoot" bovenaan de zoekresultaten. 
                  Vergelijkbaar met Marktplaats "Opvallen" — maximale zichtbaarheid.
                </p>
                <ul className="space-y-2">
                  {[
                    'Bovenaan in zoekresultaten',
                    'Kies 1 dag, 1 week of 1 maand',
                    'Kies je doelradius (5-50 km of landelijk)',
                    'Eenmalige betaling, geen verrassingen',
                    'Gouden badge op je evenement',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4">Prijscalculator</h2>
          <p className="text-center text-muted-foreground mb-10">
            Kies je product, radius en periode om direct je prijs te zien.
          </p>

          <Card>
            <CardContent className="pt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2 mb-8">
                  <TabsTrigger value="promotions" className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Event Promoties
                  </TabsTrigger>
                  <TabsTrigger value="ads" className="flex items-center gap-2">
                    <Megaphone className="h-4 w-4" />
                    Bedrijfsadvertenties
                  </TabsTrigger>
                </TabsList>

                <div className="mb-8">
                  <label className="text-sm font-medium mb-3 block">
                    <MapPin className="h-4 w-4 inline mr-1.5" />
                    Doelradius
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {[...RADIUS_OPTIONS].sort((a, b) => { if (a === 0) return 1; if (b === 0) return -1; return a - b; }).map((r) => (
                      <Button
                        key={r}
                        variant={selectedRadius === r ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSelectedRadius(r)}
                      >
                        {r === 0 ? 'Landelijk' : `${r} km`}
                      </Button>
                    ))}
                  </div>
                </div>

                <TabsContent value="promotions">
                  <div className="mb-6">
                    <label className="text-sm font-medium mb-3 block">Periode</label>
                    <div className="flex gap-2">
                      {['day', 'week', 'month'].map((p) => (
                        <Button
                          key={p}
                          variant={selectedPeriod === p ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedPeriod(p)}
                        >
                          {PERIOD_LABELS[p]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded-xl p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      {PERIOD_LABELS[selectedPeriod]} × {selectedRadius} km radius
                    </p>
                    <p className="text-4xl font-bold text-primary">
                      {promotionPrice !== undefined ? formatCents(promotionPrice) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">eenmalige betaling</p>
                  </div>

                  {pricingData && (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Radius</th>
                            <th className="text-right py-2 font-medium">1 dag</th>
                            <th className="text-right py-2 font-medium">1 week</th>
                            <th className="text-right py-2 font-medium">1 maand</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...RADIUS_OPTIONS].sort((a, b) => { if (a === 0) return 1; if (b === 0) return -1; return a - b; }).map((r) => (
                            <tr key={r} className={`border-b ${r === selectedRadius ? 'bg-primary/5 font-medium' : ''}`}>
                              <td className="py-2">{r === 0 ? 'Landelijk' : `${r} km`}</td>
                              {['day', 'week', 'month'].map((p) => {
                                const price = pricingData.pricing?.event_promotion?.[String(r)]?.[p];
                                return (
                                  <td key={p} className="text-right py-2">
                                    {price !== undefined ? formatCents(price) : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="ads">
                  <div className="bg-muted/50 rounded-xl p-6 text-center">
                    <p className="text-sm text-muted-foreground mb-2">
                      CPM bij {selectedRadius === 0 ? 'landelijk' : `${selectedRadius} km`} bereik
                    </p>
                    <p className="text-4xl font-bold text-primary">
                      {adCpmPrice !== undefined ? formatCents(adCpmPrice) : '—'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">per 1.000 vertoningen</p>
                  </div>

                  {pricingData && (
                    <div className="mt-6 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Radius</th>
                            <th className="text-right py-2 font-medium">CPM (per 1.000 vertoningen)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...RADIUS_OPTIONS].sort((a, b) => { if (a === 0) return 1; if (b === 0) return -1; return a - b; }).map((r) => {
                            const price = pricingData.pricing?.business_ad?.[String(r)]?.cpm;
                            return (
                              <tr key={r} className={`border-b ${r === selectedRadius ? 'bg-primary/5 font-medium' : ''}`}>
                                <td className="py-2">{r === 0 ? 'Landelijk' : `${r} km`}</td>
                                <td className="text-right py-2">
                                  {price !== undefined ? formatCents(price) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Hoe werkt het?</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              {
                icon: Building2,
                title: '1. Registreer',
                description: 'Maak een gratis adverteerdersaccount aan en vul je bedrijfsgegevens in.',
              },
              {
                icon: Eye,
                title: '2. Maak je campagne',
                description: 'Kies je product, stel je radius en budget in, en upload je content.',
              },
              {
                icon: MousePointerClick,
                title: '3. Bereik bezoekers',
                description: 'Jouw advertentie of gepromoot event wordt getoond aan bezoekers in je regio.',
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">Klaar om te starten?</h2>
          <p className="text-muted-foreground">
            Maak een gratis account aan en begin direct met adverteren. 
            Minimale storting van €10 om je account te activeren.
          </p>
          <Button size="lg" asChild>
            <Link href="/advertiser/dashboard">
              Start met adverteren <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <RadarLogoWithText height={24} />
          <div className="flex gap-6">
            <Link href="/">Home</Link>
            <Link href="/adverteren">Adverteren</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
