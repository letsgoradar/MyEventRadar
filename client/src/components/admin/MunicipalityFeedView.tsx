import { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronRight, Plus, ExternalLink, CheckCircle,
  AlertCircle, Pause, Search, Building2, MapPin, Rss, Globe, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RssFeed {
  id: number;
  name: string;
  url: string;
  feedType: string;
  status: string;
  municipality: string | null;
  province: string | null;
  itemsImported: number;
  lastFetchedAt: string | null;
  lastErrorMessage: string | null;
}

interface MunicipalityFeedViewProps {
  feeds: RssFeed[];
  feedOverview: Record<number, { totalActive: number; addedLastSync: number; lastSyncDate: string | null }>;
  onEditFeed: (feed: RssFeed) => void;
  onOpenAnalyzer: (municipality: string, province: string) => void;
}

const NL_MUNICIPALITIES: Record<string, string[]> = {
  'Drenthe': [
    'Aa en Hunze', 'Assen', 'Borger-Odoorn', 'Coevorden', 'De Wolden', 'Emmen',
    'Hoogeveen', 'Meppel', 'Midden-Drenthe', 'Noordenveld', 'Tynaarlo', 'Westerveld',
  ],
  'Flevoland': [
    'Almere', 'Dronten', 'Lelystad', 'Noordoostpolder', 'Urk', 'Zeewolde',
  ],
  'Friesland': [
    'Achtkarspelen', 'Ameland', 'Dantumadiel', 'De Fryske Marren', 'Harlingen',
    'Heerenveen', 'Leeuwarden', 'Noardeast-Fryslân', 'Ooststellingwerf', 'Opsterland',
    'Schiermonnikoog', 'Smallingerland', 'Súdwest-Fryslân', 'Terschelling',
    'Tytsjerksteradiel', 'Vlieland', 'Waadhoeke', 'Weststellingwerf',
  ],
  'Gelderland': [
    'Aalten', 'Apeldoorn', 'Arnhem', 'Barneveld', 'Berg en Dal', 'Berkelland',
    'Beuningen', 'Bronckhorst', 'Brummen', 'Buren', 'Culemborg', 'Doesburg',
    'Doetinchem', 'Druten', 'Duiven', 'Ede', 'Elburg', 'Epe', 'Ermelo',
    'Harderwijk', 'Hattem', 'Heerde', 'Heumen', 'Lingewaard', 'Lochem',
    'Maasdriel', 'Montferland', 'Neder-Betuwe', 'Nijkerk', 'Nijmegen',
    'Nunspeet', 'Oldebroek', 'Oost Gelre', 'Oude IJsselstreek', 'Overbetuwe',
    'Putten', 'Renkum', 'Rheden', 'Rozendaal', 'Scherpenzeel', 'Tiel',
    'Voorst', 'Wageningen', 'West Betuwe', 'West Maas en Waal', 'Westervoort',
    'Wijchen', 'Winterswijk', 'Zaltbommel', 'Zevenaar', 'Zutphen',
  ],
  'Groningen': [
    'Delfzijl', 'Eemsdelta', 'Groningen', 'Het Hogeland', 'Midden-Groningen',
    'Oldambt', 'Pekela', 'Stadskanaal', 'Veendam', 'Westerkwartier', 'Westerwolde',
  ],
  'Limburg': [
    'Beekdaelen', 'Beesel', 'Bergen (L)', 'Brunssum', 'Echt-Susteren',
    'Eijsden-Margraten', 'Gennep', 'Gulpen-Wittem', 'Heerlen', 'Horst aan de Maas',
    'Kerkrade', 'Landgraaf', 'Leudal', 'Maasgouw', 'Maastricht', 'Mook en Middelaar',
    'Nederweert', 'Peel en Maas', 'Roerdalen', 'Roermond', 'Simpelveld',
    'Sittard-Geleen', 'Stein', 'Vaals', 'Valkenburg aan de Geul', 'Venlo',
    'Venray', 'Voerendaal', 'Weert',
  ],
  'Noord-Brabant': [
    'Alphen-Chaam', 'Altena', 'Asten', 'Baarle-Nassau', 'Bergen op Zoom', 'Bernheze',
    'Best', 'Bladel', 'Boekel', 'Boxtel', 'Breda', 'Cranendonck', 'Deurne', 'Dongen',
    'Drimmelen', 'Eersel', 'Eindhoven', 'Etten-Leur', 'Geertruidenberg',
    'Gilze en Rijen', 'Goirle', 'Halderberge', 'Helmond', 'Heusden', 'Hilvarenbeek',
    'Laarbeek', 'Land van Cuijk', 'Loon op Zand', 'Maashorst', 'Meierijstad',
    'Mill en Sint Hubert', 'Moerdijk', 'Nuenen c.a.', 'Oirschot', 'Oisterwijk',
    'Oosterhout', 'Oss', 'Reusel-De Mierden', 'Roosendaal', 'Rucphen',
    'Sint-Michielsgestel', 'Someren', 'Son en Breugel', 'Steenbergen', 'Tilburg',
    'Valkenswaard', 'Veldhoven', 'Vught', 'Waalre', 'Waalwijk', 'Zundert',
    "'s-Hertogenbosch",
  ],
  'Noord-Holland': [
    'Aalsmeer', 'Alkmaar', 'Amstelveen', 'Amsterdam', 'Bergen', 'Beverwijk',
    'Blaricum', 'Bloemendaal', 'Castricum', 'Den Helder', 'Diemen', 'Dijk en Waard',
    'Edam-Volendam', 'Enkhuizen', 'Gooise Meren', 'Haarlem', 'Haarlemmermeer',
    'Heemskerk', 'Heemstede', 'Heiloo', 'Hilversum', 'Hollands Kroon', 'Hoorn',
    'Huizen', 'Koggenland', 'Landsmeer', 'Laren', 'Medemblik', 'Oostzaan', 'Opmeer',
    'Ouder-Amstel', 'Purmerend', 'Schagen', 'Stede Broec', 'Texel', 'Uitgeest',
    'Uithoorn', 'Velsen', 'Waterland', 'Wormerland', 'Zaanstad', 'Zandvoort',
  ],
  'Overijssel': [
    'Almelo', 'Borne', 'Dalfsen', 'Deventer', 'Dinkelland', 'Enschede', 'Haaksbergen',
    'Hardenberg', 'Hellendoorn', 'Hengelo', 'Kampen', 'Losser', 'Oldenzaal',
    'Olst-Wijhe', 'Ommen', 'Raalte', 'Rijssen-Holten', 'Staphorst', 'Steenwijkerland',
    'Tubbergen', 'Twenterand', 'Wierden', 'Zwolle',
  ],
  'Utrecht': [
    'Amersfoort', 'Baarn', 'Bunnik', 'Bunschoten', 'De Bilt', 'De Ronde Venen',
    'IJsselstein', 'Leusden', 'Lopik', 'Montfoort', 'Nieuwegein', 'Oudewater',
    'Renswoude', 'Rhenen', 'Soest', 'Stichtse Vecht', 'Utrecht', 'Utrechtse Heuvelrug',
    'Veenendaal', 'Vijfheerenlanden', 'Wijk bij Duurstede', 'Woerden', 'Woudenberg', 'Zeist',
  ],
  'Zeeland': [
    'Borsele', 'Goes', 'Hulst', 'Kapelle', 'Middelburg', 'Noord-Beveland',
    'Reimerswaal', 'Schouwen-Duiveland', 'Sluis', 'Terneuzen', 'Tholen', 'Veere', 'Vlissingen',
  ],
  'Zuid-Holland': [
    'Albrandswaard', 'Alphen aan den Rijn', 'Barendrecht', 'Brielle', 'Capelle aan den IJssel',
    'Delft', 'Den Haag', 'Dordrecht', 'Goeree-Overflakkee', 'Gorinchem', 'Gouda',
    'Hardinxveld-Giessendam', 'Hellevoetsluis', 'Hoeksche Waard', 'Krimpen aan den IJssel',
    'Krimpenerwaard', 'Lansingerland', 'Leiden', 'Leiderdorp', 'Leidschendam-Voorburg',
    'Maassluis', 'Midden-Delfland', 'Molenlanden', 'Nieuwkoop', 'Nissewaard', 'Oegstgeest',
    'Pijnacker-Nootdorp', 'Ridderkerk', 'Rotterdam', 'Schiedam', 'Sliedrecht', 'Voorne aan Zee',
    'Waddinxveen', 'Wassenaar', 'Westland', 'Zoetermeer', 'Zoeterwoude', 'Zuidplas', 'Zwijndrecht',
  ],
};

function normalize(s: string) {
  return s.toLowerCase().replace(/['\-]/g, '').replace(/\s+/g, ' ').trim();
}

function feedMatchesMunicipality(feed: RssFeed, municipality: string): boolean {
  if (!feed.municipality) return false;
  return normalize(feed.municipality) === normalize(municipality);
}

function FeedStatusIcon({ status }: { status: string }) {
  if (status === 'active') return <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />;
  if (status === 'error') return <AlertCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
  return <Pause className="h-3 w-3 text-gray-400 flex-shrink-0" />;
}

function FeedTypeIcon({ feedType }: { feedType: string }) {
  if (feedType === 'rss' || feedType === 'atom') return <Rss className="h-3 w-3" />;
  return <Globe className="h-3 w-3" />;
}

interface InlineAddFormProps {
  municipality: string;
  province: string;
  onSuccess: () => void;
  onCancel: () => void;
  onOpenAnalyzer: () => void;
}

function InlineAddForm({ municipality, province, onSuccess, onCancel, onOpenAnalyzer }: InlineAddFormProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [isVenue, setIsVenue] = useState(false);
  const [venueName, setVenueName] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: name || (isVenue ? `${venueName} – ${municipality}` : `${municipality} Agenda`),
          url,
          feedType: 'scraper',
          defaultCategory: 'Stappen & Borrel',
          municipality,
          province,
          autoCreateEvents: true,
          updateFrequencyMinutes: 360,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      toast({ title: 'Feed aangemaakt', description: `Feed voor ${municipality} is aangemaakt.` });
      onSuccess();
    },
    onError: () => {
      toast({ title: 'Fout', description: 'Feed aanmaken mislukt.', variant: 'destructive' });
    },
  });

  return (
    <div className="mt-2 p-3 bg-muted/50 rounded-lg border border-dashed space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={`venue-${municipality}`}
          checked={isVenue}
          onChange={e => setIsVenue(e.target.checked)}
          className="rounded"
        />
        <label htmlFor={`venue-${municipality}`} className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
          <Building2 className="h-3 w-3" /> Venue-specifieke feed (bijv. Brabanthallen, Jaarbeurs)
        </label>
      </div>

      {isVenue && (
        <Input
          placeholder="Naam van het venue (bijv. Brabanthallen)"
          value={venueName}
          onChange={e => setVenueName(e.target.value)}
          className="h-8 text-sm"
        />
      )}

      <Input
        placeholder={`Feed URL voor ${isVenue ? (venueName || 'venue') : municipality}`}
        value={url}
        onChange={e => setUrl(e.target.value)}
        className="h-8 text-sm font-mono"
      />

      <Input
        placeholder={`Feed naam (optioneel, bijv. "${municipality} Uitagenda")`}
        value={name}
        onChange={e => setName(e.target.value)}
        className="h-8 text-sm"
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 text-xs"
          disabled={!url || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Opslaan
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={onOpenAnalyzer}
        >
          <Globe className="h-3 w-3 mr-1" /> Feed Analyzer
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Annuleren
        </Button>
      </div>
    </div>
  );
}

interface ProvinceRowProps {
  province: string;
  municipalities: string[];
  feedsByMunicipality: Record<string, RssFeed[]>;
  searchQuery: string;
  onEditFeed: (feed: RssFeed) => void;
  onOpenAnalyzer: (municipality: string, province: string) => void;
}

function ProvinceRow({
  province, municipalities, feedsByMunicipality,
  searchQuery, onEditFeed, onOpenAnalyzer,
}: ProvinceRowProps) {
  const covered = municipalities.filter(m => (feedsByMunicipality[m] || []).length > 0).length;
  const hasSearch = searchQuery.length > 0;
  const [isOpen, setIsOpen] = useState(() => covered > 0 || hasSearch);
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const visibleMunicipalities = useMemo(() => {
    if (!searchQuery) return municipalities;
    const q = normalize(searchQuery);
    return municipalities.filter(m => normalize(m).includes(q));
  }, [municipalities, searchQuery]);

  if (visibleMunicipalities.length === 0) return null;

  const pct = Math.round((covered / municipalities.length) * 100);

  return (
    <div className="border rounded-lg overflow-hidden mb-2">
      <button
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <span className="font-semibold text-sm flex-1">{province}</span>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">{covered}/{municipalities.length}</div>
          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-400')}
              style={{ width: `${pct}%` }}
            />
          </div>
          <Badge
            variant={pct >= 80 ? 'default' : pct >= 40 ? 'secondary' : 'outline'}
            className="text-xs h-5"
          >
            {pct}%
          </Badge>
        </div>
      </button>

      {isOpen && (
        <div className="divide-y">
          {visibleMunicipalities.map(municipality => {
            const municipalityFeeds = feedsByMunicipality[municipality] || [];
            const hasFeeds = municipalityFeeds.length > 0;

            return (
              <div key={municipality} className="px-4 py-2.5 group">
                <div className="flex items-start gap-2">
                  <MapPin className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", hasFeeds ? 'text-green-500' : 'text-muted-foreground/40')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-medium", !hasFeeds && 'text-muted-foreground')}>{municipality}</span>
                      {!hasFeeds && (
                        <span className="text-xs text-muted-foreground">— geen feed</span>
                      )}
                    </div>

                    {/* Bestaande feeds */}
                    {hasFeeds && (
                      <div className="mt-1.5 space-y-1">
                        {municipalityFeeds.map(feed => (
                          <div
                            key={feed.id}
                            className="flex items-center gap-1.5 group cursor-pointer"
                            onClick={() => onEditFeed(feed)}
                          >
                            <FeedStatusIcon status={feed.status} />
                            <FeedTypeIcon feedType={feed.feedType} />
                            <span className="text-xs text-foreground group-hover:text-primary transition-colors truncate max-w-[280px]">
                              {feed.name}
                            </span>
                            {feed.itemsImported > 0 && (
                              <span className="text-xs text-muted-foreground">{feed.itemsImported} events</span>
                            )}
                            {feed.status === 'error' && (
                              <span className="text-xs text-red-500 truncate max-w-[200px]">{feed.lastErrorMessage}</span>
                            )}
                            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inline add form */}
                    {addingFor === municipality ? (
                      <InlineAddForm
                        municipality={municipality}
                        province={province}
                        onSuccess={() => setAddingFor(null)}
                        onCancel={() => setAddingFor(null)}
                        onOpenAnalyzer={() => {
                          setAddingFor(null);
                          onOpenAnalyzer(municipality, province);
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingFor(municipality)}
                        className={cn(
                          "mt-1 flex items-center gap-1 text-xs transition-all rounded px-1 py-0.5",
                          hasFeeds
                            ? "text-muted-foreground/60 hover:text-primary opacity-0 group-hover:opacity-100"
                            : "text-primary hover:text-primary/80 font-medium"
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        {hasFeeds ? 'Nog een feed toevoegen' : 'Feed toevoegen'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MunicipalityFeedView({ feeds, feedOverview, onEditFeed, onOpenAnalyzer }: MunicipalityFeedViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const feedsByMunicipality = useMemo(() => {
    const map: Record<string, RssFeed[]> = {};
    for (const feed of feeds) {
      if (!feed.municipality) continue;
      const key = feed.municipality;
      if (!map[key]) map[key] = [];
      map[key].push(feed);
    }
    return map;
  }, [feeds]);

  const totalMunicipalities = useMemo(() =>
    Object.values(NL_MUNICIPALITIES).reduce((a, b) => a + b.length, 0), []);

  const coveredMunicipalities = useMemo(() => {
    let count = 0;
    for (const [, municipalities] of Object.entries(NL_MUNICIPALITIES)) {
      for (const m of municipalities) {
        if ((feedsByMunicipality[m] || []).length > 0) count++;
      }
    }
    return count;
  }, [feedsByMunicipality]);

  const feedsWithoutMunicipality = useMemo(() =>
    feeds.filter(f => !f.municipality), [feeds]);

  const filteredProvinces = useMemo(() => {
    if (!showOnlyMissing) return NL_MUNICIPALITIES;
    const result: Record<string, string[]> = {};
    for (const [province, municipalities] of Object.entries(NL_MUNICIPALITIES)) {
      const missing = municipalities.filter(m => (feedsByMunicipality[m] || []).length === 0);
      if (missing.length > 0) result[province] = missing;
    }
    return result;
  }, [showOnlyMissing, feedsByMunicipality]);

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 bg-muted/40 rounded-lg border text-center">
          <div className="text-2xl font-bold text-primary">{coveredMunicipalities}</div>
          <div className="text-xs text-muted-foreground">Gemeentes gedekt</div>
        </div>
        <div className="p-3 bg-muted/40 rounded-lg border text-center">
          <div className="text-2xl font-bold text-amber-500">{totalMunicipalities - coveredMunicipalities}</div>
          <div className="text-xs text-muted-foreground">Nog te koppelen</div>
        </div>
        <div className="p-3 bg-muted/40 rounded-lg border text-center">
          <div className="text-2xl font-bold">{Math.round((coveredMunicipalities / totalMunicipalities) * 100)}%</div>
          <div className="text-xs text-muted-foreground">Dekking</div>
          <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${Math.round((coveredMunicipalities / totalMunicipalities) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek gemeente..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showOnlyMissing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyMissing(v => !v)}
        >
          Alleen ontbrekend
        </Button>
      </div>

      {/* Feeds zonder gemeente */}
      {feedsWithoutMunicipality.length > 0 && !searchQuery && (
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 bg-amber-50 border-b flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-700">
              {feedsWithoutMunicipality.length} feeds zonder gemeente-koppeling
            </span>
          </div>
          <div className="divide-y">
            {feedsWithoutMunicipality.slice(0, 5).map(feed => (
              <div
                key={feed.id}
                className="flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 cursor-pointer group"
                onClick={() => onEditFeed(feed)}
              >
                <FeedStatusIcon status={feed.status} />
                <span className="text-sm flex-1 truncate">{feed.name}</span>
                <span className="text-xs text-muted-foreground truncate max-w-[200px] font-mono">{feed.url}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
            ))}
            {feedsWithoutMunicipality.length > 5 && (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                + {feedsWithoutMunicipality.length - 5} meer feeds zonder gemeente
              </div>
            )}
          </div>
        </div>
      )}

      {/* Province list */}
      <div>
        {Object.entries(filteredProvinces).map(([province, municipalities]) => (
          <ProvinceRow
            key={province}
            province={province}
            municipalities={municipalities}
            feedsByMunicipality={feedsByMunicipality}
            searchQuery={searchQuery}
            onEditFeed={onEditFeed}
            onOpenAnalyzer={onOpenAnalyzer}
          />
        ))}
      </div>
    </div>
  );
}
