import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Map,
} from 'lucide-react';
import { DUTCH_MUNICIPALITIES, type Municipality } from '@shared/dutch-municipalities';

interface EventPrinciple {
  id: string;
  name: string;
  required: boolean;
  description: string;
  icon: React.ReactNode;
  status: 'pending' | 'configured' | 'warning' | 'error';
  selector?: string;
  sampleValue?: string;
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

interface DetectedElement {
  selector: string;
  sampleText: string;
  tagName: string;
  classList: string[];
  count: number;
}

interface VisualFeedConfiguratorProps {
  isOpen: boolean;
  onClose: () => void;
  initialUrl?: string;
  onSave?: (config: SelectorConfig) => void;
}

const FIELD_CONFIG: { id: keyof Omit<SelectorConfig, 'eventCard'>; name: string; required: boolean; description: string; icon: React.ReactNode }[] = [
  { id: 'title', name: 'Titel', required: true, description: 'Naam van het evenement', icon: <Type className="h-4 w-4" /> },
  { id: 'date', name: 'Datum', required: true, description: 'Startdatum (en eventueel einddatum)', icon: <Calendar className="h-4 w-4" /> },
  { id: 'time', name: 'Tijd', required: false, description: 'Start- en eindtijd (alleen als 100% zeker)', icon: <Clock className="h-4 w-4" /> },
  { id: 'location', name: 'Locatie', required: true, description: 'GPS of geocodeerbaar adres', icon: <MapPin className="h-4 w-4" /> },
  { id: 'venue', name: 'Venue', required: false, description: 'Naam van de locatie/zaal (bijv. "Paradiso", "De Oosterpoort")', icon: <Building2 className="h-4 w-4" /> },
  { id: 'venueDescription', name: 'Venue Omschrijving', required: false, description: 'Beschrijving of info over de venue', icon: <Building2 className="h-4 w-4" /> },
  { id: 'description', name: 'Beschrijving', required: false, description: 'Omschrijving van het event', icon: <FileText className="h-4 w-4" /> },
  { id: 'image', name: 'Afbeelding', required: false, description: 'Afbeelding URL (voorkeur bron)', icon: <ImageIcon className="h-4 w-4" /> },
  { id: 'link', name: 'Link', required: false, description: 'Externe URL naar event', icon: <LinkIcon className="h-4 w-4" /> },
];

const generateNonce = () => {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

function MunicipalitySearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [search, setSearch] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (value && value !== search) {
      setSearch(value);
    }
  }, [value]);
  
  // Filter municipalities - show all when search is empty
  const filteredMunicipalities = DUTCH_MUNICIPALITIES
    .filter(m => {
      if (!search.trim()) return true; // Show all when empty
      const searchLower = search.toLowerCase();
      return m.name.toLowerCase().includes(searchLower) ||
             m.province.toLowerCase().includes(searchLower);
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 100); // Show more results

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
          placeholder="Typ om te zoeken in 342 gemeentes..."
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
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-64 overflow-auto"
          >
            <div className="sticky top-0 bg-gray-50 px-3 py-1 text-xs text-muted-foreground border-b">
              {filteredMunicipalities.length} van {DUTCH_MUNICIPALITIES.length} gemeentes
            </div>
            {filteredMunicipalities.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground text-center">
                Geen gemeentes gevonden voor "{search}"
              </div>
            ) : (
              filteredMunicipalities.map((m) => (
                <div
                  key={m.name}
                  className={`px-3 py-2 text-xs cursor-pointer hover:bg-accent flex justify-between ${
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

export default function VisualFeedConfigurator({ isOpen, onClose, initialUrl = '', onSave }: VisualFeedConfiguratorProps) {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [url, setUrl] = useState(initialUrl);
  const [pageHtml, setPageHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeField, setActiveField] = useState<keyof Omit<SelectorConfig, 'eventCard'> | 'eventCard' | null>(null);
  const [selectors, setSelectors] = useState<SelectorConfig>({ eventCard: '' });
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>([]);
  const [previewMode, setPreviewMode] = useState<'select' | 'preview'>('select');
  const [highlightedSelector, setHighlightedSelector] = useState<string>('');
  const [messageNonce] = useState(() => generateNonce());
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');
  const [suggestedMunicipality, setSuggestedMunicipality] = useState<string>('');
  const [previewEvents, setPreviewEvents] = useState<Array<{
    title: string;
    date: string;
    location: string;
    description?: string;
    image?: string;
    link?: string;
    venue?: string;
  }>>([]);
  const [totalEventsFound, setTotalEventsFound] = useState<number>(0);
  const [showPreviewPanel, setShowPreviewPanel] = useState(false);

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
      setDetectedElements(data.suggestedElements || []);
      
      // Try to suggest municipality based on URL domain
      const domain = data.domain?.toLowerCase() || '';
      const matchedMunicipality = DUTCH_MUNICIPALITIES.find(m => {
        const nameNormalized = m.name.toLowerCase().replace(/[^a-z]/g, '');
        const nameWithDashes = m.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '');
        return domain.includes(nameNormalized) || domain.includes(nameWithDashes);
      });
      if (matchedMunicipality) {
        setSuggestedMunicipality(matchedMunicipality.name);
        toast({
          title: 'Pagina geladen',
          description: `Gemeente "${matchedMunicipality.name}" gedetecteerd. Pas aan indien nodig.`,
        });
      } else {
        toast({
          title: 'Pagina geladen',
          description: 'Klik op elementen om ze te labelen. Selecteer ook een gemeente.',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Fout bij laden',
        description: error.message || 'Kon de pagina niet laden.',
        variant: 'destructive',
      });
    },
  });

  const handleLoadPage = () => {
    if (!url) return;
    setIsLoading(true);
    fetchPageMutation.mutate(url);
    setIsLoading(false);
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

  const getPrincipleStatus = (fieldId: keyof SelectorConfig): 'pending' | 'configured' | 'warning' | 'error' => {
    const selector = selectors[fieldId];
    if (!selector) {
      const config = FIELD_CONFIG.find(f => f.id === fieldId);
      if (config?.required) return 'error';
      return 'pending';
    }
    return 'configured';
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
      issues.push({ type: 'error', message: 'Datum selector is verplicht (event moet datum hebben)' });
    }
    if (!selectors.location) {
      issues.push({ type: 'error', message: 'Locatie selector is verplicht (geen fallback locaties)' });
    }
    if (selectors.time && !selectors.date) {
      issues.push({ type: 'warning', message: 'Tijd zonder datum gedefinieerd' });
    }
    if (selectors.date && selectors.time && selectors.date === selectors.time) {
      issues.push({ type: 'info', message: 'Datum en tijd in hetzelfde veld - AI zal automatisch datum en tijd scheiden bij import' });
    }
    if (!selectors.image) {
      issues.push({ type: 'warning', message: 'Geen afbeelding selector - stock images worden gebruikt' });
    }

    return issues;
  };

  const canSave = () => {
    const issues = getValidationSummary();
    return !issues.some(i => i.type === 'error') && pageHtml;
  };

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const parsedUrl = new URL(url);
      const response = await apiRequest('/api/admin/visual-configurator/save-config', {
        method: 'POST',
        data: { 
          url, 
          domain: parsedUrl.hostname,
          selectors,
          municipality: selectedMunicipality || suggestedMunicipality || undefined,
        },
      });
      return response;
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Configuratie opgeslagen',
        description: 'De visuele feed configuratie is succesvol opgeslagen.',
      });
      onSave?.(selectors);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Fout bij opslaan',
        description: error.message || 'Kon de configuratie niet opslaan.',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (!canSave()) {
      toast({
        title: 'Configuratie incompleet',
        description: 'Los alle verplichte velden op voordat je opslaat.',
        variant: 'destructive',
      });
      return;
    }
    saveConfigMutation.mutate();
  };

  // Test/preview events mutation
  const testEventsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('/api/admin/visual-configurator/test', {
        method: 'POST',
        data: { url, selectors },
      });
      return response;
    },
    onSuccess: (data: any) => {
      setPreviewEvents(data.previewEvents || []);
      setTotalEventsFound(data.totalFound || 0);
      setShowPreviewPanel(true);
      toast({
        title: 'Events gevonden',
        description: data.message || `${data.totalFound} events gevonden`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Test mislukt',
        description: error.message || 'Kon events niet ophalen.',
        variant: 'destructive',
      });
    },
  });

  const handleTestEvents = () => {
    if (!selectors.eventCard || !selectors.title || !selectors.date) {
      toast({
        title: 'Configuratie incompleet',
        description: 'Configureer minimaal Event Card, Titel en Datum voordat je test.',
        variant: 'destructive',
      });
      return;
    }
    testEventsMutation.mutate();
  };

  const injectHighlightScript = () => {
    return `
      <script>
        const VFC_NONCE = '${messageNonce}';
        let activeSelector = '';
        
        // Fix lazy-loaded images to make them visible and selectable
        (function fixImages() {
          document.querySelectorAll('img').forEach(img => {
            // Convert lazy-load attributes to src
            const lazySrc = img.getAttribute('data-src') || 
                           img.getAttribute('data-lazy-src') || 
                           img.getAttribute('data-original') ||
                           img.getAttribute('data-lazy') ||
                           img.getAttribute('data-srcset');
            // Check if current src is empty, missing, or a placeholder
            const currentSrc = img.src || '';
            const isPlaceholder = !currentSrc || 
                                  currentSrc.includes('placeholder') || 
                                  currentSrc.includes('blank') ||
                                  currentSrc.includes('data:image') ||
                                  currentSrc.includes('1x1') ||
                                  currentSrc.endsWith('.gif') && currentSrc.includes('pixel');
            if (lazySrc && (isPlaceholder || !img.src)) {
              img.src = lazySrc;
            }
            // Make all images visible
            img.style.visibility = 'visible';
            img.style.opacity = '1';
            img.style.display = img.style.display === 'none' ? 'block' : img.style.display;
            // Remove loading="lazy" to force load
            img.removeAttribute('loading');
            // Add min dimensions if image is too small
            if (!img.style.minWidth) {
              img.style.minWidth = '50px';
              img.style.minHeight = '50px';
            }
          });
          // Also handle background images in style
          document.querySelectorAll('[style*="background"]').forEach(el => {
            el.style.visibility = 'visible';
            el.style.opacity = '1';
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
            if (classes.length > 0) {
              selector = '.' + classes.join('.');
            }
          }
          
          if (!selector) {
            selector = target.tagName.toLowerCase();
          }
          
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
        .vfc-highlight {
          outline: 3px solid #3b82f6 !important;
          outline-offset: 2px !important;
        }
      </style>
    `;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.nonce !== messageNonce) {
        return;
      }
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

  const validationIssues = getValidationSummary();
  const hasErrors = validationIssues.some(i => i.type === 'error');
  const hasWarnings = validationIssues.some(i => i.type === 'warning');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[98vw] w-[1600px] h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crosshair className="h-5 w-5" />
            Visuele Feed Configurator
          </DialogTitle>
          <DialogDescription>
            Wijs visueel de event-elementen aan op een voorbeeldpagina. Deze configuratie wordt gebruikt om events te importeren.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-6 min-h-0">
          <div className="w-96 flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                placeholder="https://voorbeeld.nl/evenementen"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleLoadPage} disabled={fetchPageMutation.isPending || !url}>
                {fetchPageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            <Card className="flex-1 overflow-hidden">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4" />
                  Veld Selectors
                </CardTitle>
                <CardDescription className="text-xs">
                  Klik op een veld en selecteer het element in de preview
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[400px]">
                  <div className="p-3 space-y-2">
                    <div
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
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
                          <span className="font-medium text-sm">Event Card</span>
                          <Badge variant="destructive" className="text-xs">Verplicht</Badge>
                        </div>
                        {selectors.eventCard ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Het container-element dat één evenement omvat. Klik op het blok/kaart dat alle info van één event bevat (titel, datum, locatie etc.).
                      </p>
                      {selectors.eventCard && (
                        <code className="text-xs text-muted-foreground mt-1 block truncate">
                          {selectors.eventCard}
                        </code>
                      )}
                    </div>

                    {FIELD_CONFIG.map((field) => {
                      const status = getPrincipleStatus(field.id);
                      const isActive = activeField === field.id;
                      const hasValue = !!selectors[field.id];

                      return (
                        <div
                          key={field.id}
                          className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
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
                            <div className="flex items-center gap-2">
                              {field.icon}
                              <span className="font-medium text-sm">{field.name}</span>
                              {field.required && <Badge variant="destructive" className="text-xs">Verplicht</Badge>}
                            </div>
                            {hasValue ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : field.required ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
                          {selectors[field.id] && (
                            <code className="text-xs text-muted-foreground mt-1 block truncate">
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

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Map className="h-4 w-4" />
                  Gemeente
                </CardTitle>
                <CardDescription className="text-xs">
                  Selecteer de gemeente waartoe deze feed behoort
                </CardDescription>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                {suggestedMunicipality && !selectedMunicipality && (
                  <div className="mb-2 p-2 bg-blue-50 rounded text-xs text-blue-700 flex items-center gap-2">
                    <Info className="h-3 w-3" />
                    Suggestie: {suggestedMunicipality}
                  </div>
                )}
                <MunicipalitySearch
                  value={selectedMunicipality || suggestedMunicipality || ''}
                  onChange={setSelectedMunicipality}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  {hasErrors ? (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  ) : hasWarnings ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                  Validatie Event Principes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2">
                  {validationIssues.length === 0 ? (
                    <p className="text-sm text-green-600">Alle principes zijn correct geconfigureerd!</p>
                  ) : (
                    validationIssues.map((issue, idx) => (
                      <div key={idx} className={`flex items-start gap-2 text-xs ${
                        issue.type === 'error' ? 'text-red-600' : issue.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                      }`}>
                        {issue.type === 'error' ? (
                          <X className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        ) : issue.type === 'warning' ? (
                          <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        ) : (
                          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                        )}
                        <span>{issue.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant={activeField ? 'default' : 'secondary'}>
                  {activeField ? `Selecteer: ${activeField}` : 'Geen veld geselecteerd'}
                </Badge>
              </div>
              <Tabs value={previewMode} onValueChange={(v) => setPreviewMode(v as 'select' | 'preview')}>
                <TabsList className="h-8">
                  <TabsTrigger value="select" className="text-xs">Selector Mode</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="flex-1 border rounded-lg overflow-hidden bg-white">
              {pageHtml ? (
                <iframe
                  ref={iframeRef}
                  srcDoc={pageHtml + injectHighlightScript()}
                  className="w-full h-full"
                  sandbox="allow-scripts allow-same-origin"
                  title="Page Preview"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Crosshair className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Voer een URL in en klik op laden om de pagina te bekijken</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Preview Panel */}
        {showPreviewPanel && previewEvents.length > 0 && (
          <Card className="mt-4 max-h-56 overflow-auto">
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview: {totalEventsFound} events gevonden op deze pagina
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowPreviewPanel(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-3 gap-2">
                {previewEvents.slice(0, 6).map((event, idx) => (
                  <div key={idx} className="border rounded p-2 text-xs">
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {event.date}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.location || 'Geen locatie'}
                    </div>
                    {event.image ? (
                      <img src={event.image} alt="" className="mt-1 h-12 w-full object-cover rounded" />
                    ) : (
                      <div className="mt-1 h-12 bg-muted rounded flex items-center justify-center text-muted-foreground">
                        Stock foto
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {totalEventsFound > 0 && (
                <Alert className="mt-3">
                  <Info className="h-4 w-4" />
                  <AlertTitle className="text-xs">Paginering Tip</AlertTitle>
                  <AlertDescription className="text-xs">
                    Er zijn {totalEventsFound} events gevonden op deze pagina. De parser zoekt automatisch naar paginering links om meer events te vinden tijdens synchronisatie. Events zonder afbeelding krijgen een stock foto.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        <DialogFooter className="flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            {Object.values(selectors).filter(Boolean).length} van {FIELD_CONFIG.length + 1} velden geconfigureerd
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Annuleren
            </Button>
            <Button 
              variant="secondary" 
              onClick={handleTestEvents} 
              disabled={!selectors.eventCard || !selectors.title || !selectors.date || testEventsMutation.isPending}
            >
              {testEventsMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Test Events
            </Button>
            <Button onClick={handleSave} disabled={!canSave() || saveConfigMutation.isPending}>
              {saveConfigMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Configuratie Opslaan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
