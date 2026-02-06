import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  Loader2, 
  X, 
  AlertCircle, 
  AlertTriangle,
  Link as LinkIcon, 
  ChevronRight,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  Type,
  FileText,
  CheckCircle2,
  XCircle,
  CircleDot,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Eye,
  Save,
  RefreshCw,
  MousePointer2,
  Globe,
} from 'lucide-react';
import { DUTCH_MUNICIPALITIES, type Municipality } from '@shared/dutch-municipalities';

type WizardStep = 'url' | 'quality' | 'enhance' | 'preview';

interface FieldQuality {
  name: string;
  label: string;
  icon: any;
  found: number;
  total: number;
  percentage: number;
  status: 'complete' | 'partial' | 'missing';
  canEnhance: boolean;
  sampleValue?: string;
}

interface AnalysisResult {
  url: string;
  method: {
    id: string;
    name: string;
    feedUrl: string;
    eventCount: number;
  };
  fields: FieldQuality[];
  sampleEvents: any[];
  suggestedName: string;
  suggestedMunicipality: string;
}

interface SimpleFeedWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedCreated?: () => void;
}

function MunicipalitySearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const filtered = search.length > 0
    ? DUTCH_MUNICIPALITIES.filter(m => 
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.province.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : [];

  const selected = DUTCH_MUNICIPALITIES.find(m => m.name === value);

  return (
    <div className="relative">
      <Input
        value={isOpen ? search : (selected?.name || '')}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Zoek gemeente..."
        className="w-full"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
          {filtered.map((m) => (
            <div
              key={m.name}
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex justify-between"
              onClick={() => {
                onChange(m.name);
                setSearch('');
                setIsOpen(false);
              }}
            >
              <span className="font-medium">{m.name}</span>
              <span className="text-muted-foreground text-sm">{m.province}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SimpleFeedWizard({ open, onOpenChange, onFeedCreated }: SimpleFeedWizardProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('url');
  const [url, setUrl] = useState('');
  const [feedName, setFeedName] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [fieldsToEnhance, setFieldsToEnhance] = useState<string[]>([]);
  const [detailPageUrl, setDetailPageUrl] = useState('');
  const [detailPageHtml, setDetailPageHtml] = useState('');
  const [activeEnhanceField, setActiveEnhanceField] = useState<string | null>(null);
  const [enhanceSelectors, setEnhanceSelectors] = useState<Record<string, string>>({});
  const [previewEvents, setPreviewEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!open) {
      setCurrentStep('url');
      setUrl('');
      setFeedName('');
      setMunicipality('');
      setAnalysisResult(null);
      setFieldsToEnhance([]);
      setDetailPageUrl('');
      setDetailPageHtml('');
      setEnhanceSelectors({});
      setPreviewEvents([]);
      setAnalyzedUrl('');
    }
  }, [open]);

  const [analyzedUrl, setAnalyzedUrl] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: async (urlToAnalyze: string) => {
      setAnalyzedUrl(urlToAnalyze);
      const response = await apiRequest('/api/admin/rss-feeds/analyze-progressive', {
        method: 'POST',
        data: { url: urlToAnalyze },
      });
      return { ...response, analyzedUrl: urlToAnalyze };
    },
    onSuccess: (data) => {
      const method = data.chosenMethod || data.steps?.find((s: any) => s.status === 'success');
      const sourceUrl = data.analyzedUrl || data.url || url;
      
      if (!method) {
        toast({
          title: 'Geen bruikbare bron gevonden',
          description: 'Probeer een andere URL of gebruik de handmatige configuratie.',
          variant: 'destructive',
        });
        return;
      }

      const quality = data.contentQuality || {};
      const sampleEvent = data.sampleEvent || {};
      
      const hasTime = sampleEvent.date && (
        sampleEvent.date.includes('T') || 
        sampleEvent.date.includes(':') ||
        quality.hasStructuredDates
      );
      
      const fields: FieldQuality[] = [
        {
          name: 'title',
          label: 'Titel',
          icon: Type,
          found: sampleEvent.title ? 1 : 0,
          total: 1,
          percentage: sampleEvent.title ? 100 : 0,
          status: sampleEvent.title ? 'complete' : 'missing',
          canEnhance: false,
          sampleValue: sampleEvent.title,
        },
        {
          name: 'date',
          label: 'Datum',
          icon: Calendar,
          found: quality.hasStructuredDates ? 1 : (quality.canExtractDates ? 1 : 0),
          total: 1,
          percentage: quality.hasStructuredDates ? 100 : (quality.canExtractDates ? 70 : 0),
          status: quality.hasStructuredDates ? 'complete' : (quality.canExtractDates ? 'partial' : 'missing'),
          canEnhance: !quality.hasStructuredDates,
          sampleValue: sampleEvent.date,
        },
        {
          name: 'location',
          label: 'Locatie',
          icon: MapPin,
          found: quality.hasStructuredLocations ? 1 : (quality.canExtractLocations ? 1 : 0),
          total: 1,
          percentage: quality.hasStructuredLocations ? 100 : (quality.canExtractLocations ? 50 : 0),
          status: quality.hasStructuredLocations ? 'complete' : (quality.canExtractLocations ? 'partial' : 'missing'),
          canEnhance: !quality.hasStructuredLocations,
          sampleValue: sampleEvent.location,
        },
        {
          name: 'image',
          label: 'Afbeelding',
          icon: ImageIcon,
          found: sampleEvent.image ? 1 : 0,
          total: 1,
          percentage: sampleEvent.image ? 100 : 0,
          status: sampleEvent.image ? 'complete' : 'missing',
          canEnhance: !sampleEvent.image,
          sampleValue: sampleEvent.image ? 'Gevonden' : undefined,
        },
        {
          name: 'time',
          label: 'Tijd',
          icon: Clock,
          found: hasTime ? 1 : 0,
          total: 1,
          percentage: hasTime ? 100 : 0,
          status: hasTime ? 'complete' : 'missing',
          canEnhance: !hasTime,
          sampleValue: hasTime ? 'In datum opgenomen' : undefined,
        },
        {
          name: 'link',
          label: 'Link',
          icon: ExternalLink,
          found: sampleEvent.link ? 1 : 0,
          total: 1,
          percentage: sampleEvent.link ? 100 : 0,
          status: sampleEvent.link ? 'complete' : 'missing',
          canEnhance: false,
          sampleValue: sampleEvent.link,
        },
      ];

      const feedUrl = method.url || method.feedUrl || sourceUrl;
      
      const result: AnalysisResult = {
        url: sourceUrl,
        method: {
          id: method.id || 'json-api',
          name: method.name || 'JSON API',
          feedUrl: feedUrl,
          eventCount: method.eventCount || 0,
        },
        fields,
        sampleEvents: data.sampleEvent ? [data.sampleEvent] : [],
        suggestedName: data.suggestedFeedName || '',
        suggestedMunicipality: data.suggestedMunicipality || '',
      };

      setAnalysisResult(result);
      setFeedName(result.suggestedName);
      setMunicipality(result.suggestedMunicipality);
      
      if (result.sampleEvents[0]?.link) {
        setDetailPageUrl(result.sampleEvents[0].link);
      }
      
      setCurrentStep('quality');
    },
    onError: (error: any) => {
      toast({
        title: 'Analyse mislukt',
        description: error.message || 'Kon de URL niet analyseren',
        variant: 'destructive',
      });
    },
  });

  const fetchDetailPageMutation = useMutation({
    mutationFn: async (pageUrl: string) => {
      const response = await apiRequest('/api/admin/visual-configurator/fetch-page', {
        method: 'POST',
        data: { url: pageUrl },
      });
      return response;
    },
    onSuccess: (data) => {
      setDetailPageHtml(data.html || '');
    },
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!analysisResult) throw new Error('Geen analyse resultaat');
      
      const response = await apiRequest('/api/admin/rss-feeds/preview', {
        method: 'POST',
        data: {
          url: analysisResult.method.feedUrl,
          feedType: analysisResult.method.id === 'scraper' ? 'scraper' : 'json',
          municipality: municipality,
          limit: 5,
          enhanceSelectors: Object.keys(enhanceSelectors).length > 0 ? enhanceSelectors : undefined,
        },
      });
      return response;
    },
    onSuccess: (data) => {
      setPreviewEvents(data.items || []);
    },
  });

  const saveFeedMutation = useMutation({
    mutationFn: async () => {
      if (!analysisResult) throw new Error('Geen analyse resultaat');
      
      const response = await apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: feedName || analysisResult.suggestedName || 'Nieuwe Feed',
          url: analysisResult.method.feedUrl,
          feedType: analysisResult.method.id === 'scraper' ? 'scraper' : 
                    ['json-api', 'json-ld'].includes(analysisResult.method.id) ? 'json' : 'rss',
          municipality: municipality,
          enhanceSelectors: Object.keys(enhanceSelectors).length > 0 ? enhanceSelectors : undefined,
          isActive: true,
        },
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Feed aangemaakt',
        description: `"${feedName}" is succesvol opgeslagen en begint met importeren.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      onFeedCreated?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Opslaan mislukt',
        description: error.message || 'Kon de feed niet opslaan',
        variant: 'destructive',
      });
    },
  });

  const handleAnalyze = () => {
    if (!url.trim()) return;
    analyzeMutation.mutate(url.trim());
  };

  const handleGoToEnhance = () => {
    const missing = analysisResult?.fields.filter(f => f.canEnhance && f.status !== 'complete') || [];
    setFieldsToEnhance(missing.map(f => f.name));
    
    if (detailPageUrl) {
      fetchDetailPageMutation.mutate(detailPageUrl);
    }
    
    setCurrentStep('enhance');
  };

  const handleSkipEnhance = () => {
    previewMutation.mutate();
    setCurrentStep('preview');
  };

  const handleGoToPreview = () => {
    previewMutation.mutate();
    setCurrentStep('preview');
  };

  const handleSave = () => {
    saveFeedMutation.mutate();
  };

  const getStepNumber = (step: WizardStep): number => {
    const steps: WizardStep[] = ['url', 'quality', 'enhance', 'preview'];
    return steps.indexOf(step) + 1;
  };

  const renderStepIndicator = () => {
    const steps = [
      { id: 'url', label: 'URL Invoeren' },
      { id: 'quality', label: 'Data Kwaliteit' },
      { id: 'enhance', label: 'Aanvullen' },
      { id: 'preview', label: 'Opslaan' },
    ];

    return (
      <div className="flex items-center gap-2 mb-6">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isPast = getStepNumber(currentStep) > index + 1;
          
          return (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-primary text-primary-foreground' 
                  : isPast 
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-500'
              }`}>
                {isPast ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs">
                    {index + 1}
                  </span>
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-gray-300 mx-1" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderUrlStep = () => (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Globe className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">Welke agenda wil je importeren?</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Voer de URL van de evenementen pagina in. We detecteren automatisch de beste manier om events te importeren.
        </p>
      </div>

      <div className="max-w-xl mx-auto space-y-4">
        <div className="space-y-2">
          <Label htmlFor="url">Website URL</Label>
          <div className="flex gap-2">
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/agenda"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <Button 
              onClick={handleAnalyze}
              disabled={!url.trim() || analyzeMutation.isPending}
            >
              {analyzeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyseren...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyseer
                </>
              )}
            </Button>
          </div>
        </div>

        {analyzeMutation.isPending && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <div>
                  <p className="font-medium">Website wordt geanalyseerd...</p>
                  <p className="text-sm text-muted-foreground">
                    We zoeken naar JSON API's, RSS feeds en event data
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderQualityStep = () => {
    if (!analysisResult) return null;

    const completeFields = analysisResult.fields.filter(f => f.status === 'complete').length;
    const partialFields = analysisResult.fields.filter(f => f.status === 'partial').length;
    const missingFields = analysisResult.fields.filter(f => f.status === 'missing' && f.canEnhance);
    const overallQuality = Math.round((completeFields * 100 + partialFields * 50) / analysisResult.fields.length);

    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800">
                {analysisResult.method.eventCount} events gevonden via {analysisResult.method.name}
              </h3>
              <p className="text-green-700 mt-1">
                De analyse is geslaagd. Hieronder zie je welke gegevens beschikbaar zijn.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Feed naam</Label>
            <Input
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Geef de feed een naam"
            />
          </div>
          <div className="space-y-2">
            <Label>Gemeente</Label>
            <MunicipalitySearch
              value={municipality}
              onChange={setMunicipality}
            />
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Data Kwaliteit</CardTitle>
              <Badge variant={overallQuality >= 80 ? 'default' : overallQuality >= 50 ? 'secondary' : 'destructive'}>
                {overallQuality}% compleet
              </Badge>
            </div>
            <CardDescription>
              Overzicht van welke event gegevens zijn gevonden
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysisResult.fields.map((field) => {
                const Icon = field.icon;
                return (
                  <div 
                    key={field.name}
                    className={`flex items-center gap-4 p-3 rounded-lg border-2 ${
                      field.status === 'complete' 
                        ? 'border-green-200 bg-green-50' 
                        : field.status === 'partial'
                          ? 'border-amber-200 bg-amber-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      field.status === 'complete' 
                        ? 'bg-green-100 text-green-700' 
                        : field.status === 'partial'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{field.label}</span>
                        {field.status === 'complete' && (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        )}
                        {field.status === 'partial' && (
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                        )}
                        {field.status === 'missing' && (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      {field.sampleValue && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {field.sampleValue}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      {field.status === 'complete' ? (
                        <span className="text-green-700 font-medium">Gevonden</span>
                      ) : field.status === 'partial' ? (
                        <span className="text-amber-700 font-medium">Deels</span>
                      ) : field.canEnhance ? (
                        <span className="text-gray-500">Kan aangevuld</span>
                      ) : (
                        <span className="text-gray-400">Niet gevonden</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {missingFields.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>{missingFields.length} veld(en)</strong> kunnen worden aangevuld door de detail pagina's te scrapen. 
              Dit verbetert de kwaliteit van je events.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep('url')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipEnhance}>
              Overslaan
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            {missingFields.length > 0 && (
              <Button onClick={handleGoToEnhance}>
                <Sparkles className="h-4 w-4 mr-2" />
                Velden aanvullen
              </Button>
            )}
            {missingFields.length === 0 && (
              <Button onClick={handleSkipEnhance}>
                Naar preview
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const [autoDetecting, setAutoDetecting] = useState(false);

  const handleAutoDetectSelectors = async () => {
    if (!detailPageHtml || fieldsToEnhance.length === 0) return;
    setAutoDetecting(true);
    try {
      const response = await apiRequest('/api/admin/visual-configurator/analyze-detail-selectors', {
        method: 'POST',
        data: {
          html: detailPageHtml.substring(0, 30000),
          fields: fieldsToEnhance,
          url: detailPageUrl,
        },
      });
      if (response.error) {
        toast({
          title: 'Auto-detect deels mislukt',
          description: response.error,
          variant: 'destructive',
        });
      }
      if (response.selectors && Object.keys(response.selectors).length > 0) {
        setEnhanceSelectors(prev => ({ ...prev, ...response.selectors }));
        toast({
          title: 'Selectors gevonden',
          description: `${Object.keys(response.selectors).length} veld(en) automatisch gedetecteerd`,
        });
      } else if (!response.error) {
        toast({
          title: 'Geen selectors gevonden',
          description: 'Probeer de CSS selectors handmatig in te vullen',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Auto-detect failed:', error);
      toast({
        title: 'Auto-detect mislukt',
        description: error.message || 'Kon de velden niet automatisch detecteren',
        variant: 'destructive',
      });
    }
    setAutoDetecting(false);
  };

  const renderEnhanceStep = () => {
    const fieldsToShow = analysisResult?.fields.filter(f => fieldsToEnhance.includes(f.name)) || [];

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
              <MousePointer2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800">
                Ontbrekende velden aanvullen
              </h3>
              <p className="text-blue-700 mt-1">
                Laad een voorbeeld event pagina en selecteer waar de ontbrekende gegevens staan.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Detail pagina URL</Label>
            <div className="flex gap-2">
              <Input
                value={detailPageUrl}
                onChange={(e) => setDetailPageUrl(e.target.value)}
                placeholder="https://example.com/event/123"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => detailPageUrl && fetchDetailPageMutation.mutate(detailPageUrl)}
                disabled={!detailPageUrl || fetchDetailPageMutation.isPending}
              >
                {fetchDetailPageMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {fetchDetailPageMutation.isPending && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <p className="text-blue-800">Detail pagina wordt opgehaald...</p>
            </div>
          )}

          {detailPageHtml && (
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">Pagina geladen</span>
                    <span className="text-sm text-green-700">({Math.round(detailPageHtml.length / 1024)} KB)</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAutoDetectSelectors}
                    disabled={autoDetecting}
                  >
                    {autoDetecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Detecteren...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Auto-detect velden
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {fetchDetailPageMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Kon de pagina niet laden: {(fetchDetailPageMutation.error as any)?.message || 'Onbekende fout'}
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aan te vullen velden</CardTitle>
              <CardDescription>
                {detailPageHtml 
                  ? 'Klik op een veld om de CSS selector in te stellen, of gebruik auto-detect'
                  : 'Laad eerst een detail pagina hierboven'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {fieldsToShow.map((field) => {
                  const Icon = field.icon;
                  const hasSelector = !!enhanceSelectors[field.name];
                  const isActive = activeEnhanceField === field.name;
                  
                  return (
                    <div key={field.name}>
                      <div
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          isActive 
                            ? 'border-blue-500 bg-blue-50' 
                            : hasSelector
                              ? 'border-green-300 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setActiveEnhanceField(isActive ? null : field.name)}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          hasSelector ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <span className="font-medium">{field.label}</span>
                          {hasSelector && (
                            <code className="text-xs text-green-700 block truncate">
                              {enhanceSelectors[field.name]}
                            </code>
                          )}
                        </div>
                        {hasSelector ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <CircleDot className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      
                      {isActive && (
                        <div className="ml-11 mt-2 mb-1 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              value={enhanceSelectors[field.name] || ''}
                              onChange={(e) => setEnhanceSelectors(prev => ({ ...prev, [field.name]: e.target.value }))}
                              placeholder={field.name === 'date' ? '.event-date, time' : 
                                          field.name === 'location' ? '.venue, .location' :
                                          field.name === 'image' ? '.event-image img, .hero-image img' :
                                          field.name === 'time' ? '.event-time, .time' : 
                                          '.selector'}
                              className="flex-1 text-sm"
                            />
                            {enhanceSelectors[field.name] && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEnhanceSelectors(prev => {
                                    const next = { ...prev };
                                    delete next[field.name];
                                    return next;
                                  });
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={() => setCurrentStep('quality')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
          <Button onClick={handleGoToPreview}>
            Naar preview
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderPreviewStep = () => (
    <div className="space-y-6">
      {previewMutation.isPending ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Events worden opgehaald...</p>
          <p className="text-muted-foreground">Dit kan even duren</p>
        </div>
      ) : (
        <>
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center shrink-0">
                <Eye className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  Klaar om op te slaan!
                </h3>
                <p className="text-muted-foreground mt-1">
                  Hieronder zie je een voorbeeld van de te importeren events. 
                  Na opslaan worden alle {analysisResult?.method.eventCount || 0} events geïmporteerd.
                </p>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Voorbeeld Events ({previewEvents.length})</CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => previewMutation.mutate()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Vernieuwen
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {previewEvents.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3">
                    {previewEvents.map((event, i) => (
                      <div key={i} className="flex gap-3 p-3 border rounded-lg bg-white">
                        {event.imageUrl && (
                          <img 
                            src={event.imageUrl} 
                            alt={event.title}
                            className="w-20 h-20 object-cover rounded shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{event.title}</h4>
                          {event.startTime && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(event.startTime).toLocaleDateString('nl-NL', { 
                                day: 'numeric', month: 'long', year: 'numeric' 
                              })}
                            </p>
                          )}
                          {event.location && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </p>
                          )}
                          {!event.isComplete && event.missingFields?.length > 0 && (
                            <div className="flex gap-1 mt-2">
                              {event.missingFields.map((field: string) => (
                                <Badge key={field} variant="outline" className="text-xs">
                                  {field} mist
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Geen events gevonden in de preview</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Samenvatting</h4>
                  <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Feed: <strong>{feedName || 'Naamloos'}</strong></li>
                    <li>• Gemeente: <strong>{municipality || 'Niet ingesteld'}</strong></li>
                    <li>• Methode: <strong>{analysisResult?.method.name}</strong></li>
                    <li>• Verwachte events: <strong>{analysisResult?.method.eventCount || 0}</strong></li>
                  </ul>
                </div>
                <Button 
                  size="lg"
                  onClick={handleSave}
                  disabled={saveFeedMutation.isPending}
                >
                  {saveFeedMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Opslaan...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Feed Opslaan
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={() => setCurrentStep('quality')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            Nieuwe Feed Toevoegen
          </DialogTitle>
          <DialogDescription>
            Importeer events van een externe agenda in 4 eenvoudige stappen
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0">
          {renderStepIndicator()}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 min-h-0">
          {currentStep === 'url' && renderUrlStep()}
          {currentStep === 'quality' && renderQualityStep()}
          {currentStep === 'enhance' && renderEnhanceStep()}
          {currentStep === 'preview' && renderPreviewStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
