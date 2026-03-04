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
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Check, 
  Loader2, 
  X, 
  AlertCircle, 
  AlertTriangle,
  Link as LinkIcon, 
  Save, 
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Info,
  Calendar,
  MapPin,
  Clock,
  Image as ImageIcon,
  ExternalLink,
  Crosshair,
  MousePointer2,
  RefreshCw,
  Eye,
  Type,
  FileText,
  Building2,
  List,
  Map,
  Globe,
  Brain,
  Rss,
  Sparkles,
  Tag,
  DollarSign,
} from 'lucide-react';
import { DUTCH_MUNICIPALITIES, type Municipality } from '@shared/dutch-municipalities';
import { FeedFieldMapper } from './FeedFieldMapper';

type WizardStep = 'analyze' | 'ai-scraper' | 'configure' | 'preview' | 'direct-detail' | 'direct-overview' | 'field-mapping';

interface AiScraperStep {
  name: string;
  status: 'success' | 'failed' | 'pending';
  message: string;
}

interface AiScraperResult {
  success: boolean;
  overviewSelectors?: Record<string, string>;
  detailSelectors?: Record<string, string>;
  hasJsonLd: boolean;
  pagination?: { type: string; selector?: string; paramName?: string; maxPages?: number };
  eventsOnPage: number;
  estimatedTotalEvents: number;
  sampleEvents: Array<Record<string, string>>;
  confidence: number;
  reasoning: string;
  requiresJsRendering: boolean;
  suggestedFeedConfig?: {
    feedType: string;
    scraperConfig: Record<string, any>;
    fieldMappings: Record<string, string>;
  };
  error?: string;
  steps: AiScraperStep[];
}

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
    fieldDetection?: FieldDetectionInfo;
  } | null;
}

interface SampleEventData {
  title: string;
  description?: string;
  date?: string;
  image?: string | null;
  link?: string | null;
  location?: string | null;
  rawData?: any;
}

interface ContentQualityInfo {
  hasStructuredDates: boolean;
  hasStructuredLocations: boolean;
  canExtractDates: boolean;
  canExtractLocations: boolean;
  estimatedCompletePercentage: number;
  warnings: string[];
  recommendations: string[];
}

interface DetectedField {
  fieldPath: string;
  fieldType: string;
  confidence: number;
  sampleValue: any;
  detectionReason: string;
}

interface FieldDetectionInfo {
  detectedFields: DetectedField[];
  hasLocationData: boolean;
  hasDateData: boolean;
  locationCompleteness: number;
  dateCompleteness: number;
  suggestedMappings: Record<string, string>;
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
  sampleEvent: SampleEventData | null;
  suggestedFeedName: string | null;
  suggestedMunicipality: string | null;
  importRules: string;
  isComplete: boolean;
  contentQuality?: ContentQualityInfo;
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
  category?: string;
}

interface PreviewEventItem {
  title: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  link?: string;
  isComplete: boolean;
  missingFields: string[];
  validationIssues: string[];
}

interface PreviewResult {
  success: boolean;
  items: PreviewEventItem[];
  summary: {
    total: number;
    complete: number;
    incomplete: number;
    missingFieldsCounts: Record<string, number>;
    totalAvailable?: number; // Total events available (before limit)
    aiCallsUsed?: number; // AI calls used in this session
    aiCallsLimit?: number; // Maximum AI calls allowed
  };
  error?: string;
  isTestMode?: boolean; // Whether this was a test with limited events
}

interface FeedAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedCreated?: () => void;
  directVisualMode?: boolean;
  editingFeedId?: number | null;
}

const IMPORT_RULES_SUMMARY = [
  {
    title: 'Locatie Verificatie',
    description: 'Alleen events met GPS coördinaten, bekend venue of geocodeerbaar adres',
    icon: MapPin,
  },
  {
    title: 'Datum Vereist',
    description: 'Alleen events met specifieke datum of datumperiode',
    icon: Calendar,
  },
  {
    title: 'Bron Afbeeldingen',
    description: 'Afbeelding uit de bron indien beschikbaar, anders stock foto',
    icon: ImageIcon,
  },
  {
    title: 'Duplicaat Detectie',
    description: 'Automatische check op bestaande events voordat er geïmporteerd wordt',
    icon: Check,
  },
];

const FIELD_CONFIG: { id: keyof Omit<SelectorConfig, 'eventCard'>; name: string; required: boolean; description: string; icon: React.ReactNode }[] = [
  { id: 'title', name: 'Titel', required: true, description: 'Naam van het evenement', icon: <Type className="h-4 w-4" /> },
  { id: 'date', name: 'Datum', required: true, description: 'Startdatum (en eventueel einddatum)', icon: <Calendar className="h-4 w-4" /> },
  { id: 'image', name: 'Afbeelding', required: false, description: 'Thumbnail/afbeelding', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'link', name: 'Detail Link', required: true, description: 'Link naar de detail pagina van het event', icon: <LinkIcon className="h-4 w-4" /> },
  { id: 'location', name: 'Locatie', required: true, description: 'Adres of GPS coördinaten (VERPLICHT)', icon: <MapPin className="h-4 w-4" /> },
  { id: 'venue', name: 'Venue', required: false, description: 'Naam van de locatie/zaal', icon: <Building2 className="h-4 w-4" /> },
  { id: 'time', name: 'Tijd', required: false, description: 'Start- en eindtijd', icon: <Clock className="h-4 w-4" /> },
  { id: 'description', name: 'Beschrijving', required: false, description: 'Omschrijving van het event', icon: <FileText className="h-4 w-4" /> },
  { id: 'venueDescription', name: 'Venue Info', required: false, description: 'Extra info over de venue', icon: <Building2 className="h-4 w-4" /> },
];

const generateNonce = () => {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

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
    .slice(0, 100);

  const handleSelect = (municipality: Municipality) => {
    setSearch(municipality.name);
    onChange(municipality.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearch('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <Input
          ref={inputRef}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Typ om te zoeken..."
          className="h-8 text-xs pr-8"
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-auto"
          >
            <div className="sticky top-0 bg-gray-50 px-2 py-1 text-xs text-muted-foreground border-b">
              {filteredMunicipalities.length} gemeentes
            </div>
            {filteredMunicipalities.length === 0 ? (
              <div className="p-2 text-xs text-muted-foreground text-center">
                Geen gemeentes gevonden
              </div>
            ) : (
              filteredMunicipalities.map((m) => (
                <div
                  key={m.name}
                  className={`px-2 py-1.5 text-xs cursor-pointer hover:bg-accent flex justify-between ${
                    m.name === value ? 'bg-accent' : ''
                  }`}
                  onClick={() => handleSelect(m)}
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground">{m.province}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function FeedAnalyzerModal({ open, onOpenChange, onFeedCreated, directVisualMode = false, editingFeedId = null }: FeedAnalyzerModalProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [currentStep, setCurrentStep] = useState<WizardStep>(directVisualMode ? 'direct-detail' : 'analyze');
  const [overviewUrl, setOverviewUrl] = useState('');
  const [detailUrl, setDetailUrl] = useState('');
  const [result, setResult] = useState<ProgressiveAnalysisResult | null>(null);
  const [showSampleEvent, setShowSampleEvent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedName, setFeedName] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(false);
  
  const [pageHtml, setPageHtml] = useState<string>('');
  const [activeField, setActiveField] = useState<keyof Omit<SelectorConfig, 'eventCard'> | 'eventCard' | null>(null);
  const [selectors, setSelectors] = useState<SelectorConfig>({ eventCard: '' });
  const [messageNonce] = useState(() => generateNonce());
  const [highlightedSelector, setHighlightedSelector] = useState<string>('');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [iframeLoading, setIframeLoading] = useState(false);
  const [pageContext, setPageContext] = useState<'overview' | 'detail'>('overview');
  const [showImagesOnly, setShowImagesOnly] = useState(false);
  
  const [previewEvents, setPreviewEvents] = useState<Array<{
    title: string;
    date: string;
    location: string;
    description?: string;
    image?: string;
    link?: string;
  }>>([]);
  const [totalEventsFound, setTotalEventsFound] = useState<number>(0);
  
  const [aiScraperResult, setAiScraperResult] = useState<AiScraperResult | null>(null);
  const [aiScraperFromAnalyze, setAiScraperFromAnalyze] = useState(false);

  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(true); // Start in test mode (5 events)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [showFieldMapper, setShowFieldMapper] = useState<boolean>(false);
  const [fieldMappingValid, setFieldMappingValid] = useState<boolean>(false);
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [previewProgress, setPreviewProgress] = useState<{
    phase: 'fetching' | 'parsing' | 'validating' | 'geocoding' | 'complete';
    current: number;
    total: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, []);

  // Load existing configuration when editing
  useEffect(() => {
    const loadConfig = async () => {
      if (!open || !editingFeedId) {
        setIsEditMode(false);
        return;
      }
      
      setLoadingConfig(true);
      setIsEditMode(true);
      
      try {
        const response = await apiRequest(`/api/admin/visual-configurator/feed/${editingFeedId}`, {
          method: 'GET',
        });
        
        if (response.feed && response.profile) {
          setOverviewUrl(response.feed.url);
          setFeedName(response.feed.name);
          setSelectedMunicipality(response.feed.municipality || response.profile.municipality || '');
          setSelectors(response.profile.selectors || { eventCard: '' });
          
          // Load detail URL if available
          const savedDetailUrl = response.profile.sampleDetailUrl;
          if (savedDetailUrl) {
            setDetailUrl(savedDetailUrl);
          }
          
          // Set step to show configured selectors
          setCurrentStep('direct-detail');
          
          // Auto-fetch the detail page if available, otherwise overview
          setTimeout(() => {
            if (savedDetailUrl) {
              setPageContext('detail');
              fetchPageMutation.mutate(savedDetailUrl);
            } else if (response.feed.url) {
              setPageContext('overview');
              fetchPageMutation.mutate(response.feed.url);
            }
          }, 100);
          
          toast({
            title: 'Configuratie geladen',
            description: `Bewerk de visuele configuratie voor "${response.feed.name}"`,
          });
        }
      } catch (error: any) {
        toast({
          title: 'Fout bij laden',
          description: error.message || 'Kon de configuratie niet laden',
          variant: 'destructive',
        });
        onOpenChange(false);
      } finally {
        setLoadingConfig(false);
      }
    };
    
    loadConfig();
  }, [open, editingFeedId]);

  const analyzeMutation = useMutation({
    mutationFn: async (urlToAnalyze: string): Promise<ProgressiveAnalysisResult> => {
      return apiRequest('/api/admin/rss-feeds/analyze-progressive', {
        method: 'POST',
        data: { url: urlToAnalyze },
      });
    },
    onSuccess: (data) => {
      console.log('[FeedAnalyzer] Analysis result:', {
        isComplete: data.isComplete,
        chosenMethod: data.chosenMethod,
        stepsCount: data.steps?.length,
      });
      setResult(data);
      if (data.chosenMethod) {
        setSelectedMethodId(data.chosenMethod.id);
      } else {
        const firstSuccess = data.steps?.find(s => s.status === 'success' && s.id !== 'scraper');
        if (firstSuccess) {
          setSelectedMethodId(firstSuccess.id);
        }
      }
      if (data.suggestedFeedName) {
        setFeedName(data.suggestedFeedName);
      }
      if (data.suggestedMunicipality) {
        setSelectedMunicipality(data.suggestedMunicipality);
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

  const aiScraperMutation = useMutation({
    mutationFn: async (urlToAnalyze: string): Promise<AiScraperResult> => {
      return apiRequest('/api/admin/rss-feeds/ai-scraper-analyze', {
        method: 'POST',
        data: { url: urlToAnalyze },
      });
    },
    onSuccess: (data) => {
      setAiScraperResult(data);
      if (data.success && data.confidence >= 70 && data.suggestedFeedConfig) {
        if (data.overviewSelectors) {
          const newSelectors: SelectorConfig = {
            eventCard: data.overviewSelectors.eventCard || '',
            title: data.overviewSelectors.title,
            date: data.overviewSelectors.date,
            link: data.overviewSelectors.link,
            image: data.overviewSelectors.image,
            venue: data.overviewSelectors.venue,
            address: data.overviewSelectors.address,
          };
          if (data.detailSelectors) {
            if (data.detailSelectors.description) newSelectors.description = data.detailSelectors.description;
            if (data.detailSelectors.time) newSelectors.time = data.detailSelectors.time;
            if (data.detailSelectors.location) newSelectors.location = data.detailSelectors.location;
          }
          setSelectors(newSelectors);
        }
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'AI analyse mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  const handleStartAiScraper = () => {
    setCurrentStep('ai-scraper');
    setAiScraperResult(null);
    setAiScraperFromAnalyze(true);
    aiScraperMutation.mutate(overviewUrl);
  };

  const handleAiScraperToVisual = () => {
    if (aiScraperResult?.overviewSelectors && aiScraperResult.confidence >= 50) {
      const newSelectors: SelectorConfig = {
        eventCard: aiScraperResult.overviewSelectors.eventCard || '',
        title: aiScraperResult.overviewSelectors.title,
        date: aiScraperResult.overviewSelectors.date,
        link: aiScraperResult.overviewSelectors.link,
        image: aiScraperResult.overviewSelectors.image,
        venue: aiScraperResult.overviewSelectors.venue,
        address: aiScraperResult.overviewSelectors.address,
      };
      if (aiScraperResult.detailSelectors) {
        if (aiScraperResult.detailSelectors.description) newSelectors.description = aiScraperResult.detailSelectors.description;
        if (aiScraperResult.detailSelectors.time) newSelectors.time = aiScraperResult.detailSelectors.time;
        if (aiScraperResult.detailSelectors.location) newSelectors.location = aiScraperResult.detailSelectors.location;
      }
      setSelectors(newSelectors);
    }
    setCurrentStep('configure');
    setPageContext('overview');
    setIframeLoading(true);
    fetchPageMutation.mutate(overviewUrl);
  };

  const handleAiScraperSave = () => {
    if (!aiScraperResult?.suggestedFeedConfig) return;
    setCurrentStep('configure');
    setPageContext('overview');
    setIframeLoading(true);
    fetchPageMutation.mutate(overviewUrl);
  };

  const getSelectedMethod = () => {
    if (!result || !selectedMethodId) return null;
    if (result.chosenMethod && result.chosenMethod.id === selectedMethodId) {
      return result.chosenMethod;
    }
    const step = result.steps?.find(s => s.id === selectedMethodId && s.status === 'success');
    if (step && step.result) {
      return {
        id: step.id,
        name: step.name,
        url: step.result.feedUrl || overviewUrl,
        eventCount: step.result.eventCount || 0,
        reason: step.result.reason || '',
        pros: '',
      };
    }
    return null;
  };

  const createFeedMutation = useMutation({
    mutationFn: async () => {
      const method = getSelectedMethod();
      if (!method) throw new Error('Geen methode geselecteerd');
      
      const getFeedType = (methodId: string): string => {
        switch (methodId) {
          case 'json-api':
          case 'json-ld':
            return 'json';
          case 'scraper':
            return 'scraper';
          case 'rss':
          case 'atom':
          default:
            return 'rss';
        }
      };
      
      return apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: feedName || result?.suggestedFeedName || 'Nieuwe Feed',
          url: method.url,
          feedType: getFeedType(method.id),
          municipality: selectedMunicipality || result?.suggestedMunicipality || '',
          defaultCategory: 'Gezellig en Sociaal',
          autoCreateEvents: true,
          updateFrequencyMinutes: 60,
          fieldMappings: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
        },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Feed aangemaakt',
        description: 'De feed is succesvol toegevoegd en zal worden gesynchroniseerd.',
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

  const fetchPageMutation = useMutation({
    mutationFn: async (pageUrl: string) => {
      const response = await apiRequest('/api/admin/visual-configurator/fetch-page', {
        method: 'POST',
        data: { url: pageUrl },
      });
      return response;
    },
    onSuccess: (data: any) => {
      setPageHtml(data.html);
      setIframeLoading(false);
      toast({
        title: 'Pagina geladen',
        description: 'Klik op elementen om velden te selecteren.',
      });
    },
    onError: (error: any) => {
      setIframeLoading(false);
      toast({
        title: 'Fout bij laden',
        description: error.message || 'Kon de pagina niet laden.',
        variant: 'destructive',
      });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const parsedUrl = new URL(overviewUrl);
      const response = await apiRequest('/api/admin/visual-configurator/save-config', {
        method: 'POST',
        data: { 
          url: overviewUrl,
          domain: parsedUrl.hostname,
          feedName: feedName || 'Nieuwe Feed',
          selectors,
          municipality: selectedMunicipality || undefined,
          sampleDetailUrl: detailUrl || undefined,
        },
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Configuratie en feed aangemaakt',
        description: data.message || 'De feed is succesvol opgeslagen.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      onFeedCreated?.();
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message || 'Kon de configuratie niet opslaan.',
        variant: 'destructive',
      });
    },
  });

  const testEventsMutation = useMutation({
    mutationFn: async () => {
      const testResponse = await apiRequest('/api/admin/visual-configurator/test', {
        method: 'POST',
        data: { url: overviewUrl, selectors },
      });
      
      setPreviewEvents(testResponse.previewEvents || []);
      setTotalEventsFound(testResponse.totalFound || 0);
      
      const previewResponse = await apiRequest('/api/admin/rss-feeds/preview', {
        method: 'POST',
        data: { 
          url: overviewUrl,
          feedType: 'scraper',
          municipality: selectedMunicipality || result?.suggestedMunicipality || '',
          scraperConfig: selectors,
          limit: isTestMode ? 5 : undefined, // Test mode: only 5 events
        },
      });
      
      return { ...previewResponse, isTestMode };
    },
    onSuccess: (data: PreviewResult) => {
      setPreviewResult(data);
      setCurrentStep('preview');
      
      if (data.success) {
        const testModeInfo = data.isTestMode && data.summary.totalAvailable 
          ? ` (van ${data.summary.totalAvailable} totaal)` 
          : '';
        const description = data.summary.incomplete > 0 
          ? `${data.summary.complete} compleet, ${data.summary.incomplete} incompleet${testModeInfo}`
          : `Alle ${data.summary.total} events zijn compleet${testModeInfo}`;
        toast({
          title: data.isTestMode ? 'Test: eerste 5 events' : 'Events geanalyseerd',
          description,
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Test mislukt',
        description: error.message || 'Kon events niet ophalen.',
        variant: 'destructive',
      });
    },
  });

  const previewFeedMutation = useMutation({
    mutationFn: async (): Promise<PreviewResult> => {
      const method = getSelectedMethod();
      if (!method) throw new Error('Geen methode geselecteerd');
      
      const getFeedType = (methodId: string): string => {
        switch (methodId) {
          case 'json-api':
          case 'json-ld':
            return 'json';
          case 'scraper':
            return 'scraper';
          case 'rss':
          case 'atom':
          default:
            return 'rss';
        }
      };
      
      setPreviewProgress({ phase: 'fetching', current: 0, total: 100, message: 'Feed ophalen...' });
      
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      progressIntervalRef.current = setInterval(() => {
        setPreviewProgress(prev => {
          if (!prev) return prev;
          const newCurrent = Math.min(prev.current + 5, 90);
          let phase = prev.phase;
          let message = prev.message;
          
          if (newCurrent > 20 && phase === 'fetching') {
            phase = 'parsing';
            message = 'Events parsen...';
          } else if (newCurrent > 50 && phase === 'parsing') {
            phase = 'validating';
            message = 'Data valideren...';
          } else if (newCurrent > 70 && phase === 'validating') {
            phase = 'geocoding';
            message = 'Locaties verifiëren...';
          }
          
          return { ...prev, current: newCurrent, phase, message };
        });
      }, 300);
            
      try {
        const response = await apiRequest('/api/admin/rss-feeds/preview', {
          method: 'POST',
          data: { 
            url: method.url,
            feedType: getFeedType(method.id),
            municipality: selectedMunicipality || result?.suggestedMunicipality || '',
            scraperConfig: method.id === 'scraper' ? selectors : undefined,
            fieldMappings: Object.keys(fieldMapping).length > 0 ? fieldMapping : undefined,
            limit: isTestMode ? 5 : undefined, // Test mode: only 5 events
          },
        });
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setPreviewProgress({ phase: 'complete', current: 100, total: 100, message: 'Klaar!' });
        return { ...response, isTestMode };
      } catch (error) {
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setPreviewProgress(null);
        throw error;
      }
    },
    onSuccess: (data) => {
      setPreviewResult(data);
      setPreviewProgress(null);
      setCurrentStep('preview');
      
      if (data.success) {
        const description = data.summary.incomplete > 0 
          ? `${data.summary.complete} compleet, ${data.summary.incomplete} incompleet`
          : `Alle ${data.summary.total} events zijn compleet`;
        toast({
          title: 'Preview geladen',
          description,
        });
      }
    },
    onError: (error: Error) => {
      setPreviewProgress(null);
      toast({
        title: 'Preview mislukt',
        description: error.message || 'Kon preview niet laden.',
        variant: 'destructive',
      });
    },
    onSettled: () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    },
  });

  const handleAnalyze = () => {
    if (!overviewUrl.trim()) return;
    setResult(null);
    setShowSampleEvent(false);
    setFeedback('');
    analyzeMutation.mutate(overviewUrl.trim());
  };

  const handleClose = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPreviewProgress(null);
    setOverviewUrl('');
    setDetailUrl('');
    setResult(null);
    setShowSampleEvent(false);
    setFeedback('');
    setFeedName('');
    setCurrentStep(directVisualMode ? 'direct-detail' : 'analyze');
    setPageHtml('');
    setSelectors({ eventCard: '' });
    setActiveField(null);
    setShowImagesOnly(false);
    setSelectedMunicipality('');
    setPreviewEvents([]);
    setTotalEventsFound(0);
    setPageContext('overview');
    setPreviewResult(null);
    setSelectedMethodId(null);
    setIsTestMode(true);
    setAiScraperResult(null);
    setAiScraperFromAnalyze(false);
    setDetailUrl('');
    setOverviewUrl('');
    onOpenChange(false);
  };
  
  useEffect(() => {
    if (open) {
      setCurrentStep(directVisualMode ? 'direct-detail' : 'analyze');
    }
  }, [open, directVisualMode]);

  const handleGoToConfigureStep = () => {
    setCurrentStep('configure');
    setPageContext('overview');
    setIframeLoading(true);
    fetchPageMutation.mutate(overviewUrl);
  };

  const handleLoadDetailPage = () => {
    if (!detailUrl.trim()) return;
    setPageContext('detail');
    setIframeLoading(true);
    fetchPageMutation.mutate(detailUrl);
  };

  const handleLoadOverviewPage = () => {
    setPageContext('overview');
    setIframeLoading(true);
    fetchPageMutation.mutate(overviewUrl);
  };

  const handleElementClick = (selector: string, sampleText: string) => {
    if (!activeField) {
      toast({
        title: 'Selecteer eerst een veld',
        description: 'Kies links welk veld je wilt configureren.',
      });
      return;
    }

    setSelectors(prev => ({
      ...prev,
      [activeField]: selector,
    }));

    toast({
      title: `${activeField} geconfigureerd`,
      description: `Selector: ${selector}`,
    });
  };

  const getValidationSummary = () => {
    const issues: { type: 'error' | 'warning' | 'info'; message: string }[] = [];
    
    if (!selectors.eventCard) {
      issues.push({ type: 'error', message: 'Event card selector is verplicht' });
    }
    if (!selectors.title) {
      issues.push({ type: 'error', message: 'Titel selector is verplicht' });
    }
    if (!selectors.date) {
      issues.push({ type: 'error', message: 'Datum selector is verplicht' });
    }
    if (!selectors.link) {
      issues.push({ type: 'error', message: 'Detail link selector is verplicht' });
    }
    if (!selectors.location) {
      issues.push({ type: 'error', message: 'Locatie is verplicht - geen fallback locaties' });
    }
    if (!selectors.image) {
      issues.push({ type: 'warning', message: 'Geen afbeelding - stock images worden gebruikt' });
    }

    return issues;
  };

  const canSave = () => {
    const issues = getValidationSummary();
    return !issues.some(i => i.type === 'error') && pageHtml;
  };

  const injectHighlightScript = () => {
    return `
      <script>
        const VFC_NONCE = '${messageNonce}';
        
        (function fixImages() {
          document.querySelectorAll('img').forEach(img => {
            const lazySrc = img.getAttribute('data-src') || 
                           img.getAttribute('data-lazy-src') || 
                           img.getAttribute('data-original');
            const currentSrc = img.src || '';
            const isPlaceholder = !currentSrc || 
                                  currentSrc.includes('placeholder') || 
                                  currentSrc.includes('data:image');
            if (lazySrc && (isPlaceholder || !img.src)) {
              img.src = lazySrc;
            }
            img.style.visibility = 'visible';
            img.style.opacity = '1';
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

        // Track hidden elements for reset functionality
        const hiddenElements = [];
        
        function generateSmartSelector(element) {
          // Try ID first
          if (element.id) {
            return '#' + element.id;
          }
          
          // Try data attributes
          const dataAttrs = Array.from(element.attributes).filter(a => a.name.startsWith('data-'));
          if (dataAttrs.length > 0) {
            const attr = dataAttrs[0];
            return '[' + attr.name + '="' + attr.value + '"]';
          }
          
          // Try classes (filter out vfc- and common utility classes)
          if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => 
              c && !c.startsWith('vfc-') && c.length > 2 && !/^(p|m|w|h)-/.test(c)
            );
            if (classes.length > 0) {
              return '.' + classes.slice(0, 2).join('.');
            }
          }
          
          // Build contextual selector with parent
          const tag = element.tagName.toLowerCase();
          let parent = element.parentElement;
          let parentSelector = '';
          
          // Find a parent with a good selector
          while (parent && parent.tagName !== 'BODY') {
            if (parent.id) {
              parentSelector = '#' + parent.id;
              break;
            }
            if (parent.className && typeof parent.className === 'string') {
              const pClasses = parent.className.split(' ').filter(c => 
                c && !c.startsWith('vfc-') && c.length > 2
              );
              if (pClasses.length > 0) {
                parentSelector = '.' + pClasses[0];
                break;
              }
            }
            parent = parent.parentElement;
          }
          
          // Return with parent context if found
          if (parentSelector) {
            return parentSelector + ' ' + tag;
          }
          
          return tag;
        }
        
        document.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          const target = e.target;
          
          // Ctrl+click: hide element and track it
          if (e.ctrlKey || e.metaKey) {
            target.style.display = 'none';
            target.setAttribute('data-vfc-hidden', 'true');
            hiddenElements.push(target);
            return;
          }
          
          const selector = generateSmartSelector(target);
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
          if (e.data.type === 'vfc_showImagesOnly' && e.data.nonce === VFC_NONCE) {
            toggleImagesOnlyMode(e.data.enabled);
          }
          if (e.data.type === 'vfc_resetHidden' && e.data.nonce === VFC_NONCE) {
            // Reset all hidden elements
            hiddenElements.forEach(el => {
              el.style.display = '';
              el.removeAttribute('data-vfc-hidden');
            });
            hiddenElements.length = 0;
            // Also find any elements marked as hidden
            document.querySelectorAll('[data-vfc-hidden]').forEach(el => {
              el.style.display = '';
              el.removeAttribute('data-vfc-hidden');
            });
          }
        });
        
        function toggleImagesOnlyMode(enabled) {
          // Always remove existing style first to prevent duplicates
          const existingStyle = document.getElementById('vfc-images-only-style');
          if (existingStyle) {
            existingStyle.remove();
          }
          
          if (enabled) {
            // Hide all non-image elements and show images prominently
            const style = document.createElement('style');
            style.id = 'vfc-images-only-style';
            style.textContent = \`
              body * {
                visibility: hidden !important;
                pointer-events: none !important;
              }
              img {
                visibility: visible !important;
                display: block !important;
                position: relative !important;
                border: 4px solid #10b981 !important;
                margin: 10px !important;
                max-width: 300px !important;
                max-height: 200px !important;
                object-fit: contain !important;
                background: white !important;
                z-index: 9999 !important;
                pointer-events: auto !important;
              }
              img:hover {
                border-color: #3b82f6 !important;
                transform: scale(1.05);
                cursor: pointer !important;
                box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4) !important;
              }
              body {
                visibility: visible !important;
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 10px !important;
                padding: 20px !important;
                background: #f3f4f6 !important;
                pointer-events: auto !important;
              }
            \`;
            document.head.appendChild(style);
          }
        }
      </script>
      <style>
        html, body {
          overflow-x: hidden !important;
          overflow-y: auto !important;
          position: static !important;
          width: 100% !important;
          max-width: 100% !important;
          min-width: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }
        body {
          transform: none !important;
        }
        * {
          max-width: 100vw !important;
          box-sizing: border-box !important;
        }
        body > *, body > * > * {
          position: relative !important;
          left: 0 !important;
          right: auto !important;
          margin-left: 0 !important;
          transform: none !important;
        }
        [style*="margin-left: -"], [style*="left: -"], [style*="translateX(-"] {
          margin-left: 0 !important;
          left: 0 !important;
          transform: none !important;
        }
        .vfc-highlight {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
      </style>
    `;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.nonce !== messageNonce) return;
      if (event.data.type === 'vfc_elementClicked') {
        handleElementClick(event.data.selector, event.data.sampleText);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeField]);

  useEffect(() => {
    if (iframeRef.current && highlightedSelector) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'vfc_highlight',
        nonce: messageNonce,
        selector: highlightedSelector,
      }, '*');
    }
  }, [highlightedSelector]);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'vfc_showImagesOnly',
        nonce: messageNonce,
        enabled: showImagesOnly,
      }, '*');
    }
  }, [showImagesOnly]);

  useEffect(() => {
    if (result?.isComplete && currentStep === 'analyze') {
    }
  }, [result?.isComplete, result?.steps]);

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

  const validationIssues = getValidationSummary();
  const hasErrors = validationIssues.some(i => i.type === 'error');

  const renderDirectDetailStep = () => {
    if (!pageHtml) {
      return (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="detail-url">Voorbeeld Detailpagina URL</Label>
            <p className="text-xs text-muted-foreground">
              Voer de URL van een voorbeeld evenement detailpagina in. Dit wordt gebruikt om de selectors te configureren.
            </p>
            <div className="flex gap-2">
              <Input
                id="detail-url"
                value={detailUrl}
                onChange={(e) => setDetailUrl(e.target.value)}
                placeholder="https://example.com/event/123"
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (detailUrl) {
                    setIframeLoading(true);
                    setPageContext('detail');
                    fetchPageMutation.mutate(detailUrl);
                  }
                }}
                disabled={!detailUrl || fetchPageMutation.isPending}
              >
                {fetchPageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Laden'
                )}
              </Button>
            </div>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Tip</AlertTitle>
            <AlertDescription>
              Kies een representatieve evenement pagina met alle velden die je wilt importeren (titel, datum, locatie, beschrijving, afbeelding).
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return (
      <div className="flex gap-4 h-[calc(95vh-200px)]">
        <div className="w-80 flex flex-col gap-3">
          <Card className="flex-shrink-0">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Pagina's
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Overzichtspagina (feed URL)</Label>
                <div className="flex gap-1">
                  <Input
                    value={overviewUrl}
                    onChange={(e) => setOverviewUrl(e.target.value)}
                    placeholder="URL van overzichtspagina"
                    className="h-7 text-xs"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => {
                      if (overviewUrl) {
                        setIframeLoading(true);
                        setPageContext('overview');
                        fetchPageMutation.mutate(overviewUrl);
                      }
                    }}
                    disabled={!overviewUrl || fetchPageMutation.isPending}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Detailpagina (voorbeeld event)</Label>
                <div className="flex gap-1">
                  <Input
                    value={detailUrl}
                    onChange={(e) => setDetailUrl(e.target.value)}
                    placeholder="URL van event detail"
                    className="h-7 text-xs"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => {
                      if (detailUrl) {
                        setIframeLoading(true);
                        setPageContext('detail');
                        fetchPageMutation.mutate(detailUrl);
                      }
                    }}
                    disabled={!detailUrl || fetchPageMutation.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 ${fetchPageMutation.isPending ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Bekijkt: <span className="font-medium">{pageContext === 'overview' ? 'Overzicht' : 'Detail'}</span>
              </p>
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MousePointer2 className="h-4 w-4" />
                Event Velden
              </CardTitle>
              <CardDescription className="text-xs">
                Klik op een veld en selecteer het element in de pagina
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <div className="p-2 space-y-2">
                  {([
                    { key: 'title', label: 'Titel', icon: Type, required: true },
                    { key: 'date', label: 'Datum', icon: Calendar, required: true },
                    { key: 'location', label: 'Locatie', icon: MapPin, required: true },
                    { key: 'description', label: 'Beschrijving', icon: FileText, required: false },
                    { key: 'image', label: 'Afbeelding', icon: ImageIcon, required: false },
                    { key: 'venue', label: 'Venue', icon: Building2, required: false },
                    { key: 'address', label: 'Adres', icon: Map, required: false },
                    { key: 'time', label: 'Tijd', icon: Clock, required: false },
                  ] as Array<{ key: keyof SelectorConfig; label: string; icon: typeof Type; required: boolean }>).map(({ key, label, icon: Icon, required }) => (
                    <div
                      key={key}
                      className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                        activeField === key 
                          ? 'border-blue-500 bg-blue-50' 
                          : selectors[key] 
                            ? 'border-green-300 bg-green-50' 
                            : required 
                              ? 'border-red-300 bg-red-50'
                              : 'border-gray-200'
                      }`}
                      onClick={() => setActiveField(key)}
                      onMouseEnter={() => selectors[key] && setHighlightedSelector(selectors[key]!)}
                      onMouseLeave={() => setHighlightedSelector('')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span className="font-medium text-xs">{label}</span>
                          {required && <Badge variant="destructive" className="text-[10px] h-4">Verplicht</Badge>}
                        </div>
                        {selectors[key] ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : required ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : null}
                      </div>
                      {activeField === key && (
                        <Input
                          className="mt-2 text-xs h-7"
                          placeholder="CSS selector invoeren..."
                          value={selectors[key] || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setSelectors(s => ({ ...s, [key]: e.target.value }));
                            setHighlightedSelector(e.target.value);
                          }}
                        />
                      )}
                      {selectors[key] && activeField !== key && (
                        <p className="text-[10px] text-muted-foreground mt-1 truncate font-mono">
                          {selectors[key]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden relative">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b gap-2">
            <span className="text-xs text-muted-foreground flex-1">
              {showImagesOnly 
                ? 'Afbeeldingen modus - klik op een afbeelding om te selecteren' 
                : 'Klik = selecteren | Ctrl+klik = verbergen'}
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  iframeRef.current?.contentWindow?.postMessage({
                    type: 'vfc_resetHidden',
                    nonce: messageNonce,
                  }, '*');
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reset verborgen
              </Button>
              <Button
                size="sm"
                variant={showImagesOnly ? 'default' : 'outline'}
                className="h-7 text-xs"
                onClick={() => setShowImagesOnly(!showImagesOnly)}
              >
                <ImageIcon className="h-3 w-3 mr-1" />
                {showImagesOnly ? 'Normale weergave' : 'Alleen afbeeldingen'}
              </Button>
            </div>
          </div>
          {iframeLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={pageHtml + injectHighlightScript()}
            className="flex-1 w-full border-0"
            sandbox="allow-same-origin allow-scripts"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  };

  const renderDirectOverviewStep = () => {
    if (!pageHtml || pageContext !== 'overview') {
      return (
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="overview-url">Overzichtspagina URL</Label>
            <p className="text-xs text-muted-foreground">
              Voer de URL in van de pagina met de lijst van evenementen. Dit is de pagina waar links naar de detailpagina's staan.
            </p>
            <div className="flex gap-2">
              <Input
                id="overview-url"
                value={overviewUrl}
                onChange={(e) => setOverviewUrl(e.target.value)}
                placeholder="https://example.com/events"
                className="flex-1"
              />
              <Button
                onClick={() => {
                  if (overviewUrl) {
                    setIframeLoading(true);
                    setPageContext('overview');
                    fetchPageMutation.mutate(overviewUrl);
                  }
                }}
                disabled={!overviewUrl || fetchPageMutation.isPending}
              >
                {fetchPageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Laden'
                )}
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm">Geconfigureerde detail velden</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="flex flex-wrap gap-2">
                {selectors.title && <Badge variant="secondary">Titel</Badge>}
                {selectors.date && <Badge variant="secondary">Datum</Badge>}
                {selectors.location && <Badge variant="secondary">Locatie</Badge>}
                {selectors.description && <Badge variant="secondary">Beschrijving</Badge>}
                {selectors.image && <Badge variant="secondary">Afbeelding</Badge>}
                {selectors.venue && <Badge variant="secondary">Venue</Badge>}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex gap-4 h-[calc(95vh-200px)]">
        <div className="w-80 flex flex-col gap-3">
          <Card className="flex-shrink-0">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <List className="h-4 w-4" />
                Overzichtspagina
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex gap-1">
                <Input
                  value={overviewUrl}
                  onChange={(e) => setOverviewUrl(e.target.value)}
                  placeholder="URL van overzicht"
                  className="h-7 text-xs"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 px-2"
                  onClick={() => {
                    if (overviewUrl) {
                      setIframeLoading(true);
                      fetchPageMutation.mutate(overviewUrl);
                    }
                  }}
                  disabled={!overviewUrl || fetchPageMutation.isPending}
                >
                  <RefreshCw className={`h-3 w-3 ${fetchPageMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 overflow-hidden">
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <MousePointer2 className="h-4 w-4" />
                Event Links
              </CardTitle>
              <CardDescription className="text-xs">
                Selecteer het element dat de event links bevat
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <div className="p-2 space-y-2">
                  <div
                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                      activeField === 'eventCard' 
                        ? 'border-blue-500 bg-blue-50' 
                        : selectors.eventCard 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-red-300 bg-red-50'
                    }`}
                    onClick={() => setActiveField('eventCard')}
                    onMouseEnter={() => selectors.eventCard && setHighlightedSelector(selectors.eventCard)}
                    onMouseLeave={() => setHighlightedSelector('')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        <span className="font-medium text-xs">Event Card/Link</span>
                        <Badge variant="destructive" className="text-[10px] h-4">Verplicht</Badge>
                      </div>
                      {selectors.eventCard ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    {activeField === 'eventCard' && (
                      <Input
                        className="mt-2 text-xs h-7"
                        placeholder="CSS selector invoeren..."
                        value={selectors.eventCard || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectors(s => ({ ...s, eventCard: e.target.value }));
                          setHighlightedSelector(e.target.value);
                        }}
                      />
                    )}
                    {selectors.eventCard && activeField !== 'eventCard' && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate font-mono">
                        {selectors.eventCard}
                      </p>
                    )}
                  </div>

                  <div
                    className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                      activeField === 'link' 
                        ? 'border-blue-500 bg-blue-50' 
                        : selectors.link 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-orange-300 bg-orange-50'
                    }`}
                    onClick={() => setActiveField('link')}
                    onMouseEnter={() => selectors.link && setHighlightedSelector(selectors.link)}
                    onMouseLeave={() => setHighlightedSelector('')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-4 w-4" />
                        <span className="font-medium text-xs">Detail Link</span>
                        <Badge variant="outline" className="text-[10px] h-4">Aanbevolen</Badge>
                      </div>
                      {selectors.link ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                      )}
                    </div>
                    {activeField === 'link' && (
                      <Input
                        className="mt-2 text-xs h-7"
                        placeholder="CSS selector voor link..."
                        value={selectors.link || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          setSelectors(s => ({ ...s, link: e.target.value }));
                          setHighlightedSelector(e.target.value);
                        }}
                      />
                    )}
                    {selectors.link && activeField !== 'link' && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate font-mono">
                        {selectors.link}
                      </p>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-sm">Feed Naam & Gemeente</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              <div>
                <Label className="text-xs">Feed naam</Label>
                <Input
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                  placeholder="Naam voor deze feed"
                  className="h-7 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Gemeente</Label>
                <select
                  className="w-full h-7 text-xs border rounded px-2"
                  value={selectedMunicipality}
                  onChange={(e) => setSelectedMunicipality(e.target.value)}
                >
                  <option value="">Selecteer gemeente...</option>
                  {DUTCH_MUNICIPALITIES.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden relative">
          <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b gap-2">
            <span className="text-xs text-muted-foreground flex-1">
              Klik = selecteren | Ctrl+klik = verbergen
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'vfc_resetHidden',
                  nonce: messageNonce,
                }, '*');
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset verborgen
            </Button>
          </div>
          {iframeLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={pageHtml + injectHighlightScript()}
            className="flex-1 w-full border-0"
            sandbox="allow-same-origin allow-scripts"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-green-600';
    if (confidence >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getConfidenceBarColor = (confidence: number) => {
    if (confidence >= 70) return 'bg-green-500';
    if (confidence >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 70) return 'Hoog';
    if (confidence >= 50) return 'Gemiddeld';
    return 'Laag';
  };

  const renderAiScraperStep = () => {
    const isAnalyzing = aiScraperMutation.isPending;
    const result = aiScraperResult;

    return (
      <div className="space-y-4 py-2">
        {isAnalyzing && !result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Brain className="w-5 h-5 text-purple-500" />
              <span className="font-medium">AI analyseert de website met Gemini Pro...</span>
            </div>
            <div className="border rounded-lg divide-y">
              {[
                'Overzichtspagina ophalen...',
                'Event-kaarten analyseren met AI...',
                'Detailpagina\'s ophalen...',
                'Event-details analyseren met AI...',
                'Configuratie valideren...',
              ].map((stepName, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  {i === 0 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-purple-500 flex-shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {stepName}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Dit kan 30-60 seconden duren — AI analyseert zowel de overzichts- als detailpagina's
            </p>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="border rounded-lg divide-y">
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <div className="flex-shrink-0">
                    {step.status === 'success' ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : step.status === 'failed' ? (
                      <X className="w-4 h-4 text-red-500" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{step.name}</span>
                    <p className="text-xs text-muted-foreground">{step.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className={`w-5 h-5 ${getConfidenceColor(result.confidence)}`} />
                  <span className="font-semibold">Betrouwbaarheid</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${getConfidenceColor(result.confidence)}`}>
                    {result.confidence}%
                  </span>
                  <Badge variant={result.confidence >= 70 ? 'default' : result.confidence >= 50 ? 'secondary' : 'destructive'} className="text-xs">
                    {getConfidenceLabel(result.confidence)}
                  </Badge>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${getConfidenceBarColor(result.confidence)}`}
                  style={{ width: `${Math.min(result.confidence, 100)}%` }}
                />
              </div>
              {result.confidence >= 70 && (
                <p className="text-sm text-green-700">
                  AI heeft een betrouwbare configuratie gevonden! Controleer de preview hieronder.
                </p>
              )}
              {result.confidence >= 50 && result.confidence < 70 && (
                <p className="text-sm text-amber-700">
                  AI heeft een configuratie gevonden maar de betrouwbaarheid is gemiddeld. Controleer goed of pas handmatig aan.
                </p>
              )}
              {result.confidence < 50 && (
                <p className="text-sm text-red-700">
                  AI kon geen betrouwbare configuratie vinden. Gebruik de visuele editor hieronder.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {result.hasJsonLd && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                  <Sparkles className="w-3 h-3 mr-1" /> JSON-LD gevonden
                </Badge>
              )}
              {result.requiresJsRendering && (
                <Badge variant="secondary" className="text-xs">
                  <Globe className="w-3 h-3 mr-1" /> Browser rendering vereist
                </Badge>
              )}
              {result.pagination && result.pagination.type !== 'none' && (
                <Badge variant="secondary" className="text-xs">
                  <List className="w-3 h-3 mr-1" /> Paginatie: {result.pagination.maxPages} pagina's
                </Badge>
              )}
              {result.eventsOnPage > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {result.eventsOnPage} events/pagina
                  {result.estimatedTotalEvents > result.eventsOnPage && (
                    <span className="ml-1 font-semibold">({result.estimatedTotalEvents} totaal)</span>
                  )}
                </Badge>
              )}
            </div>

            {result.overviewSelectors && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Gevonden Selectors
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Overzichtspagina</p>
                    {Object.entries(result.overviewSelectors).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-blue-50 border-blue-200">
                          {key}
                        </Badge>
                        <code className="text-[10px] text-muted-foreground truncate max-w-[200px]">{value}</code>
                      </div>
                    ))}
                  </div>
                  {result.detailSelectors && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Detailpagina</p>
                      {Object.entries(result.detailSelectors).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono bg-green-50 border-green-200">
                            {key}
                          </Badge>
                          <code className="text-[10px] text-muted-foreground truncate max-w-[200px]">{value}</code>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {result.sampleEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <List className="w-4 h-4" /> Voorbeeld Events ({result.sampleEvents.length})
                </h4>
                <div className="border rounded-lg divide-y max-h-[250px] overflow-y-auto">
                  {result.sampleEvents.slice(0, 5).map((event, i) => (
                    <div key={i} className="p-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{event.title || 'Geen titel'}</p>
                        {event.link && (
                          <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700 flex-shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {event.date && (
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {event.date}</span>
                        )}
                        {(event.venue || event.location) && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {event.venue || event.location}</span>
                        )}
                        {event.category && (
                          <span className="flex items-center gap-1"><Tag className="w-3 h-3" /> {event.category}</span>
                        )}
                        {event.price && (
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {event.price}</span>
                        )}
                      </div>
                      {event.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.reasoning && (
              <Accordion type="single" collapsible>
                <AccordionItem value="reasoning">
                  <AccordionTrigger className="text-sm py-2">
                    <span className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-500" /> AI Analyse Details
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-gray-50 p-3 rounded border">
                      {result.reasoning}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feedNameAi">Feed naam</Label>
                <Input
                  id="feedNameAi"
                  value={feedName}
                  onChange={(e) => setFeedName(e.target.value)}
                  placeholder="Geef de feed een naam"
                />
              </div>
              <div className="space-y-2">
                <Label>Gemeente</Label>
                <MunicipalitySearch
                  value={selectedMunicipality}
                  onChange={setSelectedMunicipality}
                />
              </div>
            </div>
          </div>
        )}

        {result && result.error && !result.success && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Analyse mislukt</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}
      </div>
    );
  };

  const renderAnalyzeStep = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="url">Overzichtspagina URL</Label>
        <p className="text-xs text-muted-foreground">
          De pagina waarop alle events staan (bijv. evenementenoverzicht, agenda)
        </p>
        <div className="flex gap-2">
          <Input
            id="url"
            placeholder="bijv. https://agenda.gemeente.nl/evenementen"
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
              'Analyseer'
            )}
          </Button>
        </div>
      </div>

      {(analyzeMutation.isPending || result) && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Import opties (in volgorde van voorkeur)</Label>
          <div className="border rounded-lg divide-y">
            {(result?.steps || [
              { id: 'json-api', name: 'JSON API', description: 'WordPress REST API of custom JSON endpoint', status: 'checking' as const, result: null },
              { id: 'rss', name: 'RSS/Atom Feed', description: 'Standaard RSS of Atom feed', status: 'checking' as const, result: null },
              { id: 'ical', name: 'iCal/ICS', description: 'Kalender export formaat', status: 'checking' as const, result: null },
              { id: 'json-ld', name: 'JSON-LD Schema', description: 'Gestructureerde data in de HTML pagina', status: 'checking' as const, result: null },
              { id: 'scraper', name: 'HTML Scraper', description: 'Direct scrapen van de HTML', status: 'checking' as const, result: null },
            ]).map((step) => {
              const isSelectable = step.status === 'success' && step.id !== 'scraper';
              const isSelected = selectedMethodId === step.id;
              return (
                <div 
                  key={step.id} 
                  className={`flex items-center gap-3 p-3 transition-colors ${
                    isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 
                    step.status === 'success' ? 'bg-green-50' : ''
                  } ${isSelectable ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                  onClick={() => isSelectable && setSelectedMethodId(step.id)}
                >
                  <div className="flex-shrink-0">
                    {isSelectable ? (
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-400'
                      }`}>
                        {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                    ) : (
                      getStepIcon(step.status)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{step.name}</span>
                      {step.status === 'success' && step.result && (
                        <Badge variant="secondary" className={isSelected ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}>
                          {step.result.eventCount} events
                        </Badge>
                      )}
                      {isSelected && <Badge className="bg-blue-500">Geselecteerd</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {result?.isComplete && selectedMethodId && selectedMethodId !== 'scraper' && (
        <div className="space-y-4">
          {getSelectedMethod() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                <Check className="w-5 h-5" />
                Geselecteerd: {getSelectedMethod()?.name}
                <Badge className="bg-blue-200 text-blue-900">
                  {getSelectedMethod()?.eventCount} events
                </Badge>
              </h4>
              <p className="text-sm text-blue-700 mt-1">Klik op een andere optie hierboven om te wisselen</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="feedName">Feed naam</Label>
              <Input
                id="feedName"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder={result.suggestedFeedName || 'Geef de feed een naam'}
              />
            </div>
            <div className="space-y-2">
              <Label>Gemeente</Label>
              <MunicipalitySearch
                value={selectedMunicipality}
                onChange={setSelectedMunicipality}
              />
            </div>
          </div>

          {/* Feed Field Mapper toggle */}
          <div className={`border rounded-lg ${showFieldMapper ? 'p-6 bg-white' : 'p-4 bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-base">Veld Toewijzing</h4>
                <p className="text-sm text-muted-foreground">
                  Bekijk welke velden zijn gedetecteerd en wijs ze toe aan event eigenschappen
                </p>
              </div>
              <Button
                variant={showFieldMapper ? "secondary" : "outline"}
                size="default"
                onClick={() => setShowFieldMapper(!showFieldMapper)}
              >
                {showFieldMapper ? (
                  <>
                    <X className="w-4 h-4 mr-2" />
                    Sluiten
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Velden bekijken
                  </>
                )}
              </Button>
            </div>
            
            {showFieldMapper && getSelectedMethod()?.url && (
              <div className="mt-6">
                <ScrollArea className="max-h-[60vh]">
                  <FeedFieldMapper
                    feedUrl={getSelectedMethod()!.url}
                    initialMapping={fieldMapping}
                    onMappingComplete={(mapping, discovery) => {
                      setFieldMapping(mapping as Record<string, string>);
                      toast({
                        title: "Mapping opgeslagen",
                        description: `${Object.keys(mapping).length} velden gekoppeld`,
                      });
                      setShowFieldMapper(false);
                    }}
                    onValidationChange={(isValid, missing) => {
                      setFieldMappingValid(isValid);
                      setMissingRequiredFields(missing);
                    }}
                  />
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}

      {result?.isComplete && (result.chosenMethod?.id === 'scraper' || !result.chosenMethod) && (
        <div className="space-y-3">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h4 className="font-semibold text-purple-800 flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Geen feed gevonden — AI Scraper Builder
            </h4>
            <p className="text-sm text-purple-700 mt-1">
              AI kan automatisch de pagina analyseren en een scraper configureren. Dit analyseert zowel de overzichts- als detailpagina's.
            </p>
            <div className="mt-3 space-y-2">
              <Label htmlFor="feedName">Feed naam</Label>
              <Input
                id="feedName"
                value={feedName}
                onChange={(e) => setFeedName(e.target.value)}
                placeholder={result.suggestedFeedName || 'Geef de feed een naam'}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <Button onClick={handleStartAiScraper} className="bg-purple-600 hover:bg-purple-700">
                <Brain className="w-4 h-4 mr-2" />
                Start AI Analyse
              </Button>
              <Button variant="outline" onClick={handleGoToConfigureStep}>
                <Crosshair className="w-4 h-4 mr-2" />
                Handmatig Configureren
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderConfigureStep = () => (
    <div className="flex gap-4 h-[calc(95vh-200px)]">
      <div className="w-80 flex flex-col gap-3">
        <Card className="flex-shrink-0">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Pagina Context
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={pageContext === 'overview' ? 'default' : 'outline'}
                className="flex-1 text-xs"
                onClick={handleLoadOverviewPage}
                disabled={fetchPageMutation.isPending}
              >
                <List className="h-3 w-3 mr-1" />
                Overzicht
              </Button>
              <Button
                size="sm"
                variant={pageContext === 'detail' ? 'default' : 'outline'}
                className="flex-1 text-xs"
                onClick={() => setPageContext('detail')}
                disabled={!detailUrl}
              >
                <FileText className="h-3 w-3 mr-1" />
                Detail
              </Button>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Detail pagina URL (optioneel)</Label>
              <div className="flex gap-1">
                <Input
                  value={detailUrl}
                  onChange={(e) => setDetailUrl(e.target.value)}
                  placeholder="URL van een voorbeeld event"
                  className="h-7 text-xs"
                />
                <Button 
                  size="sm" 
                  variant="outline"
                  className="h-7 px-2"
                  onClick={handleLoadDetailPage}
                  disabled={!detailUrl || fetchPageMutation.isPending}
                >
                  <RefreshCw className={`h-3 w-3 ${fetchPageMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex-1 overflow-hidden">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MousePointer2 className="h-4 w-4" />
              Veld Selectors
            </CardTitle>
            <CardDescription className="text-xs">
              Klik op een veld en selecteer het element
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="p-2 space-y-2">
                <div
                  className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                    activeField === 'eventCard' 
                      ? 'border-blue-500 bg-blue-50' 
                      : selectors.eventCard 
                        ? 'border-green-300 bg-green-50' 
                        : 'border-red-300 bg-red-50'
                  }`}
                  onClick={() => setActiveField('eventCard')}
                  onMouseEnter={() => selectors.eventCard && setHighlightedSelector(selectors.eventCard)}
                  onMouseLeave={() => setHighlightedSelector('')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      <span className="font-medium text-xs">Event Card</span>
                      <Badge variant="destructive" className="text-[10px] h-4">Verplicht</Badge>
                    </div>
                    {selectors.eventCard ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  {activeField === 'eventCard' ? (
                    <Input
                      className="mt-2 text-xs h-7"
                      placeholder="CSS selector invoeren..."
                      value={selectors.eventCard || ''}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        setSelectors(prev => ({ ...prev, eventCard: e.target.value }));
                        setHighlightedSelector(e.target.value);
                      }}
                    />
                  ) : selectors.eventCard && (
                    <code className="text-[10px] text-muted-foreground mt-1 block truncate">
                      {selectors.eventCard}
                    </code>
                  )}
                </div>

                <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded flex items-center gap-1">
                  <List className="h-3 w-3" />
                  Alle velden (configureerbaar op {pageContext === 'overview' ? 'overzicht' : 'detail'} pagina)
                </div>
                {FIELD_CONFIG.map((field) => {
                  const isActive = activeField === field.id;
                  const hasValue = !!selectors[field.id];

                  return (
                    <div
                      key={field.id}
                      className={`p-2 rounded-lg border-2 cursor-pointer transition-all ${
                        isActive 
                          ? 'border-blue-500 bg-blue-50' 
                          : hasValue 
                            ? 'border-green-300 bg-green-50' 
                            : field.required 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setActiveField(field.id)}
                      onMouseEnter={() => selectors[field.id] && setHighlightedSelector(selectors[field.id]!)}
                      onMouseLeave={() => setHighlightedSelector('')}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          {field.icon}
                          <span className="font-medium text-xs">{field.name}</span>
                          {field.required && <Badge variant="destructive" className="text-[10px] h-4">!</Badge>}
                        </div>
                        {hasValue ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : field.required ? (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        ) : null}
                      </div>
                      {isActive && (
                        <Input
                          className="mt-2 text-xs h-7"
                          placeholder="CSS selector invoeren..."
                          value={selectors[field.id] || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            setSelectors(prev => ({ ...prev, [field.id]: e.target.value }));
                            setHighlightedSelector(e.target.value);
                          }}
                        />
                      )}
                      {!isActive && selectors[field.id] && (
                        <code className="text-[10px] text-muted-foreground mt-1 block truncate">
                          {selectors[field.id]}
                        </code>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="flex-shrink-0">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Map className="h-4 w-4" />
              Gemeente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <MunicipalitySearch
              value={selectedMunicipality}
              onChange={setSelectedMunicipality}
            />
          </CardContent>
        </Card>

        <Card className="flex-shrink-0">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-sm flex items-center gap-2">
              {hasErrors ? (
                <AlertCircle className="h-4 w-4 text-red-500" />
              ) : (
                <Check className="h-4 w-4 text-green-500" />
              )}
              Validatie
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 pt-0">
            <div className="space-y-1">
              {validationIssues.length === 0 ? (
                <p className="text-xs text-green-600">Alle velden geconfigureerd!</p>
              ) : (
                validationIssues.slice(0, 3).map((issue, idx) => (
                  <div key={idx} className={`flex items-start gap-1 text-[10px] ${
                    issue.type === 'error' ? 'text-red-600' : 'text-yellow-600'
                  }`}>
                    {issue.type === 'error' ? (
                      <X className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span>{issue.message}</span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 flex flex-col border rounded-lg overflow-hidden relative">
        <div className="flex items-center justify-between bg-muted/50 px-3 py-1.5 border-b gap-2">
          <span className="text-xs text-muted-foreground flex-1">
            {showImagesOnly 
              ? 'Afbeeldingen modus - klik op een afbeelding om te selecteren' 
              : 'Klik = selecteren | Ctrl+klik = verbergen'}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'vfc_resetHidden',
                  nonce: messageNonce,
                }, '*');
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset verborgen
            </Button>
            <Button
              size="sm"
              variant={showImagesOnly ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setShowImagesOnly(!showImagesOnly)}
            >
              <ImageIcon className="h-3 w-3 mr-1" />
              {showImagesOnly ? 'Normale weergave' : 'Alleen afbeeldingen'}
            </Button>
          </div>
        </div>
        {iframeLoading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        )}
        {pageHtml ? (
          <iframe
            ref={iframeRef}
            srcDoc={pageHtml + injectHighlightScript()}
            className="w-full flex-1 overflow-auto"
            sandbox="allow-scripts allow-same-origin"
            title="Page Preview"
            referrerPolicy="no-referrer"
            onLoad={() => {
              setIframeLoading(false);
              if (showImagesOnly) {
                iframeRef.current?.contentWindow?.postMessage({
                  type: 'vfc_showImagesOnly',
                  nonce: messageNonce,
                  enabled: true,
                }, '*');
              }
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Crosshair className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Pagina wordt geladen...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderPreviewStep = () => {
    if (previewFeedMutation.isPending || testEventsMutation.isPending) {
      const progress = previewProgress;
      return (
        <div className="space-y-6 py-8">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-lg font-medium mb-2">
              {progress?.message || 'Events ophalen en analyseren...'}
            </p>
            
            <div className="w-full max-w-md">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Voortgang</span>
                <span>{progress?.current || 0}%</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress?.current || 0}%` }}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
              <span className={progress?.phase === 'fetching' ? 'text-blue-600 font-medium' : ''}>
                {progress?.phase === 'fetching' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                Feed ophalen
              </span>
              <span className={progress?.phase === 'parsing' ? 'text-blue-600 font-medium' : ''}>
                {progress?.phase === 'parsing' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                Events parsen
              </span>
              <span className={progress?.phase === 'validating' ? 'text-blue-600 font-medium' : ''}>
                {progress?.phase === 'validating' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                Valideren
              </span>
              <span className={progress?.phase === 'geocoding' ? 'text-blue-600 font-medium' : ''}>
                {progress?.phase === 'geocoding' && <Loader2 className="w-3 h-3 inline mr-1 animate-spin" />}
                Locaties
              </span>
            </div>
          </div>
        </div>
      );
    }

    if (previewResult?.error) {
      return (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Preview mislukt</AlertTitle>
          <AlertDescription>{previewResult.error}</AlertDescription>
        </Alert>
      );
    }

    const summary = previewResult?.summary;
    const items = previewResult?.items || [];
    const hasIncomplete = summary && summary.incomplete > 0;
    const isInTestMode = previewResult?.isTestMode;
    const totalAvailable = summary?.totalAvailable || summary?.total || 0;

    return (
      <div className="space-y-4">
        {/* Test mode banner */}
        {isInTestMode && summary && (
          <Alert className="bg-blue-50 border-blue-200">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800">Test modus: eerste {summary.total} events</AlertTitle>
            <AlertDescription className="text-blue-700">
              Dit is een test met de eerste {summary.total} events van {totalAvailable} totaal beschikbaar.
              Controleer of de gegevens correct zijn geëxtraheerd voordat je alle events ophaalt.
            </AlertDescription>
          </Alert>
        )}

        {/* AI cost indicator */}
        {summary && (summary.aiCallsUsed !== undefined) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-gray-50 p-2 rounded border">
            <span className="font-medium">AI gebruik:</span>
            <span className={summary.aiCallsUsed >= (summary.aiCallsLimit || 50) ? 'text-red-600 font-medium' : ''}>
              {summary.aiCallsUsed} / {summary.aiCallsLimit || 50} calls
            </span>
            {summary.aiCallsUsed >= (summary.aiCallsLimit || 50) && (
              <span className="text-red-600 text-xs">(limiet bereikt)</span>
            )}
          </div>
        )}

        {summary && (
          <div className={`p-4 rounded-lg border ${hasIncomplete ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex items-center gap-3 mb-3">
              {hasIncomplete ? (
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              ) : (
                <Check className="h-5 w-5 text-green-600" />
              )}
              <div>
                <h3 className="font-semibold">
                  {hasIncomplete ? 'Sommige events zijn incompleet' : 'Alle events zijn compleet'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isInTestMode 
                    ? `${summary.total} test events: ${summary.complete} compleet, ${summary.incomplete} incompleet`
                    : `${summary.total} events gevonden: ${summary.complete} compleet, ${summary.incomplete} incompleet`
                  }
                </p>
              </div>
            </div>

            {hasIncomplete && Object.keys(summary.missingFieldsCounts).length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <p className="text-sm font-medium mb-2">Ontbrekende velden:</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summary.missingFieldsCounts).map(([field, count]) => (
                    <Badge key={field} variant="secondary" className="bg-amber-100">
                      {field === 'location' ? 'Locatie' : 
                       field === 'title' ? 'Titel' :
                       field === 'description' ? 'Beschrijving' :
                       field === 'startTime' ? 'Datum' :
                       field === 'imageUrl' ? 'Afbeelding' : field}: {count}x
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Test mode action buttons */}
        {isInTestMode && (
          <div className="flex gap-3 p-4 bg-slate-50 rounded-lg border">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewResult(null);
                setCurrentStep(directVisualMode ? 'direct-overview' : 'configure');
              }}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Terug naar configurator
            </Button>
            <Button
              onClick={() => {
                setIsTestMode(false);
                setPreviewResult(null);
                // Re-run with full fetch
                if (directVisualMode) {
                  testEventsMutation.mutate();
                } else {
                  previewFeedMutation.mutate();
                }
              }}
              disabled={testEventsMutation.isPending || previewFeedMutation.isPending}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {(testEventsMutation.isPending || previewFeedMutation.isPending) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Alle {totalAvailable} events ophalen
            </Button>
          </div>
        )}

        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {items.slice(0, 20).map((event, idx) => (
              <Card key={idx} className={`overflow-hidden ${!event.isComplete ? 'border-amber-300 bg-amber-50/50' : ''}`}>
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate flex items-center gap-2">
                        {event.isComplete ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                        )}
                        {event.title}
                      </div>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        {event.startTime && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(event.startTime).toLocaleDateString('nl-NL')}
                          </span>
                        )}
                        {(event.location || event.address) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {event.address || event.location}
                          </span>
                        )}
                      </div>
                      {!event.isComplete && event.validationIssues.length > 0 && (
                        <div className="mt-2 text-xs text-amber-700">
                          {event.validationIssues.map((issue, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {issue}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {event.imageUrl && (
                      <img src={event.imageUrl} alt="" className="w-16 h-12 object-cover rounded flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {items.length > 20 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                En nog {items.length - 20} andere events...
              </p>
            )}
          </div>
        </ScrollArea>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="feedNamePreview">Feed naam</Label>
            <Input
              id="feedNamePreview"
              value={feedName}
              onChange={(e) => setFeedName(e.target.value)}
              placeholder="Geef de feed een naam"
            />
          </div>
          <div className="space-y-2">
            <Label>Gemeente</Label>
            <MunicipalitySearch
              value={selectedMunicipality}
              onChange={setSelectedMunicipality}
            />
          </div>
        </div>

        {hasIncomplete && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Ontbrekende velden aanvullen?</p>
                <p className="text-xs text-blue-700">Gebruik de visuele configurator om selectors te markeren voor de ontbrekende velden.</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setCurrentStep('configure');
                  setPageContext('overview');
                  setIframeLoading(true);
                  fetchPageMutation.mutate(overviewUrl);
                }}
              >
                <MousePointer2 className="w-4 h-4 mr-2" />
                Configureren
              </Button>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Globe className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Overstappen naar visuele scraping?</p>
                <p className="text-xs text-amber-700">Negeer de huidige feed en configureer alle velden visueel op de pagina.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedMethodId('scraper');
                  setSelectors({ eventCard: '' });
                  setCurrentStep('configure');
                  setPageContext('overview');
                  setIframeLoading(true);
                  fetchPageMutation.mutate(overviewUrl);
                }}
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Visuele scraping
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${currentStep === 'configure' || currentStep === 'direct-detail' || currentStep === 'direct-overview' || showFieldMapper ? 'max-w-[95vw] w-[95vw]' : 'max-w-2xl'} max-h-[95vh] overflow-hidden flex flex-col`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            {directVisualMode ? 'Visuele Scraper Configureren' : 'Feed Configureren'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'analyze' && 'Voer de URL van de overzichtspagina in om de beste import methode te vinden'}
            {currentStep === 'ai-scraper' && 'AI analyseert automatisch de overzichts- en detailpagina\'s'}
            {currentStep === 'configure' && 'Selecteer de event velden op de overzicht- en detailpagina'}
            {currentStep === 'preview' && 'Bekijk de gevonden events en sla de configuratie op'}
            {currentStep === 'direct-detail' && 'Voer een voorbeeld detailpagina URL in en configureer de event velden'}
            {currentStep === 'direct-overview' && 'Voer de overzichtspagina URL in waar event-links staan'}
          </DialogDescription>

          {directVisualMode ? (
            <div className="flex items-center gap-2 pt-2">
              <Badge variant={currentStep === 'direct-detail' ? 'default' : 'secondary'} className="text-xs">
                1. Detailpagina
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant={currentStep === 'direct-overview' ? 'default' : 'secondary'} className="text-xs">
                2. Overzichtspagina
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant={currentStep === 'preview' ? 'default' : 'secondary'} className="text-xs">
                3. Opslaan
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => { if (currentStep !== 'analyze') setCurrentStep('analyze'); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  currentStep === 'analyze' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                <Rss className="w-3 h-3" />
                1. Feed zoeken
                {result?.isComplete && result.chosenMethod && result.chosenMethod.id !== 'scraper' && (
                  <Check className="w-3 h-3 text-green-300" />
                )}
                {result?.isComplete && (!result.chosenMethod || result.chosenMethod.id === 'scraper') && (
                  <X className="w-3 h-3 text-red-300" />
                )}
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => { if (aiScraperResult || aiScraperFromAnalyze) setCurrentStep('ai-scraper'); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  currentStep === 'ai-scraper' ? 'bg-purple-600 text-white' :
                  aiScraperResult ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' :
                  'bg-secondary/50 text-muted-foreground'
                }`}
              >
                <Brain className="w-3 h-3" />
                2. AI Scraper
                {aiScraperResult && aiScraperResult.confidence >= 70 && (
                  <Check className="w-3 h-3 text-green-300" />
                )}
                {aiScraperResult && aiScraperResult.confidence > 0 && aiScraperResult.confidence < 70 && (
                  <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-current">
                    {aiScraperResult.confidence}%
                  </Badge>
                )}
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <button
                onClick={() => { if (currentStep === 'preview' || currentStep === 'configure') setCurrentStep('configure'); }}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                  currentStep === 'configure' ? 'bg-primary text-primary-foreground' :
                  'bg-secondary/50 text-muted-foreground'
                }`}
              >
                <Crosshair className="w-3 h-3" />
                3. Handmatig
              </button>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <Badge variant={currentStep === 'preview' ? 'default' : 'secondary'} className="text-xs">
                4. Opslaan
              </Badge>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {currentStep === 'analyze' && renderAnalyzeStep()}
          {currentStep === 'ai-scraper' && renderAiScraperStep()}
          {currentStep === 'configure' && renderConfigureStep()}
          {currentStep === 'preview' && renderPreviewStep()}
          {currentStep === 'direct-detail' && renderDirectDetailStep()}
          {currentStep === 'direct-overview' && renderDirectOverviewStep()}
        </div>

        <DialogFooter className="mt-4">
          {currentStep !== 'analyze' && currentStep !== 'direct-detail' && (
            <Button variant="outline" onClick={() => {
              if (currentStep === 'preview') {
                if (directVisualMode) {
                  setCurrentStep('direct-overview');
                  setPageContext('overview');
                  if (overviewUrl) {
                    setIframeLoading(true);
                    fetchPageMutation.mutate(overviewUrl);
                  } else {
                    setPageHtml('');
                  }
                } else {
                  setCurrentStep('configure');
                  setPageContext('overview');
                  setIframeLoading(true);
                  fetchPageMutation.mutate(overviewUrl);
                }
              } else if (currentStep === 'direct-overview') {
                setCurrentStep('direct-detail');
                setPageContext('detail');
                if (detailUrl) {
                  setIframeLoading(true);
                  fetchPageMutation.mutate(detailUrl);
                } else {
                  setPageHtml('');
                }
              } else if (currentStep === 'ai-scraper') {
                setCurrentStep('analyze');
              } else if (currentStep === 'configure' && aiScraperFromAnalyze) {
                setCurrentStep('ai-scraper');
              } else {
                setCurrentStep('analyze');
              }
            }}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Vorige
            </Button>
          )}
          
          <Button variant="outline" onClick={handleClose}>
            Annuleren
          </Button>

          {currentStep === 'analyze' && result?.isComplete && selectedMethodId && selectedMethodId !== 'scraper' && (
            <div className="flex items-center gap-2">
              {Object.keys(fieldMapping).length > 0 && !fieldMappingValid && missingRequiredFields.length > 0 && (
                <span className="text-sm text-amber-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  Vul in: {missingRequiredFields.join(', ')}
                </span>
              )}
              <Button 
                onClick={() => previewFeedMutation.mutate()}
                disabled={previewFeedMutation.isPending || (Object.keys(fieldMapping).length > 0 && !fieldMappingValid)}
              >
                {previewFeedMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Preview laden...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Naar Preview
                  </>
                )}
              </Button>
            </div>
          )}

          {currentStep === 'ai-scraper' && aiScraperResult && !aiScraperMutation.isPending && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAiScraperResult(null);
                  aiScraperMutation.mutate(overviewUrl);
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Opnieuw
              </Button>
              <Button
                variant="outline"
                onClick={handleAiScraperToVisual}
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Handmatig aanpassen
              </Button>
              {aiScraperResult.success && aiScraperResult.confidence >= 30 && (
                <Button
                  onClick={handleAiScraperSave}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Naar Visuele Check
                </Button>
              )}
            </div>
          )}

          {currentStep === 'configure' && (
            <Button 
              onClick={() => testEventsMutation.mutate()}
              disabled={hasErrors || testEventsMutation.isPending}
            >
              {testEventsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testen...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Test & Valideer
                </>
              )}
            </Button>
          )}

          {currentStep === 'direct-detail' && pageHtml && (
            <Button 
              onClick={() => {
                const requiredFields = ['title', 'date', 'location'] as const;
                const missing = requiredFields.filter(f => !selectors[f]);
                if (missing.length > 0) {
                  toast({
                    title: 'Verplichte velden ontbreken',
                    description: `Configureer eerst: ${missing.join(', ')}`,
                    variant: 'destructive',
                  });
                  return;
                }
                setCurrentStep('direct-overview');
                setPageContext('overview');
                setPageHtml('');
              }}
            >
              <ChevronRight className="w-4 h-4 mr-2" />
              Naar Overzicht
            </Button>
          )}

          {currentStep === 'direct-overview' && pageHtml && selectors.eventCard && (
            <Button 
              onClick={() => testEventsMutation.mutate()}
              disabled={testEventsMutation.isPending}
            >
              {testEventsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Testen...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Test & Valideer
                </>
              )}
            </Button>
          )}

          {currentStep === 'preview' && (
            <Button 
              onClick={() => {
                if (directVisualMode || result?.chosenMethod?.id === 'scraper') {
                  saveConfigMutation.mutate();
                } else {
                  createFeedMutation.mutate();
                }
              }}
              disabled={saveConfigMutation.isPending || createFeedMutation.isPending}
            >
              {(saveConfigMutation.isPending || createFeedMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opslaan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Feed Opslaan
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
