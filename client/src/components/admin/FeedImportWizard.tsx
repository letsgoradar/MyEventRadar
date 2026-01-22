import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Check,
  Loader2,
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  Link as LinkIcon,
  Type,
  FileText,
  MousePointer2,
  Save,
  RefreshCw,
  Eye,
  Crosshair,
  Building2,
  ChevronRight,
  ChevronLeft,
  Globe,
  Sparkles,
  List,
} from 'lucide-react';
import { DUTCH_MUNICIPALITIES, type Municipality } from '@shared/dutch-municipalities';

interface ProgressiveStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'checking' | 'success' | 'not_found' | 'error';
  result: {
    viable: boolean;
    feedUrl?: string;
    eventCount?: number;
    reason: string;
    sampleEvent?: any;
  } | null;
}

interface ProgressiveAnalysisResult {
  url: string;
  steps: ProgressiveStep[];
  chosenMethod: {
    id: string;
    name: string;
    url: string;
    eventCount: number;
    reason: string;
    pros: string;
  } | null;
  sampleEvent: {
    title: string;
    description?: string;
    date?: string;
    image?: string | null;
    link?: string | null;
    location?: string | null;
  } | null;
  suggestedFeedName: string | null;
  suggestedMunicipality: string | null;
  importRules: string;
  isComplete: boolean;
}

interface SelectorConfig {
  eventCard: string;
  title?: string;
  description?: string;
  date?: string;
  time?: string;
  location?: string;
  venue?: string;
  venueDescription?: string;
  address?: string;
  image?: string;
  link?: string;
}

interface FeedImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedCreated?: () => void;
  initialUrl?: string;
}

type WizardStep = 'analyze' | 'configure' | 'preview';

const FIELD_CONFIG: { id: keyof Omit<SelectorConfig, 'eventCard'>; name: string; required: boolean; description: string; icon: React.ReactNode; group: 'overview' | 'detail' }[] = [
  { id: 'title', name: 'Titel', required: true, description: 'Naam van het evenement', icon: <Type className="h-4 w-4" />, group: 'overview' },
  { id: 'date', name: 'Datum', required: true, description: 'Startdatum (en eventueel einddatum)', icon: <Calendar className="h-4 w-4" />, group: 'overview' },
  { id: 'image', name: 'Afbeelding', required: false, description: 'Thumbnail/afbeelding', icon: <ImageIcon className="h-4 w-4" />, group: 'overview' },
  { id: 'link', name: 'Detail Link', required: true, description: 'Link naar de detail pagina', icon: <LinkIcon className="h-4 w-4" />, group: 'overview' },
  { id: 'location', name: 'Locatie', required: true, description: 'Adres of GPS (VERPLICHT)', icon: <MapPin className="h-4 w-4" />, group: 'detail' },
  { id: 'venue', name: 'Venue', required: false, description: 'Naam van de locatie', icon: <Building2 className="h-4 w-4" />, group: 'detail' },
  { id: 'time', name: 'Tijd', required: false, description: 'Start- en eindtijd', icon: <Clock className="h-4 w-4" />, group: 'detail' },
  { id: 'description', name: 'Beschrijving', required: false, description: 'Omschrijving', icon: <FileText className="h-4 w-4" />, group: 'detail' },
];

function MunicipalitySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [search, setSearch] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (value && value !== search) {
      setSearch(value);
    }
  }, [value]);
  
  const filteredMunicipalities = DUTCH_MUNICIPALITIES
    .filter(m => {
      if (!search.trim()) return true;
      const searchLower = search.toLowerCase();
      return m.name.toLowerCase().includes(searchLower) ||
             m.province.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 50);

  const handleSelect = (municipality: Municipality) => {
    setSearch(municipality.name);
    onChange(municipality.name);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Zoek gemeente..."
        className="h-8 text-xs"
      />
      {isOpen && filteredMunicipalities.length > 0 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto">
            {filteredMunicipalities.map((m) => (
              <button
                key={m.name}
                type="button"
                className="w-full px-3 py-2 text-left text-xs hover:bg-muted flex justify-between"
                onClick={() => handleSelect(m)}
              >
                <span>{m.name}</span>
                <span className="text-muted-foreground">{m.province}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function FeedImportWizard({ open, onOpenChange, onFeedCreated, initialUrl = '' }: FeedImportWizardProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('analyze');
  const [overviewUrl, setOverviewUrl] = useState(initialUrl);
  const [detailExampleUrl, setDetailExampleUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<ProgressiveAnalysisResult | null>(null);
  const [feedName, setFeedName] = useState('');
  const [municipality, setMunicipality] = useState('');
  
  const [iframeLoading, setIframeLoading] = useState(false);
  const [iframeError, setIframeError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<'eventCard' | keyof Omit<SelectorConfig, 'eventCard'> | null>(null);
  const [selectors, setSelectors] = useState<SelectorConfig>({ eventCard: '' });
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [validationResult, setValidationResult] = useState<{ totalFound: number; previewEvents: any[] } | null>(null);
  const [messageNonce] = useState<string>(() => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [highlightedSelector, setHighlightedSelector] = useState<string | null>(null);
  const [activePageContext, setActivePageContext] = useState<'overview' | 'detail'>('overview');

  useEffect(() => {
    if (initialUrl) {
      setOverviewUrl(initialUrl);
    }
  }, [initialUrl]);

  const analyzeMutation = useMutation({
    mutationFn: async (urlToAnalyze: string): Promise<ProgressiveAnalysisResult> => {
      return apiRequest('/api/admin/rss-feeds/analyze-progressive', {
        method: 'POST',
        data: { url: urlToAnalyze },
      });
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      if (data.suggestedFeedName) {
        setFeedName(data.suggestedFeedName);
      }
      if (data.suggestedMunicipality) {
        setMunicipality(data.suggestedMunicipality);
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Analyse mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  const createFeedMutation = useMutation({
    mutationFn: async () => {
      if (currentStep === 'configure' || !analysisResult?.chosenMethod) {
        const parsedUrl = new URL(overviewUrl);
        return apiRequest('/api/admin/visual-configurator/save-config', {
          method: 'POST',
          data: {
            url: overviewUrl,
            domain: parsedUrl.hostname,
            feedName: feedName || 'Nieuwe Feed',
            municipality: municipality,
            selectors: selectors,
          },
        });
      }
      
      const getFeedType = (methodId: string): string => {
        switch (methodId) {
          case 'json-api':
          case 'json-ld':
            return 'json';
          case 'scraper':
            return 'scraper';
          default:
            return 'rss';
        }
      };
      
      return apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: feedName || analysisResult.suggestedFeedName || 'Nieuwe Feed',
          url: analysisResult.chosenMethod.url,
          feedType: getFeedType(analysisResult.chosenMethod.id),
          municipality: municipality || analysisResult.suggestedMunicipality || '',
          defaultCategory: 'Gezellig en Sociaal',
          autoCreateEvents: true,
          updateFrequencyMinutes: 60,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Feed aangemaakt',
        description: 'De feed is succesvol toegevoegd.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      onFeedCreated?.();
      handleClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Fout bij aanmaken',
        description: error.message || 'Kon de feed niet aanmaken.',
        variant: 'destructive',
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/visual-configurator/test', {
        method: 'POST',
        data: {
          url: overviewUrl,
          selectors: selectors,
        },
      });
    },
    onSuccess: (data: any) => {
      setValidationResult(data);
      if (data.totalFound > 0) {
        setCurrentStep('preview');
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Validatie mislukt',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const [pageHtml, setPageHtml] = useState<string | null>(null);
  
  const injectHighlightScript = () => {
    return `
      <script>
        const VFC_NONCE = '${messageNonce}';
        
        // Fix lazy-loaded images
        (function fixImages() {
          document.querySelectorAll('img').forEach(img => {
            const lazySrc = img.getAttribute('data-src') || 
                           img.getAttribute('data-lazy-src') || 
                           img.getAttribute('data-original') ||
                           img.getAttribute('data-lazy');
            const currentSrc = img.src || '';
            const isPlaceholder = !currentSrc || 
                                  currentSrc.includes('placeholder') || 
                                  currentSrc.includes('blank') ||
                                  currentSrc.includes('data:image');
            if (lazySrc && (isPlaceholder || !img.src)) {
              img.src = lazySrc;
            }
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            img.style.display = img.style.display === 'none' ? 'block' : img.style.display;
            img.removeAttribute('loading');
          });
        })();
        
        function highlightElements(selector) {
          document.querySelectorAll('.vfc-highlight').forEach(el => {
            el.classList.remove('vfc-highlight');
            el.style.outline = '';
          });
          if (selector) {
            document.querySelectorAll(selector).forEach(el => {
              el.classList.add('vfc-highlight');
              el.style.outline = '3px solid #3b82f6';
              el.style.outlineOffset = '2px';
            });
          }
        }
        
        document.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const target = e.target;
          let selector = '';
          if (target.id) {
            selector = '#' + target.id;
          } else if (target.className && typeof target.className === 'string') {
            const classes = target.className.split(' ').filter(c => c && !c.startsWith('vfc-'));
            if (classes.length > 0) selector = '.' + classes.join('.');
          }
          if (!selector) selector = target.tagName.toLowerCase();
          const sampleText = target.textContent?.substring(0, 100) || '';
          window.parent.postMessage({
            type: 'vfc_elementClicked',
            nonce: VFC_NONCE,
            selector: selector,
            sampleText: sampleText,
            tagName: target.tagName,
          }, '*');
        }, true);
        
        document.addEventListener('mouseover', function(e) {
          e.target.style.outline = '2px dashed #93c5fd';
          e.target.style.cursor = 'crosshair';
        }, true);
        
        document.addEventListener('mouseout', function(e) {
          if (!e.target.classList.contains('vfc-highlight')) {
            e.target.style.outline = '';
          }
          e.target.style.cursor = '';
        }, true);
        
        window.addEventListener('message', function(e) {
          if (e.data.type === 'vfc_highlight' && e.data.nonce === VFC_NONCE) {
            highlightElements(e.data.selector);
          }
        });
      </script>
      <style>
        .vfc-highlight { outline: 3px solid #3b82f6 !important; outline-offset: 2px !important; }
        img { display: block !important; visibility: visible !important; opacity: 1 !important; }
      </style>
    `;
  };
  
  const loadIframeForUrl = async (targetUrl: string) => {
    setIframeLoading(true);
    setIframeError(null);
    
    try {
      const response = await apiRequest('/api/admin/visual-configurator/fetch-page', {
        method: 'POST',
        data: { url: targetUrl },
      });
      
      if (response.html) {
        let html = response.html;
        const script = injectHighlightScript();
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${script}</body>`);
        } else {
          html = html + script;
        }
        setPageHtml(html);
      } else {
        setIframeError('Kon de pagina niet laden');
      }
    } catch (err: any) {
      setIframeError(err.message || 'Fout bij laden');
    } finally {
      setIframeLoading(false);
    }
  };

  const handleAnalyze = () => {
    if (!overviewUrl.trim()) return;
    setAnalysisResult(null);
    setCurrentStep('analyze');
    analyzeMutation.mutate(overviewUrl.trim());
  };

  const handleClose = () => {
    setOverviewUrl('');
    setDetailExampleUrl('');
    setAnalysisResult(null);
    setFeedName('');
    setMunicipality('');
    setCurrentStep('analyze');
    setSelectors({ eventCard: '' });
    setSampleValues({});
    setPageHtml(null);
    setValidationResult(null);
    setActivePageContext('overview');
    onOpenChange(false);
  };

  const goToConfigureStep = () => {
    setPageHtml(null);
    setActivePageContext('overview');
    setCurrentStep('configure');
    if (overviewUrl) {
      loadIframeForUrl(overviewUrl);
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.nonce !== messageNonce) {
        return;
      }
      if (event.data.type === 'vfc_elementClicked' && selectionMode) {
        const { selector, sampleText } = event.data;
        
        if (selectionMode === 'eventCard') {
          setSelectors(prev => ({ ...prev, eventCard: selector }));
          setSampleValues(prev => ({ ...prev, eventCard: sampleText }));
        } else {
          setSelectors(prev => ({ ...prev, [selectionMode]: selector }));
          setSampleValues(prev => ({ ...prev, [selectionMode]: sampleText }));
        }
        setSelectionMode(null);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectionMode, messageNonce]);

  useEffect(() => {
    if (iframeRef.current && highlightedSelector) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'vfc_highlight',
        nonce: messageNonce,
        selector: highlightedSelector,
      }, '*');
    }
  }, [highlightedSelector, messageNonce]);

  const handleFieldHover = (fieldId: string | null) => {
    if (fieldId && selectors[fieldId as keyof SelectorConfig]) {
      setHighlightedSelector(selectors[fieldId as keyof SelectorConfig] || null);
    } else if (fieldId === 'eventCard' && selectors.eventCard) {
      setHighlightedSelector(selectors.eventCard);
    } else {
      setHighlightedSelector(null);
    }
  };

  const getStepIcon = (status: ProgressiveStep['status']) => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'not_found':
        return <X className="w-4 h-4 text-gray-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getValidationIssues = () => {
    const issues: { type: 'error' | 'warning'; message: string }[] = [];
    if (!selectors.eventCard) {
      issues.push({ type: 'error', message: 'Event container is verplicht' });
    }
    if (!selectors.title) {
      issues.push({ type: 'error', message: 'Titel is verplicht' });
    }
    if (!selectors.date) {
      issues.push({ type: 'error', message: 'Datum is verplicht' });
    }
    if (!selectors.link) {
      issues.push({ type: 'error', message: 'Detail link is verplicht' });
    }
    if (!selectors.location) {
      issues.push({ type: 'error', message: 'Locatie is verplicht (geen fallback)' });
    }
    return issues;
  };

  const canProceedToValidation = () => {
    const issues = getValidationIssues();
    return issues.filter(i => i.type === 'error').length === 0;
  };

  const needsVisualConfig = analysisResult && (
    analysisResult.chosenMethod?.id === 'scraper' || 
    !analysisResult.chosenMethod
  );

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-4 pb-4 border-b">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        currentStep === 'analyze' ? 'bg-blue-100 text-blue-700 font-medium' : 
        analysisResult ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}>
        <Globe className="w-4 h-4" />
        <span>1. Analyseren</span>
        {analysisResult && <Check className="w-4 h-4" />}
      </div>
      
      <ChevronRight className="w-4 h-4 text-gray-400" />
      
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        currentStep === 'configure' ? 'bg-purple-100 text-purple-700 font-medium' : 
        currentStep === 'preview' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}>
        <Crosshair className="w-4 h-4" />
        <span>2. Configureren</span>
        {currentStep === 'preview' && <Check className="w-4 h-4" />}
      </div>
      
      <ChevronRight className="w-4 h-4 text-gray-400" />
      
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
        currentStep === 'preview' ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500'
      }`}>
        <Eye className="w-4 h-4" />
        <span>3. Valideren</span>
      </div>
    </div>
  );

  const renderAnalyzeStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">Overzichtspagina URL (waar alle events staan)</Label>
        <div className="flex gap-2">
          <Input
            id="url"
            placeholder="bijv. visittiel.nl of https://agenda.tilburg.nl"
            value={overviewUrl}
            onChange={(e) => setOverviewUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            disabled={analyzeMutation.isPending}
          />
          <Button 
            onClick={handleAnalyze} 
            disabled={!overviewUrl.trim() || analyzeMutation.isPending}
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyseer
              </>
            )}
          </Button>
        </div>
      </div>

      {(analyzeMutation.isPending || analysisResult) && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Import opties</Label>
          <div className="border rounded-lg divide-y">
            {(analysisResult?.steps || [
              { id: 'json-api', name: 'JSON API', status: 'checking', result: null },
              { id: 'rss', name: 'RSS/Atom Feed', status: 'checking', result: null },
              { id: 'ical', name: 'iCal/ICS', status: 'checking', result: null },
              { id: 'json-ld', name: 'JSON-LD Schema', status: 'checking', result: null },
              { id: 'scraper', name: 'HTML Scraper', status: 'checking', result: null },
            ] as ProgressiveStep[]).map((step) => (
              <div key={step.id} className="px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getStepIcon(step.status)}
                  <span className="text-sm font-medium">{step.name}</span>
                </div>
                {step.result?.eventCount && step.result.eventCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {step.result.eventCount} events
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {analysisResult?.isComplete && analysisResult.chosenMethod && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>{analysisResult.chosenMethod.name}</strong> gevonden met {analysisResult.chosenMethod.eventCount} events.
            {needsVisualConfig && (
              <span className="block mt-1 text-sm">
                Klik op "Configureren" om de velden te selecteren.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {analysisResult?.isComplete && !analysisResult.chosenMethod && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Geen automatische methode gevonden. Gebruik de visuele configurator om handmatig velden te selecteren.
          </AlertDescription>
        </Alert>
      )}

      {analysisResult?.isComplete && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Feed naam</Label>
            <Input
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Naam voor deze feed"
            />
          </div>
          <div className="space-y-2">
            <Label>Gemeente</Label>
            <MunicipalitySearch value={municipality} onChange={setMunicipality} />
          </div>
        </div>
      )}
    </div>
  );

  const renderConfigureStep = () => (
    <div className="space-y-3">
      <div className="flex gap-2 p-2 bg-gray-100 rounded-lg">
        <Button
          variant={activePageContext === 'overview' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => {
            setActivePageContext('overview');
            if (overviewUrl) loadIframeForUrl(overviewUrl);
          }}
        >
          <List className="w-4 h-4 mr-2" />
          Overzichtspagina
          {selectors.eventCard && <Check className="w-3 h-3 ml-2 text-green-400" />}
        </Button>
        <Button
          variant={activePageContext === 'detail' ? 'default' : 'ghost'}
          size="sm"
          className="flex-1"
          onClick={() => {
            setActivePageContext('detail');
            if (detailExampleUrl) loadIframeForUrl(detailExampleUrl);
          }}
        >
          <FileText className="w-4 h-4 mr-2" />
          Detail pagina
        </Button>
      </div>

      {activePageContext === 'overview' && (
        <div className="text-xs bg-blue-50 p-2 rounded flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <span><strong>Overzichtspagina:</strong> {overviewUrl}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6" onClick={() => loadIframeForUrl(overviewUrl)}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      )}

      {activePageContext === 'detail' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="bijv. https://site.nl/agenda/voorbeeld-event"
              value={detailExampleUrl}
              onChange={(e) => setDetailExampleUrl(e.target.value)}
              className="text-xs"
            />
            <Button 
              variant="outline"
              size="sm"
              onClick={() => loadIframeForUrl(detailExampleUrl)}
              disabled={!detailExampleUrl.trim() || iframeLoading}
            >
              {iframeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Voer de URL van een voorbeeld event in om detail velden te configureren</p>
        </div>
      )}
      
      <div className="flex gap-4 h-[calc(95vh-280px)]">
        <div className="flex-1 border rounded-lg overflow-hidden relative">
          {iframeLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
        {iframeError && (
          <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
            <div className="text-center p-4">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700">{iframeError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => loadIframeForUrl(activePageContext === 'overview' ? overviewUrl : detailExampleUrl)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Opnieuw
              </Button>
            </div>
          </div>
        )}
        {pageHtml && (
          <iframe
            ref={iframeRef}
            srcDoc={pageHtml}
            className="w-full h-full border-0"
            onLoad={() => setIframeLoading(false)}
            sandbox="allow-scripts allow-same-origin"
          />
        )}
        {selectionMode && (
          <div className="absolute top-2 left-2 right-2 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm flex items-center gap-2 z-20">
            <MousePointer2 className="w-4 h-4" />
            Klik op een {selectionMode === 'eventCard' ? 'event container' : selectionMode} in de pagina
            <Button variant="ghost" size="sm" className="ml-auto text-white hover:bg-purple-700" onClick={() => setSelectionMode(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="w-80 overflow-y-auto space-y-4">
        <Card>
          <CardContent className="p-3 space-y-3">
            <div className={`space-y-2 p-2 rounded ${activePageContext === 'overview' ? 'bg-blue-50 border border-blue-200' : 'opacity-50'}`}>
              <Label className="text-xs font-semibold flex items-center gap-2 text-blue-700">
                <List className="w-4 h-4" />
                Overzichtspagina velden
                {activePageContext !== 'overview' && <span className="text-xs font-normal text-gray-500 ml-auto">Wissel naar Overzichtspagina</span>}
              </Label>
              <Button
                variant={selectors.eventCard ? "secondary" : "outline"}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => setSelectionMode('eventCard')}
                onMouseEnter={() => handleFieldHover('eventCard')}
                onMouseLeave={() => handleFieldHover(null)}
                disabled={activePageContext !== 'overview'}
              >
                {selectors.eventCard ? (
                  <><Check className="w-3 h-3 mr-2 text-green-600" />{selectors.eventCard.slice(0, 25)}...</>
                ) : (
                  <><Crosshair className="w-3 h-3 mr-2" />Event Container *</>
                )}
              </Button>
              <div className="space-y-1">
                {FIELD_CONFIG.filter(f => f.group === 'overview').map((field) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Button
                      variant={selectors[field.id] ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1 justify-start text-xs h-7"
                      onClick={() => setSelectionMode(field.id)}
                      onMouseEnter={() => handleFieldHover(field.id)}
                      onMouseLeave={() => handleFieldHover(null)}
                      disabled={activePageContext !== 'overview'}
                    >
                      {field.icon}
                      <span className="ml-1">{field.name}</span>
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                      {selectors[field.id] && <Check className="w-3 h-3 ml-auto text-green-600" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`space-y-2 p-2 rounded ${activePageContext === 'detail' ? 'bg-purple-50 border border-purple-200' : 'opacity-50'}`}>
              <Label className="text-xs font-semibold text-purple-700 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Detail pagina velden
                {activePageContext !== 'detail' && <span className="text-xs font-normal text-gray-500 ml-auto">Wissel naar Detail</span>}
              </Label>
              <div className="space-y-1">
                {FIELD_CONFIG.filter(f => f.group === 'detail').map((field) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <Button
                      variant={selectors[field.id] ? "secondary" : "outline"}
                      size="sm"
                      className="flex-1 justify-start text-xs h-7"
                      onClick={() => setSelectionMode(field.id)}
                      onMouseEnter={() => handleFieldHover(field.id)}
                      onMouseLeave={() => handleFieldHover(null)}
                      disabled={activePageContext !== 'detail'}
                    >
                      {field.icon}
                      <span className="ml-1">{field.name}</span>
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                      {selectors[field.id] && <Check className="w-3 h-3 ml-auto text-green-600" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {getValidationIssues().length > 0 && (
              <div className="border-t pt-3 space-y-1">
                {getValidationIssues().map((issue, i) => (
                  <div key={i} className={`text-xs flex items-center gap-1 ${
                    issue.type === 'error' ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {issue.type === 'error' ? <AlertCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                    {issue.message}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-4">
      {validationResult && (
        <Alert className="bg-green-50 border-green-200">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <strong>{validationResult.totalFound} events</strong> gevonden met de geconfigureerde selectors!
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Feed naam</Label>
          <Input
            value={feedName}
            onChange={(e) => setFeedName(e.target.value)}
            placeholder="Naam voor deze feed"
          />
        </div>
        <div className="space-y-2">
          <Label>Gemeente</Label>
          <MunicipalitySearch value={municipality} onChange={setMunicipality} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Geconfigureerde selectors</Label>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-muted rounded">
            <span className="font-medium">Container:</span> {selectors.eventCard || '-'}
          </div>
          {FIELD_CONFIG.map(field => (
            <div key={field.id} className="p-2 bg-muted rounded">
              <span className="font-medium">{field.name}:</span> {selectors[field.id] || '-'}
            </div>
          ))}
        </div>
      </div>

      {validationResult?.previewEvents && validationResult.previewEvents.length > 0 && (
        <div className="space-y-2">
          <Label>Voorbeeld events</Label>
          <ScrollArea className="h-48 border rounded-lg p-3">
            <div className="space-y-2">
              {validationResult.previewEvents.slice(0, 5).map((event: any, i: number) => (
                <div key={i} className="p-2 bg-muted/50 rounded text-xs">
                  <div className="font-medium">{event.title || 'Geen titel'}</div>
                  {event.date && <div className="text-muted-foreground">Datum: {event.date}</div>}
                  {event.location && <div className="text-muted-foreground">Locatie: {event.location}</div>}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${currentStep === 'configure' ? 'max-w-[95vw] w-[95vw]' : 'max-w-2xl'} max-h-[95vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Feed Import Wizard
          </DialogTitle>
          <DialogDescription>
            Analyseer een website en configureer de event import
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="flex-1 overflow-y-auto">
          {currentStep === 'analyze' && renderAnalyzeStep()}
          {currentStep === 'configure' && renderConfigureStep()}
          {currentStep === 'preview' && renderPreviewStep()}
        </div>

        <DialogFooter className="mt-4 gap-2">
          {currentStep !== 'analyze' && (
            <Button variant="outline" onClick={() => setCurrentStep(currentStep === 'preview' ? 'configure' : 'analyze')}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Terug
            </Button>
          )}
          
          <Button variant="outline" onClick={handleClose}>
            Annuleren
          </Button>
          
          {currentStep === 'analyze' && analysisResult?.isComplete && (
            needsVisualConfig ? (
              <Button onClick={goToConfigureStep}>
                Configureren
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={() => createFeedMutation.mutate()} disabled={createFeedMutation.isPending}>
                {createFeedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Feed Opslaan
              </Button>
            )
          )}
          
          {currentStep === 'configure' && (
            <Button 
              onClick={() => validateMutation.mutate()} 
              disabled={!canProceedToValidation() || validateMutation.isPending}
            >
              {validateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Valideren
            </Button>
          )}
          
          {currentStep === 'preview' && (
            <Button onClick={() => createFeedMutation.mutate()} disabled={createFeedMutation.isPending}>
              {createFeedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Feed Opslaan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
