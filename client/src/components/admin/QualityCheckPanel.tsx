import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  Loader2, 
  Sparkles,
  Image,
  MapPin,
  Calendar,
  FileText,
  Link as LinkIcon,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface QualityCheckResult {
  hasCheck: boolean;
  checkId?: number;
  feedId?: number;
  status?: 'completed' | 'failed';
  totalEventsChecked?: number;
  eventsWithIssues?: number;
  overallScore?: number;
  issues?: QualityIssue[];
  usedGemini?: boolean;
  geminiSampleSize?: number;
}

interface QualityIssue {
  id: number;
  qualityCheckId: number;
  eventId: number | null;
  feedItemId: number | null;
  issueType: string;
  severity: 'error' | 'warning' | 'info';
  field: string | null;
  message: string;
  sourceValue: string | null;
  importedValue: string | null;
  isResolved: boolean;
  createdAt: string;
}

interface QualityCheckPanelProps {
  feedId: number;
  feedName: string;
}

const issueTypeIcons: Record<string, typeof Image> = {
  'missing_image': Image,
  'broken_image': Image,
  'short_description': FileText,
  'invalid_coordinates': MapPin,
  'location_outside_nl': MapPin,
  'past_event': Calendar,
  'invalid_date_range': Calendar,
  'broken_source_link': LinkIcon,
  'title_mismatch': FileText,
  'date_mismatch': Calendar,
  'description_mismatch': FileText,
  'source_mismatch': Shield,
};

const issueTypeLabels: Record<string, string> = {
  'missing_image': 'Ontbrekende afbeelding',
  'broken_image': 'Kapotte afbeelding',
  'short_description': 'Korte beschrijving',
  'invalid_coordinates': 'Ongeldige coördinaten',
  'location_outside_nl': 'Locatie buiten NL',
  'past_event': 'Verlopen event',
  'invalid_date_range': 'Ongeldige datumreeks',
  'broken_source_link': 'Kapotte bronlink',
  'title_mismatch': 'Titel afwijking',
  'date_mismatch': 'Datum afwijking',
  'description_mismatch': 'Beschrijving afwijking',
  'source_mismatch': 'Bron afwijking',
};

export default function QualityCheckPanel({ feedId, feedName }: QualityCheckPanelProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const { data: checkResult, isLoading: isLoadingCheck, refetch } = useQuery<QualityCheckResult>({
    queryKey: ['/api/admin/rss-feeds', feedId, 'quality-check'],
    enabled: isOpen,
  });

  const runBasicCheckMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/rss-feeds/${feedId}/quality-check`, {
        method: 'POST',
        data: { useGemini: false },
      });
    },
    onSuccess: () => {
      toast({
        title: 'Kwaliteitscontrole voltooid',
        description: 'De basis kwaliteitscontrole is uitgevoerd.',
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds', feedId, 'quality-check'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message || 'Kwaliteitscontrole mislukt',
        variant: 'destructive',
      });
    },
  });

  const runGeminiCheckMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/admin/rss-feeds/${feedId}/quality-check`, {
        method: 'POST',
        data: { useGemini: true },
      });
    },
    onSuccess: () => {
      toast({
        title: 'AI Kwaliteitscontrole voltooid',
        description: 'De AI-gestuurde steekproefcontrole is uitgevoerd.',
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds', feedId, 'quality-check'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Fout',
        description: error.message || 'AI controle mislukt',
        variant: 'destructive',
      });
    },
  });

  const resolveIssueMutation = useMutation({
    mutationFn: async (issueId: number) => {
      return apiRequest(`/api/admin/quality-issues/${issueId}/resolve`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      refetch();
    },
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Fout</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" /> Waarschuwing</Badge>;
      case 'info':
        return <Badge variant="secondary"><Info className="w-3 h-3 mr-1" /> Info</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const isRunning = runBasicCheckMutation.isPending || runGeminiCheckMutation.isPending;

  const groupedIssues = checkResult?.issues?.reduce((acc, issue) => {
    const type = issue.issueType;
    if (!acc[type]) acc[type] = [];
    acc[type].push(issue);
    return acc;
  }, {} as Record<string, QualityIssue[]>) || {};

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Shield className="w-4 h-4" />
          Kwaliteit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kwaliteitscontrole: {feedName}</DialogTitle>
          <DialogDescription>
            Controleer de data kwaliteit van geïmporteerde evenementen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex gap-3">
            <Button 
              onClick={() => runBasicCheckMutation.mutate()}
              disabled={isRunning}
            >
              {runBasicCheckMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Basis Controle (gratis)
            </Button>
            <Button 
              variant="secondary"
              onClick={() => runGeminiCheckMutation.mutate()}
              disabled={isRunning}
            >
              {runGeminiCheckMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              AI Steekproef (3 events)
            </Button>
          </div>

          {isLoadingCheck ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : checkResult?.hasCheck ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center justify-between">
                    Laatste controle
                    {checkResult.usedGemini && (
                      <Badge variant="secondary" className="ml-2">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI ({checkResult.geminiSampleSize} events)
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Score</div>
                      <div className={`text-2xl font-bold ${getScoreColor(checkResult.overallScore || 0)}`}>
                        {checkResult.overallScore}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Gecontroleerd</div>
                      <div className="text-2xl font-bold">{checkResult.totalEventsChecked}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Met problemen</div>
                      <div className="text-2xl font-bold text-orange-600">{checkResult.eventsWithIssues}</div>
                    </div>
                  </div>
                  <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                    <div 
                      className={`absolute left-0 top-0 h-full transition-all ${getScoreProgressColor(checkResult.overallScore || 0)}`}
                      style={{ width: `${checkResult.overallScore || 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {Object.keys(groupedIssues).length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Gevonden problemen ({checkResult.issues?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Object.entries(groupedIssues).map(([type, issues]) => {
                        const IconComponent = issueTypeIcons[type] || AlertTriangle;
                        const label = issueTypeLabels[type] || type;
                        
                        return (
                          <div key={type} className="border rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <IconComponent className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">{label}</span>
                              <Badge variant="outline">{issues.length}</Badge>
                            </div>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Bericht</TableHead>
                                  <TableHead>Ernst</TableHead>
                                  <TableHead>Waarde</TableHead>
                                  <TableHead className="w-20">Actie</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {issues.slice(0, 5).map((issue) => (
                                  <TableRow key={issue.id} className={issue.isResolved ? 'opacity-50' : ''}>
                                    <TableCell className="text-sm">{issue.message}</TableCell>
                                    <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                      {issue.importedValue || issue.sourceValue || '-'}
                                    </TableCell>
                                    <TableCell>
                                      {!issue.isResolved && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => resolveIssueMutation.mutate(issue.id)}
                                          disabled={resolveIssueMutation.isPending}
                                        >
                                          <CheckCircle className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {issues.length > 5 && (
                              <div className="text-xs text-muted-foreground mt-2">
                                En nog {issues.length - 5} meer...
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-semibold text-lg">Geen problemen gevonden</h3>
                    <p className="text-muted-foreground">
                      Alle gecontroleerde events voldoen aan de kwaliteitseisen.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold text-lg">Nog geen controle uitgevoerd</h3>
                <p className="text-muted-foreground">
                  Klik op "Basis Controle" om de kwaliteit van deze feed te controleren.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Basis controle (gratis):</strong> Controleert foto's, beschrijvingen, locaties, datums en links.</p>
            <p><strong>AI Steekproef:</strong> Vergelijkt 3 willekeurige events met de bronpagina via Gemini AI.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
