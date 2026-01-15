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
}

interface FeedAnalyzerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFeedCreated?: () => void;
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

export default function FeedAnalyzerModal({ open, onOpenChange, onFeedCreated }: FeedAnalyzerModalProps) {
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
      
      return apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: feedName || result.suggestedFeedName || 'Nieuwe Feed',
          url: result.chosenMethod.url,
          feedType: result.chosenMethod.id === 'json-api' ? 'json' : 'rss',
          municipality: result.suggestedMunicipality || '',
          defaultCategory: '',
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
            Feed Analyzer
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
                  { id: 'rss', name: 'RSS/Atom Feed', description: 'Standaard RSS of Atom feed', status: 'pending' as const, result: null },
                  { id: 'ical', name: 'iCal/ICS', description: 'Kalender export formaat', status: 'pending' as const, result: null },
                  { id: 'json-ld', name: 'JSON-LD Schema', description: 'Gestructureerde data in de HTML pagina', status: 'pending' as const, result: null },
                  { id: 'scraper', name: 'HTML Scraper', description: 'Direct scrapen van de HTML (laatste optie)', status: 'pending' as const, result: null },
                ]).map((step, idx) => (
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
                  Gekozen methode: {result.chosenMethod.name}
                </h4>
                <p className="text-sm text-green-700 mt-1">{result.chosenMethod.reason}</p>
                <p className="text-xs text-green-600 mt-2">{result.chosenMethod.pros}</p>
                <div className="mt-2 text-xs text-green-700">
                  <strong>Feed URL:</strong>{' '}
                  <code className="bg-green-100 px-1 py-0.5 rounded text-xs break-all">
                    {result.chosenMethod.url}
                  </code>
                </div>
              </div>

              {/* Feed Name Input */}
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
                    Gemeente gedetecteerd: <strong>{result.suggestedMunicipality}</strong>
                  </p>
                )}
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

          {/* No viable method found */}
          {result && !result.chosenMethod && result.isComplete && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Geen geschikte import methode gevonden
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                We konden geen automatische import methode vinden voor deze website.
                Probeer een andere pagina of neem contact op voor handmatige configuratie.
              </p>
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
