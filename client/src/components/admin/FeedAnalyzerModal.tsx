import { useState } from 'react';
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
import { 
  Check, 
  Loader2, 
  X, 
  AlertCircle, 
  Link as LinkIcon, 
  Save, 
  MessageSquare,
  ChevronRight,
  Info,
  Calendar,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
  Crosshair,
} from 'lucide-react';

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

interface FeedAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedCreated?: () => void;
  onOpenVisualConfigurator?: (url: string) => void;
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

export default function FeedAnalyzerModal({ open, onOpenChange, onFeedCreated, onOpenVisualConfigurator }: FeedAnalyzerModalProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<ProgressiveAnalysisResult | null>(null);
  const [showSampleEvent, setShowSampleEvent] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedName, setFeedName] = useState('');

  const analyzeMutation = useMutation({
    mutationFn: async (urlToAnalyze: string): Promise<ProgressiveAnalysisResult> => {
      return apiRequest('/api/admin/rss-feeds/analyze-progressive', {
        method: 'POST',
        data: { url: urlToAnalyze },
      });
    },
    onSuccess: (data) => {
      setResult(data);
      if (data.suggestedFeedName) {
        setFeedName(data.suggestedFeedName);
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
      if (!result?.chosenMethod) return;
      
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
          name: feedName || result.suggestedFeedName || 'Nieuwe Feed',
          url: result.chosenMethod.url,
          feedType: getFeedType(result.chosenMethod.id),
          municipality: result.suggestedMunicipality || '',
          defaultCategory: 'Gezellig en Sociaal',
          autoCreateEvents: true,
          updateFrequencyMinutes: 60,
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

  const handleAnalyze = () => {
    if (!url.trim()) return;
    setResult(null);
    setShowSampleEvent(false);
    setFeedback('');
    analyzeMutation.mutate(url.trim());
  };

  const handleClose = () => {
    setUrl('');
    setResult(null);
    setShowSampleEvent(false);
    setFeedback('');
    setFeedName('');
    onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5" />
            AI Feed Analyzer
          </DialogTitle>
          <DialogDescription>
            Plak een website URL om automatisch de beste import methode te vinden
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                placeholder="bijv. visittiel.nl of https://agenda.tilburg.nl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                disabled={analyzeMutation.isPending}
              />
              <Button 
                onClick={handleAnalyze} 
                disabled={!url.trim() || analyzeMutation.isPending}
              >
                {analyzeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Analyseer'
                )}
              </Button>
            </div>
          </div>

          {/* Analysis Steps */}
          {(analyzeMutation.isPending || result) && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Import opties (in volgorde van voorkeur)</Label>
              <div className="border rounded-lg divide-y">
                {(result?.steps || [
                  { id: 'json-api', name: 'JSON API', description: 'WordPress REST API of custom JSON endpoint', status: 'checking' as const, result: null },
                  { id: 'rss', name: 'RSS/Atom Feed', description: 'Standaard RSS of Atom feed', status: 'checking' as const, result: null },
                  { id: 'ical', name: 'iCal/ICS', description: 'Kalender export formaat', status: 'checking' as const, result: null },
                  { id: 'json-ld', name: 'JSON-LD Schema', description: 'Gestructureerde data in de HTML pagina', status: 'checking' as const, result: null },
                  { id: 'scraper', name: 'HTML Scraper', description: 'Direct scrapen van de HTML (laatste optie)', status: 'checking' as const, result: null },
                ]).map((step) => (
                  <div key={step.id} className={`flex items-center gap-3 p-3 ${step.status === 'success' ? 'bg-green-50' : ''}`}>
                    <div className="flex-shrink-0">{getStepIcon(step.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{step.name}</span>
                        {step.status === 'success' && step.result && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            {step.result.eventCount} events
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    {step.status === 'success' && (
                      <ChevronRight className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Results Section */}
          {result?.isComplete && result.chosenMethod && (
            <div className="space-y-4">
              {/* Chosen Method */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-semibold text-green-800 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Aanbevolen: {result.chosenMethod.name}
                  <Badge className="bg-green-200 text-green-900">
                    {result.chosenMethod.eventCount} events
                  </Badge>
                </h4>
                <p className="text-sm text-green-700 mt-1">{result.chosenMethod.pros}</p>
                <div className="mt-2 text-xs text-green-700">
                  <strong>Feed URL:</strong>{' '}
                  <code className="bg-green-100 px-1 py-0.5 rounded text-xs break-all">
                    {result.chosenMethod.url}
                  </code>
                </div>
              </div>

              {/* Content Quality Warning */}
              {result.contentQuality && (
                <div className={`rounded-lg p-4 ${
                  result.contentQuality.estimatedCompletePercentage >= 60 
                    ? 'bg-green-50 border border-green-200' 
                    : result.contentQuality.estimatedCompletePercentage >= 30
                    ? 'bg-yellow-50 border border-yellow-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <h4 className={`font-semibold flex items-center gap-2 ${
                    result.contentQuality.estimatedCompletePercentage >= 60 
                      ? 'text-green-800' 
                      : result.contentQuality.estimatedCompletePercentage >= 30
                      ? 'text-yellow-800'
                      : 'text-red-800'
                  }`}>
                    <Info className="w-4 h-4" />
                    Data Kwaliteit: ~{result.contentQuality.estimatedCompletePercentage}% events bruikbaar
                  </h4>
                  
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      {result.contentQuality.hasStructuredDates || result.contentQuality.canExtractDates ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                      <span>Datums: {
                        result.contentQuality.hasStructuredDates 
                          ? 'Gestructureerd aanwezig' 
                          : result.contentQuality.canExtractDates 
                          ? 'Extraheerbaar uit content' 
                          : 'Niet gevonden'
                      }</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {result.contentQuality.hasStructuredLocations || result.contentQuality.canExtractLocations ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <X className="w-4 h-4 text-red-600" />
                      )}
                      <span>Locaties: {
                        result.contentQuality.hasStructuredLocations 
                          ? 'GPS coördinaten aanwezig' 
                          : result.contentQuality.canExtractLocations 
                          ? 'Adressen gevonden, worden gegeocodeerd' 
                          : 'Niet gevonden'
                      }</span>
                    </div>
                  </div>

                  {result.contentQuality.warnings.length > 0 && (
                    <div className="mt-2">
                      {result.contentQuality.warnings.map((warning, idx) => (
                        <p key={idx} className="text-xs text-red-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {warning}
                        </p>
                      ))}
                    </div>
                  )}

                  {result.contentQuality.recommendations.length > 0 && (
                    <div className="mt-2">
                      {result.contentQuality.recommendations.map((rec, idx) => (
                        <p key={idx} className="text-xs text-blue-700 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          {rec}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Field Detection Info */}
              {(() => {
                const successStep = result.steps?.find(s => s.status === 'success' && s.result?.fieldDetection);
                const detection = successStep?.result?.fieldDetection;
                if (!detection || detection.detectedFields.length === 0) return null;
                
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
                      <Info className="w-4 h-4" />
                      Automatisch gedetecteerde velden
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {detection.detectedFields.slice(0, 8).map((field, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm bg-white rounded px-2 py-1">
                          <Badge variant="outline" className={`text-xs ${
                            field.fieldType.includes('lat') || field.fieldType.includes('lng') 
                              ? 'border-green-500 text-green-700'
                              : field.fieldType.includes('date') || field.fieldType.includes('calendar')
                              ? 'border-purple-500 text-purple-700'
                              : 'border-blue-500 text-blue-700'
                          }`}>
                            {field.fieldType.replace('_', ' ')}
                          </Badge>
                          <span className="text-xs text-muted-foreground truncate" title={field.fieldPath}>
                            {field.fieldPath}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {Math.round(field.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-4 text-xs text-blue-700">
                      <span>Locatie: {detection.locationCompleteness}% compleet</span>
                      <span>Datum: {detection.dateCompleteness}% compleet</span>
                    </div>
                    {Object.keys(detection.suggestedMappings).length > 0 && (
                      <p className="mt-1 text-xs text-blue-600">
                        Mappings worden automatisch opgeslagen en hergebruikt voor deze bron.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Feed Name and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="feedName">Feed naam</Label>
                  <Input
                    id="feedName"
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    placeholder={result.suggestedFeedName || 'Geef de feed een naam'}
                  />
                  {result.suggestedMunicipality && (
                    <p className="text-xs text-muted-foreground">
                      Gemeente: <strong>{result.suggestedMunicipality}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* Import Rules */}
              <Accordion type="single" collapsible>
                <AccordionItem value="rules">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Import eisen voor events
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-2">
                      {IMPORT_RULES_SUMMARY.map((rule) => (
                        <div key={rule.title} className="flex items-start gap-2 p-2 bg-muted/50 rounded">
                          <rule.icon className="w-4 h-4 mt-0.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{rule.title}</p>
                            <p className="text-xs text-muted-foreground">{rule.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Sample Event */}
                {result.sampleEvent && (
                  <AccordionItem value="sample">
                    <AccordionTrigger className="text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Voorbeeld event bekijken
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                        <div>
                          <Label className="text-xs text-muted-foreground">Titel</Label>
                          <p className="text-sm font-medium">{result.sampleEvent.title || '-'}</p>
                        </div>
                        {result.sampleEvent.description && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Beschrijving</Label>
                            <p className="text-sm">{result.sampleEvent.description}</p>
                          </div>
                        )}
                        {result.sampleEvent.date && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Datum</Label>
                            <p className="text-sm">{result.sampleEvent.date}</p>
                          </div>
                        )}
                        {result.sampleEvent.location && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Locatie</Label>
                            <p className="text-sm">{result.sampleEvent.location}</p>
                          </div>
                        )}
                        {result.sampleEvent.image && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Afbeelding</Label>
                            <img 
                              src={result.sampleEvent.image} 
                              alt="Event" 
                              className="mt-1 max-w-[200px] rounded"
                              onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                          </div>
                        )}
                        {result.sampleEvent.link && (
                          <div>
                            <a 
                              href={result.sampleEvent.link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                            >
                              Bekijk origineel <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              {/* Feedback Section */}
              <div className="space-y-2">
                <Label htmlFor="feedback" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Feedback (optioneel)
                </Label>
                <Textarea
                  id="feedback"
                  placeholder="Wat moet er beter of anders aan de analyse? Dit helpt ons om het systeem te verbeteren..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* No viable method found - offer visual configurator */}
          {result && !result.chosenMethod && result.isComplete && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Geen automatische import methode gevonden
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                We konden geen automatische import methode vinden voor deze website.
                Gebruik de visuele configurator om handmatig de event velden te selecteren.
              </p>
              {onOpenVisualConfigurator && (
                <Button 
                  variant="default" 
                  className="mt-3"
                  onClick={() => {
                    onOpenVisualConfigurator(url);
                    handleClose();
                  }}
                >
                  <Crosshair className="w-4 h-4 mr-2" />
                  Open Visuele Configurator
                </Button>
              )}
            </div>
          )}

          {/* Scraper method found - offer visual configurator for better results */}
          {result?.isComplete && result.chosenMethod?.id === 'scraper' && onOpenVisualConfigurator && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-semibold text-blue-800 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Betere resultaten met visuele configuratie
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                De automatische HTML scraper mist vaak belangrijke informatie. 
                Gebruik de visuele configurator om handmatig de juiste velden te selecteren voor nauwkeurigere imports.
              </p>
              <Button 
                variant="default" 
                className="mt-3"
                onClick={() => {
                  onOpenVisualConfigurator(url);
                  handleClose();
                }}
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Open Visuele Configurator
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Annuleren
          </Button>
          {result?.isComplete && result.chosenMethod && (
            <Button 
              onClick={() => createFeedMutation.mutate()}
              disabled={createFeedMutation.isPending}
            >
              {createFeedMutation.isPending ? (
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
