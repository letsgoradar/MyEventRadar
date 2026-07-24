import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminLayout from '@/components/Layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Trash2, Edit, ExternalLink, Rss, Globe, AlertCircle, CheckCircle, Eye, Map, List, AlertTriangle, Loader2, Sparkles, Crosshair, FileCode, Clock, Download, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { nl } from 'date-fns/locale';
import { CATEGORIES } from '@shared/schema';
import { lazy, Suspense, Fragment } from 'react';

import { SyncHistoryTooltip } from '@/components/admin/SyncHistoryTooltip';

interface SyncHistoryEntry {
  id: number;
  syncedAt: string;
  durationMs: number | null;
  totalFound: number | null;
  newEvents: number | null;
  updatedEvents: number | null;
  incompleteEvents: number | null;
  skippedEvents: number | null;
  errorMessage: string | null;
  success: boolean | null;
}

function NoImageDialog({ feed, onClose }: { feed: { id: number; name: string } | null; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ events: Array<{ id: number; title: string; startTime: string | null; category: string | null; address: string | null }>; total: number }>({
    queryKey: ['/api/admin/rss-feeds', feed?.id, 'events-without-image'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rss-feeds/${feed!.id}/events-without-image`, { credentials: 'include' });
      if (!res.ok) throw new Error('Kon events niet laden');
      return res.json();
    },
    enabled: !!feed,
    staleTime: 60000,
  });

  return (
    <Dialog open={!!feed} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Toekomstige events zonder afbeelding</DialogTitle>
          <DialogDescription>{feed?.name}{data ? ` · ${data.total} events` : ''}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-1 pr-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Laden...</div>
          ) : !data || data.events.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">Geen toekomstige events zonder afbeelding gevonden.</div>
          ) : (
            data.events.map((ev) => (
              <a key={ev.id} href={`/event/${ev.id}`} target="_blank" rel="noopener noreferrer"
                className="block border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">{ev.title}</span>
                  {ev.startTime && <span className="text-xs text-muted-foreground shrink-0">{format(new Date(ev.startTime), 'd MMM yyyy', { locale: nl })}</span>}
                </div>
                {ev.address && <div className="text-xs text-muted-foreground mt-0.5 truncate">{ev.address}</div>}
              </a>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeedDetailPanel({ feed, info, platformFamilies, onPlatformChange }: {
  feed: { id: number; name: string; url: string };
  info?: {
    status: string; reason: string; catchRate: number | null; totalFound: number; imported: number;
    activeEvents: number; futureEvents: number; lastSuccessfulSyncAt: string | null;
    dropoutReasons: Array<{ reason: string; count: number }>; openIssues: { error: number; warning: number };
    platform: string;
    imageQuality: number | null;
    descriptionQuality: number | null;
  };
  platformFamilies: Record<string, { label: string; description: string }>;
  onPlatformChange: (platform: string) => void;
}) {
  const [noImageDialogOpen, setNoImageDialogOpen] = useState(false);
  const { toast } = useToast();

  const mergeMultidayMutation = useMutation({
    mutationFn: () => apiRequest(`/api/admin/rss-feeds/${feed.id}/merge-multiday`, { method: 'POST' }),
    onSuccess: (data: any) => {
      toast({ title: 'Samenvoegen voltooid', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds', feed.id] });
    },
    onError: (error: any) => {
      toast({ title: 'Fout', description: error.message || 'Samenvoegen mislukt', variant: 'destructive' });
    },
  });

  const { data: syncData } = useQuery<{ history: SyncHistoryEntry[]; avgDurationMs: number | null }>({
    queryKey: ['/api/admin/rss-feeds', feed.id, 'sync-history'],
    queryFn: async () => {
      const res = await fetch(`/api/admin/rss-feeds/${feed.id}/sync-history`, { credentials: 'include' });
      if (!res.ok) throw new Error('Kon sync-geschiedenis niet laden');
      return res.json();
    },
    staleTime: 30000,
  });

  return (
    <div className="py-3 space-y-4 text-sm" onClick={(e) => e.stopPropagation()} data-testid={`feed-detail-${feed.id}`}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <div className="text-xs text-muted-foreground">Actieve events</div>
          <div className="font-semibold">{info?.activeEvents ?? '-'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Toekomstige events</div>
          <div className="font-semibold">{info?.futureEvents ?? '-'}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Vangst laatste sync</div>
          <div className="font-semibold">
            {info?.catchRate !== null && info?.catchRate !== undefined
              ? `${info.catchRate}% (${info.imported} van ${info.totalFound})`
              : 'Onbekend'}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Laatste geslaagde sync</div>
          <div className="font-semibold">
            {info?.lastSuccessfulSyncAt ? format(new Date(info.lastSuccessfulSyncAt), 'd MMM yyyy HH:mm', { locale: nl }) : 'Nooit'}
          </div>
        </div>
      </div>

      {info?.reason && (
        <p className="text-xs text-muted-foreground italic">{info.reason}</p>
      )}

      {info && (info.imageQuality !== null || info.descriptionQuality !== null) && (
        <div className="flex flex-wrap gap-3 items-center">
          {info.imageQuality !== null && (
            <button
              type="button"
              onClick={() => setNoImageDialogOpen(true)}
              className="flex items-center gap-1.5 text-xs hover:underline"
              title="Klik om events zonder afbeelding te bekijken"
            >
              <span className="text-muted-foreground">Afbeeldingen:</span>
              <span className={`font-semibold ${info.imageQuality < 0.7 ? 'text-orange-600' : 'text-green-600'}`}>
                {Math.round(info.imageQuality * 100)}%
              </span>
              {info.imageQuality < 1 && <span className="text-muted-foreground">↗</span>}
            </button>
          )}
          {info.descriptionQuality !== null && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Beschrijving:</span>
              <span className={`font-semibold ${info.descriptionQuality < 0.7 ? 'text-orange-600' : 'text-green-600'}`}>
                {Math.round(info.descriptionQuality * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
      <NoImageDialog
        feed={noImageDialogOpen ? { id: feed.id, name: feed.name } : null}
        onClose={() => setNoImageDialogOpen(false)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label className="text-xs">Platform-familie:</Label>
        <Select value={info?.platform || 'maatwerk'} onValueChange={onPlatformChange}>
          <SelectTrigger className="w-[220px] h-8 text-xs" data-testid={`select-platform-${feed.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(platformFamilies).map(([key, fam]) => (
              <SelectItem key={key} value={key}>{fam.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {info && (info.openIssues.error > 0 || info.openIssues.warning > 0) && (
          <span className="text-xs">
            Open issues:{' '}
            {info.openIssues.error > 0 && <Badge variant="destructive" className="text-xs mr-1">{info.openIssues.error} errors</Badge>}
            {info.openIssues.warning > 0 && <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700">{info.openIssues.warning} waarschuwingen</Badge>}
          </span>
        )}
      </div>

      {info && info.dropoutReasons.length > 0 && (
        <div>
          <div className="text-xs font-medium mb-1">Belangrijkste uitvalredenen</div>
          <div className="flex flex-wrap gap-1.5">
            {info.dropoutReasons.map((d) => (
              <Badge key={d.reason} variant="outline" className="text-xs">
                {d.reason}: {d.count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-xs font-medium mb-1">Laatste syncs</div>
        {!syncData ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Laden...</div>
        ) : syncData.history.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nog geen syncs uitgevoerd.</div>
        ) : (
          <div className="space-y-1">
            {syncData.history.slice(0, 6).map((h) => (
              <div key={h.id} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${h.success === false ? 'bg-red-500' : 'bg-green-500'}`} />
                <span className="text-muted-foreground w-[120px] shrink-0">
                  {format(new Date(h.syncedAt), 'd MMM HH:mm', { locale: nl })}
                </span>
                {h.success === false ? (
                  <span className="text-red-600 truncate" title={h.errorMessage || ''}>{h.errorMessage || 'Mislukt'}</span>
                ) : (
                  <span className="text-muted-foreground">
                    {h.totalFound ?? 0} gevonden · {(h.newEvents ?? 0)} nieuw · {(h.updatedEvents ?? 0)} bijgewerkt
                    {(h.incompleteEvents ?? 0) > 0 && ` · ${h.incompleteEvents} incompleet`}
                    {(h.skippedEvents ?? 0) > 0 && ` · ${h.skippedEvents} overgeslagen`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={() => mergeMultidayMutation.mutate()}
          disabled={mergeMultidayMutation.isPending}
          title="Voeg dagelijkse events met dezelfde naam en locatie samen tot één meerdaags event"
        >
          {mergeMultidayMutation.isPending
            ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Samenvoegen...</>
            : 'Meerdaagse events samenvoegen'}
        </Button>
      </div>
    </div>
  );
}

interface ImportedEvent {
  id: number;
  title: string;
  startTime: string | null;
  category: string | null;
  address: string | null;
  createdAt: string;
}

function SyncMomentsDialog({ feed, onClose }: {
  feed: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const [selectedMoment, setSelectedMoment] = useState<{ entry: SyncHistoryEntry; from: string; to: string } | null>(null);

  useEffect(() => {
    setSelectedMoment(null);
  }, [feed?.id]);

  const { data: syncData, isLoading: historyLoading } = useQuery<{ history: SyncHistoryEntry[] }>({
    queryKey: ['/api/admin/rss-feeds', feed?.id, 'sync-history', 101],
    queryFn: async () => {
      // 101 ophalen: we tonen er 100, de 101e dient alleen als tijdgrens voor het oudste zichtbare moment
      const res = await fetch(`/api/admin/rss-feeds/${feed!.id}/sync-history?limit=101`, { credentials: 'include' });
      if (!res.ok) throw new Error('Kon sync-geschiedenis niet laden');
      return res.json();
    },
    enabled: !!feed,
    staleTime: 30000,
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery<{ events: ImportedEvent[] }>({
    queryKey: ['/api/admin/rss-feeds', feed?.id, 'imported-events', selectedMoment?.entry.id],
    queryFn: async () => {
      const params = new URLSearchParams({ from: selectedMoment!.from, to: selectedMoment!.to });
      const res = await fetch(`/api/admin/rss-feeds/${feed!.id}/imported-events?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Kon events niet laden');
      return res.json();
    },
    enabled: !!feed && !!selectedMoment,
    staleTime: 30000,
  });

  const selectMoment = (entry: SyncHistoryEntry, index: number, history: SyncHistoryEntry[]) => {
    // Half-open venster: (vorige oudere sync, dit sync-moment]. De 101e rij dient
    // alleen als ondergrens voor het oudste zichtbare moment; is er echt geen
    // oudere sync, dan is "alles ervoor" correct (eerste sync van deze feed).
    const older = history[index + 1];
    const from = older?.syncedAt ?? new Date(0).toISOString();
    const to = new Date(entry.syncedAt).toISOString();
    setSelectedMoment({ entry, from, to });
  };

  return (
    <Dialog open={!!feed} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {selectedMoment ? 'Nieuw opgehaalde events' : 'Laatste 100 sync-momenten'}
          </DialogTitle>
          <DialogDescription>
            {feed?.name}
            {selectedMoment && (
              <> · sync van {format(new Date(selectedMoment.entry.syncedAt), 'd MMM yyyy HH:mm', { locale: nl })}</>
            )}
          </DialogDescription>
        </DialogHeader>

        {selectedMoment ? (
          <div className="space-y-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedMoment(null)} data-testid="button-back-to-moments">
              ← Terug naar sync-momenten
            </Button>
            <div className="max-h-[55vh] overflow-y-auto space-y-1 pr-1">
              {eventsLoading ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Events laden...</div>
              ) : !eventsData || eventsData.events.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">Geen events gevonden voor dit sync-moment.</div>
              ) : (
                eventsData.events.map((ev) => (
                  <a
                    key={ev.id}
                    href={`/event/${ev.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border rounded-md px-3 py-2 hover:bg-muted/50 transition-colors"
                    data-testid={`imported-event-${ev.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{ev.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        opgehaald {format(new Date(ev.createdAt), 'd MMM HH:mm', { locale: nl })}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 mt-0.5">
                      {ev.startTime && <span>Event: {format(new Date(ev.startTime), 'd MMM yyyy HH:mm', { locale: nl })}</span>}
                      {ev.category && <span>{ev.category}</span>}
                      {ev.address && <span className="truncate max-w-[220px]">{ev.address}</span>}
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-1">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2 py-4"><Loader2 className="w-4 h-4 animate-spin" /> Laden...</div>
            ) : !syncData || syncData.history.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">Nog geen syncs uitgevoerd.</div>
            ) : (
              <div className="space-y-1">
                {syncData.history.slice(0, 100).map((h, i) => {
                  const clickable = (h.newEvents ?? 0) > 0;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && selectMoment(h, i, syncData.history)}
                      className={`w-full text-left border rounded-md px-3 py-2 flex items-center gap-3 ${clickable ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-70 cursor-default'}`}
                      title={clickable ? 'Klik om de nieuw opgehaalde events te bekijken' : undefined}
                      data-testid={`sync-moment-${h.id}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${h.success === false ? 'bg-red-500' : 'bg-green-500'}`} />
                      <span className="text-sm w-[140px] shrink-0">
                        {format(new Date(h.syncedAt), 'd MMM yyyy HH:mm', { locale: nl })}
                      </span>
                      {h.success === false ? (
                        <span className="text-xs text-red-600 truncate" title={h.errorMessage || ''}>{h.errorMessage || 'Mislukt'}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex-1">
                          {(h.newEvents ?? 0) > 0 ? (
                            <Badge variant="default" className="bg-green-100 text-green-700 mr-2">+{h.newEvents} nieuw</Badge>
                          ) : (
                            <span className="mr-2">0 nieuw</span>
                          )}
                          {(h.updatedEvents ?? 0) > 0 && `${h.updatedEvents} bijgewerkt · `}
                          {h.totalFound ?? 0} gevonden
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MunicipalityMap = lazy(() => import('@/components/admin/MunicipalityMap'));
const IncompleteItemsManager = lazy(() => import('@/components/admin/IncompleteItemsManager'));
const FeedAnalyzerModal = lazy(() => import('@/components/admin/FeedAnalyzerModal'));
const SimpleFeedWizard = lazy(() => import('@/components/admin/SimpleFeedWizard'));
const QualityCheckPanel = lazy(() => import('@/components/admin/QualityCheckPanel'));
const MunicipalityFeedView = lazy(() => import('@/components/admin/MunicipalityFeedView'));

interface RssFeed {
  id: number;
  name: string;
  url: string;
  feedType: string;
  status: string;
  defaultCategory: string;
  defaultLatitude: string | null;
  defaultLongitude: string | null;
  defaultAddress: string | null;
  municipality: string | null;
  province: string | null;
  updateFrequencyMinutes: number;
  lastFetchedAt: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  itemsImported: number;
  autoCreateEvents: boolean;
  createdAt: string;
  aiExtractionProfileId: number | null;
  platform: string | null;
}

interface SourceFeedInfo {
  feedId: number;
  platform: string;
  status: 'green' | 'orange' | 'red' | 'paused';
  reason: string;
  neverSynced: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncSuccess: boolean | null;
  lastNewEventAt: string | null;
  activeEvents: number;
  futureEvents: number;
  totalFound: number;
  imported: number;
  catchRate: number | null;
  dropoutReasons: Array<{ reason: string; count: number }>;
  openIssues: { error: number; warning: number };
  imageQuality: number | null;
  descriptionQuality: number | null;
}

interface CoverageMunicipality {
  municipality: string;
  province: string | null;
  feeds: Array<{ id: number; name: string; status: string; platform: string; futureEvents: number; lastFetchedAt: string | null }>;
  futureEvents: number;
  hasGap: boolean;
  gapReason: string | null;
}

interface RssFeedStats {
  totalFeeds: number;
  activeFeeds: number;
  errorFeeds: number;
  pausedFeeds: number;
  totalItems: number;
  totalImported: number;
  devMaxFeeds: number | null;
}

export default function RssFeedsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isFeedAnalyzerOpen, setIsFeedAnalyzerOpen] = useState(false);
  const [isSimpleWizardOpen, setIsSimpleWizardOpen] = useState(false);
  const [isDirectVisualMode, setIsDirectVisualMode] = useState(false);
  const [editingFeed, setEditingFeed] = useState<RssFeed | null>(null);
  const [editingVisualFeedId, setEditingVisualFeedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [deleteOptions, setDeleteOptions] = useState<{feedId: number | null, action: 'keep' | 'delete' | 'unlink'}>({feedId: null, action: 'keep'});
  const [editingUrlFeedId, setEditingUrlFeedId] = useState<number | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');
  
  const [newFeed, setNewFeed] = useState({
    name: '',
    url: '',
    feedType: 'rss',
    defaultCategory: '',
    defaultAddress: '',
    defaultLatitude: '',
    defaultLongitude: '',
    municipality: '',
    updateFrequencyMinutes: 60,
    autoCreateEvents: true,
  });

  const { data: feeds = [], isLoading } = useQuery<RssFeed[]>({
    queryKey: ['/api/admin/rss-feeds'],
  });

  const { data: stats } = useQuery<RssFeedStats>({
    queryKey: ['/api/admin/rss-feeds/stats'],
  });

  const { data: feedOverview = {} } = useQuery<Record<number, { totalActive: number; incomplete: number; addedLastSync: number; lastSyncDate: string | null }>>({
    queryKey: ['/api/admin/rss-feeds/overview'],
  });

  const { data: feedHealth = {} } = useQuery<Record<number, { feedId: number; status: 'healthy' | 'warning' | 'suspect' | 'unknown'; reason: string; activeEvents: number; lastSyncAt: string | null }>>({
    queryKey: ['/api/admin/rss-feeds/health'],
    staleTime: 60000,
  });

  const { data: manageData } = useQuery<{ feeds: Record<number, SourceFeedInfo>; platforms: Record<string, { label: string; description: string }> }>({
    queryKey: ['/api/admin/rss-feeds/manage'],
    staleTime: 60000,
  });
  const sourceInfo = manageData?.feeds || {};
  const platformFamilies = manageData?.platforms || {};

  const { data: coverage = [], isLoading: isLoadingCoverage } = useQuery<CoverageMunicipality[]>({
    queryKey: ['/api/admin/rss-feeds/coverage'],
    staleTime: 60000,
    enabled: activeTab === 'coverage',
  });

  const [expandedFeedId, setExpandedFeedId] = useState<number | null>(null);
  const [syncMomentsFeed, setSyncMomentsFeed] = useState<{ id: number; name: string } | null>(null);

  // Fetch saved visual parser configurations
  interface ParserConfig {
    id: number;
    domain: string;
    pathPattern: string;
    selectors: Record<string, string>;
    municipality?: string;
    confidence: number;
    updatedAt: string;
  }
  
  const { data: parserConfigs = [], isLoading: isLoadingParsers } = useQuery<ParserConfig[]>({
    queryKey: ['/api/admin/visual-configurator/configs'],
  });

  const deleteParserMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/visual-configurator/configs/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/visual-configurator/configs'] });
      toast({
        title: 'Parser verwijderd',
        description: 'De visuele parser configuratie is verwijderd.',
      });
    },
    onError: () => {
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het verwijderen.',
        variant: 'destructive',
      });
    },
  });

  const createFeedMutation = useMutation({
    mutationFn: async (feed: typeof newFeed) => {
      return apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: feed,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      setIsAddDialogOpen(false);
      setNewFeed({
        name: '',
        url: '',
        feedType: 'rss',
        defaultCategory: '',
        defaultAddress: '',
        defaultLatitude: '',
        defaultLongitude: '',
        municipality: '',
        updateFrequencyMinutes: 60,
        autoCreateEvents: true,
      });
      toast({
        title: 'Feed toegevoegd',
        description: 'De RSS feed is succesvol toegevoegd.',
      });
    },
    onError: () => {
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het toevoegen van de feed.',
        variant: 'destructive',
      });
    },
  });

  const updateFeedMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<RssFeed> & { id: number }) => {
      return apiRequest(`/api/admin/rss-feeds/${id}`, {
        method: 'PATCH',
        data: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/manage'] });
      setEditingFeed(null);
      toast({
        title: 'Feed bijgewerkt',
        description: 'De RSS feed is succesvol bijgewerkt.',
      });
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async ({id, eventAction}: {id: number, eventAction: 'keep' | 'delete' | 'unlink'}) => {
      return apiRequest(`/api/admin/rss-feeds/${id}?eventAction=${eventAction}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setDeleteOptions({feedId: null, action: 'keep'});
      const actionText = variables.eventAction === 'delete' ? 'en gekoppelde events verwijderd' :
                        variables.eventAction === 'unlink' ? 'en events losgekoppeld' : '';
      toast({
        title: 'Feed verwijderd',
        description: `De RSS feed is succesvol verwijderd${actionText ? ' ' + actionText : ''}.`,
      });
    },
  });

  const [syncingFeedId, setSyncingFeedId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    status: string;
    totalItems: number;
    processedItems: number;
    eventsCreated: number;
    eventsUpdated?: number;
    eventsSkipped?: number;
    eventsRejected?: number;
    rejectionReasons?: Record<string, number>;
    percentComplete: number;
    message?: string;
    logs?: string[];
  } | null>(null);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  
  const pollProgress = async (feedId: number) => {
    try {
      const response = await fetch(`/api/admin/rss-feeds/${feedId}/sync-progress`, {
        credentials: 'include'
      });
      if (!response.ok) {
        // Handle auth errors or other failures
        if (response.status === 401) {
          setSyncProgress(null);
          setSyncingFeedId(null);
        }
        return null;
      }
      const progress = await response.json();
      if (progress.status !== 'idle' && progress.feedId === feedId) {
        setSyncProgress(progress);
      }
      return progress;
    } catch {
      return null;
    }
  };

  const syncSingleFeedMutation = useMutation({
    mutationFn: async (id: number) => {
      const feed = feeds.find(f => f.id === id);
      const feedName = feed?.name || 'Feed';
      const timeStr = new Date().toLocaleTimeString('nl-NL');
      
      // Set UI state immediately for instant feedback
      setSyncingFeedId(id);
      setSyncProgress({ 
        status: 'pending', 
        totalItems: 0, 
        processedItems: 0, 
        eventsCreated: 0, 
        percentComplete: 0,
        message: 'Aanvraag versturen...',
        logs: [
          `[${timeStr}] ▶ Sync aangevraagd voor "${feedName}"`,
          `[${timeStr}] ⏳ Wachten op bevestiging...`
        ]
      });
      
      // Send POST — backend returns 202 immediately (fire-and-forget)
      const response = await fetch(`/api/admin/rss-feeds/${id}/sync`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        const text = await response.text();
        let errorData: any = null;
        try { errorData = JSON.parse(text); } catch { /* not JSON */ }
        setSyncingFeedId(null);
        setSyncProgress(null);
        const error = new Error(errorData?.message || text) as any;
        if (errorData) Object.assign(error, errorData);
        throw error;
      }
      
      const responseData = await response.json();
      
      // Poll until the background sync is done (600ms interval to stay under rate limit).
      // Abort after 20 consecutive null/failed polls (~12s) to prevent indefinite pending.
      return new Promise<any>((resolve, reject) => {
        let nullStreak = 0;
        const MAX_NULL_STREAK = 20;

        const stopPolling = () => {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        };

        pollIntervalRef.current = setInterval(async () => {
          const progress = await pollProgress(id);

          if (!progress) {
            nullStreak++;
            if (nullStreak >= MAX_NULL_STREAK) {
              stopPolling();
              reject(new Error('Kon geen verbinding maken met de sync-status. Controleer je verbinding.'));
            }
            return;
          }

          nullStreak = 0;

          if (progress.status === 'completed') {
            stopPolling();
            resolve({
              feedName: responseData.feedName,
              eventsCreated: progress.eventsCreated || 0,
              eventsUpdated: progress.eventsUpdated || 0,
              itemsProcessed: progress.totalItems || 0,
              success: true,
            });
          } else if (progress.status === 'error') {
            stopPolling();
            reject(new Error(progress.error || 'Sync mislukt'));
          }
        }, 600);
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      setSyncingFeedId(null);
      setSyncProgress(null);
      const parts = [];
      if (data.eventsCreated > 0) parts.push(`${data.eventsCreated} nieuw`);
      if (data.eventsUpdated > 0) parts.push(`${data.eventsUpdated} bijgewerkt`);
      const summary = parts.length > 0 ? parts.join(', ') : 'Geen wijzigingen';
      toast({
        title: 'Feed gesynchroniseerd',
        description: `${data.feedName}: ${summary}.`,
      });
    },
    onError: (error: any) => {
      setSyncingFeedId(null);
      setSyncProgress(null);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      
      if (error.runningFeed) {
        const running = error.runningFeed;
        toast({
          title: `Feed "${running.name}" is al bezig`,
          description: `Wacht tot de huidige sync is voltooid (${running.percentComplete || 0}% klaar).`,
          variant: 'default',
          duration: 5000,
        });
      } else if (error.syncAllProgress) {
        const progress = error.syncAllProgress;
        toast({
          title: 'Sync Alle Feeds is actief',
          description: `Bezig met "${progress.currentFeedName || 'opstarten'}" (${progress.completedFeeds}/${progress.totalFeeds} feeds). Wacht of stop eerst de batch sync.`,
          variant: 'default', 
          duration: 5000,
        });
      } else {
        toast({
          title: 'Sync mislukt',
          description: error.message || 'Er is een fout opgetreden.',
          variant: 'destructive',
        });
      }
    },
  });

  const refreshFeedsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/rss-feeds/refresh', {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      toast({
        title: 'Feeds vernieuwd',
        description: `${data.processed} feeds verwerkt, ${data.errors} fouten.`,
      });
    },
    onError: () => {
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het vernieuwen van de feeds.',
        variant: 'destructive',
      });
    },
  });

  // Sync All Feeds state and mutation
  const [syncAllProgress, setSyncAllProgress] = useState<{
    isRunning: boolean;
    totalFeeds: number;
    completedFeeds: number;
    skippedFeeds?: number;
    currentFeedName: string | null;
    currentFeedProgress?: {
      phase: 'starting' | 'fetching' | 'parsing' | 'processing' | 'saving' | 'completed' | 'error';
      message: string;
      itemsFound?: number;
      itemsProcessed?: number;
      eventsCreated?: number;
      eventsUpdated?: number;
      eventsSkipped?: number;
      currentPage?: number;
      totalPages?: number;
      startedAt: number;
    } | null;
    recentEvents?: string[];
    percentComplete: number;
    feedResults: Array<{
      feedId: number;
      feedName: string;
      status: 'success' | 'error' | 'skipped';
      eventsCreated: number;
      eventsUpdated?: number;
      eventsSkipped?: number;
      eventsRejected?: number;
      message?: string;
      skipReason?: string;
      lastFetchedAt?: string | null;
    }>;
    nextFeedIn?: number;
    totalEventsCreated?: number;
    totalEventsUpdated?: number;
    totalEventsSkipped?: number;
    totalEventsRejected?: number;
  } | null>(null);
  
  const syncAllPollRef = useRef<NodeJS.Timeout | null>(null);
  
  const pollSyncAllProgress = async () => {
    try {
      const response = await fetch('/api/admin/rss-feeds/sync-all/progress', {
        credentials: 'include'
      });
      if (!response.ok) return null;
      const progress = await response.json();
      setSyncAllProgress(progress);
      return progress;
    } catch {
      return null;
    }
  };

  const syncAllFeedsMutation = useMutation({
    mutationFn: async () => {
      setSyncAllProgress({
        isRunning: true,
        totalFeeds: 0,
        completedFeeds: 0,
        currentFeedName: null,
        percentComplete: 0,
        feedResults: []
      });
      
      // Start polling for progress at 300ms for responsive updates
      syncAllPollRef.current = setInterval(async () => {
        const progress = await pollSyncAllProgress();
        if (progress && !progress.isRunning) {
          if (syncAllPollRef.current) {
            clearInterval(syncAllPollRef.current);
            syncAllPollRef.current = null;
          }
        }
      }, 300);
      
      try {
        const result = await apiRequest('/api/admin/rss-feeds/sync-all', {
          method: 'POST',
          data: { delaySeconds: 10 },
        });
        return result;
      } finally {
        // Clean up will happen via polling when isRunning becomes false
      }
    },
    onSuccess: () => {
      toast({
        title: 'Sync All gestart',
        description: 'Alle feeds worden nu een voor een gesynchroniseerd.',
      });
    },
    onError: (error: any) => {
      if (syncAllPollRef.current) {
        clearInterval(syncAllPollRef.current);
        syncAllPollRef.current = null;
      }
      setSyncAllProgress(null);
      toast({
        title: 'Sync All mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  // Retry all error feeds: reset their status then run sync-all with a longer delay
  const retryErrorFeedsMutation = useMutation({
    mutationFn: async () => {
      const resetResult: any = await apiRequest('/api/admin/rss-feeds/reset-error-feeds', { method: 'POST' });
      if (resetResult.reset === 0) {
        throw new Error('Geen feeds met foutmelding gevonden');
      }
      setSyncAllProgress({
        isRunning: true,
        totalFeeds: 0,
        completedFeeds: 0,
        currentFeedName: null,
        percentComplete: 0,
        feedResults: []
      });
      syncAllPollRef.current = setInterval(async () => {
        const progress = await pollSyncAllProgress();
        if (progress && !progress.isRunning) {
          if (syncAllPollRef.current) {
            clearInterval(syncAllPollRef.current);
            syncAllPollRef.current = null;
          }
        }
      }, 300);
      try {
        await apiRequest('/api/admin/rss-feeds/sync-all', {
          method: 'POST',
          data: { delaySeconds: 15 },
        });
        return resetResult;
      } finally {}
    },
    onSuccess: (data: any) => {
      toast({
        title: `${data.reset} foutieve feeds worden opnieuw geprobeerd`,
        description: 'Feeds worden een voor een gesynchroniseerd met 15 seconden tussenpauze.',
      });
    },
    onError: (error: any) => {
      if (syncAllPollRef.current) {
        clearInterval(syncAllPollRef.current);
        syncAllPollRef.current = null;
      }
      setSyncAllProgress(null);
      toast({
        title: 'Retry mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  // Manually reactivate all paused feeds (fresh start: resets consecutiveFailures to 0)
  const reactivatePausedFeedsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/rss-feeds/reactivate-paused', { method: 'POST' });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      toast({
        title: `${data.reactivated} feeds hergeactiveerd`,
        description: 'Feeds worden opgepikt bij de volgende sync.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Heractiveren mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  const cancelSyncAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/rss-feeds/sync-all/cancel', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: 'Sync wordt gestopt',
        description: 'De sync wordt gestopt na de huidige feed.',
      });
    },
  });

  const seedFeedsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/rss-feeds/seed', { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ message: 'Onbekende fout' }));
        throw new Error(data.message || 'Seed mislukt');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/overview'] });
      toast({ title: 'Feeds geïmporteerd', description: data.message });
    },
    onError: (error: any) => {
      toast({ title: 'Fout', description: error.message, variant: 'destructive' });
    },
  });

  const addEindhovenFeeds = async () => {
    try {
      await apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: 'Eindhoven Nieuws',
          url: 'https://www.eindhoven.nl/nieuws/rss',
          feedType: 'rss',
          defaultCategory: 'Rondleiding & Uitstap',
          defaultAddress: 'Eindhoven',
          defaultLatitude: '51.4416',
          defaultLongitude: '5.4697',
          municipality: 'Eindhoven',
          updateFrequencyMinutes: 60,
          autoCreateEvents: true,
        },
      });

      await apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: 'This Is Eindhoven Events',
          url: 'https://www.thisiseindhoven.com/en/events',
          feedType: 'scraper',
          defaultCategory: 'Rondleiding & Uitstap',
          defaultAddress: 'Eindhoven',
          defaultLatitude: '51.4416',
          defaultLongitude: '5.4697',
          municipality: 'Eindhoven',
          updateFrequencyMinutes: 120,
          autoCreateEvents: true,
        },
      });

      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      
      toast({
        title: 'Eindhoven feeds toegevoegd',
        description: 'De Eindhoven RSS feeds en scraper zijn toegevoegd.',
      });

      setTimeout(() => {
        refreshFeedsMutation.mutate();
      }, 1000);
    } catch (error) {
      toast({
        title: 'Fout',
        description: 'Er is een fout opgetreden bij het toevoegen van de Eindhoven feeds.',
        variant: 'destructive',
      });
    }
  };

  // Auto-scroll log to bottom when new entries appear
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [syncProgress?.logs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Actief</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Fout</Badge>;
      case 'paused':
        return <Badge className="bg-orange-100 text-orange-800 border border-orange-200"><AlertCircle className="w-3 h-3 mr-1" />Gepauzeerd</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getFeedTypeIcon = (feedType: string) => {
    switch (feedType) {
      case 'scraper':
        return <Globe className="w-4 h-4" />;
      default:
        return <Rss className="w-4 h-4" />;
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
          {stats?.devMaxFeeds != null && (
            <div className="mb-4 flex items-center gap-3 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-yellow-800">
              <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
              <p className="text-sm font-medium">
                Dev-limiet actief: automatische bulk sync verwerkt maximaal{' '}
                <strong>{stats.devMaxFeeds}</strong> feeds (DEV_MAX_FEEDS={stats.devMaxFeeds}).
                Individuele feed-syncs zijn niet beperkt.
              </p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">Bronnenbeheer</h1>
              <p className="text-muted-foreground mt-1">
                Beheer externe bronnen voor automatisch laden van evenementen
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {((stats?.errorFeeds || 0) + (stats?.pausedFeeds || 0)) > 0 && (
                <Button
                  variant="outline"
                  onClick={() => retryErrorFeedsMutation.mutate()}
                  disabled={retryErrorFeedsMutation.isPending || syncAllFeedsMutation.isPending || syncAllProgress?.isRunning}
                  className="border-orange-200 text-orange-700 hover:bg-orange-50 min-h-[44px]"
                  title="Reset foutieve en gepauzeerde feeds naar actief en synchroniseer ze opnieuw (15s pauze tussen feeds)"
                >
                  {retryErrorFeedsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Retry fouten
                  <span className="ml-1.5 bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {(stats?.errorFeeds || 0) + (stats?.pausedFeeds || 0)}
                  </span>
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => syncAllFeedsMutation.mutate()}
                disabled={syncAllFeedsMutation.isPending || syncAllProgress?.isRunning}
                data-testid="button-sync-all"
                className="min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncAllProgress?.isRunning ? 'animate-spin' : ''}`} />
                Sync Alle Feeds
              </Button>
              <Button 
                onClick={() => {
                  setIsSimpleWizardOpen(true);
                }}
                data-testid="button-add-feed"
                className="min-h-[44px]"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Nieuwe Feed
              </Button>
              <Button 
                variant="outline"
                onClick={() => {
                  setIsDirectVisualMode(true);
                  setIsFeedAnalyzerOpen(true);
                }}
                data-testid="button-visual-scraper"
                className="min-h-[44px]"
              >
                <Crosshair className="w-4 h-4 mr-2" />
                Visuele Scraper
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsDirectVisualMode(false);
                  setIsFeedAnalyzerOpen(true);
                }}
                title="Geavanceerde wizard"
              >
                <FileCode className="w-4 h-4" />
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="button-add-feed-manual">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nieuwe RSS Feed</DialogTitle>
                    <DialogDescription>
                      Voeg een nieuwe bron toe voor het automatisch laden van evenementen.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Naam</Label>
                      <Input
                        id="name"
                        value={newFeed.name}
                        onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                        placeholder="Bijvoorbeeld: Gemeente Eindhoven"
                        data-testid="input-feed-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="url">URL</Label>
                      <Input
                        id="url"
                        value={newFeed.url}
                        onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                        placeholder="https://example.com/rss"
                        data-testid="input-feed-url"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="feedType">Type</Label>
                      <Select
                        value={newFeed.feedType}
                        onValueChange={(value) => setNewFeed({ ...newFeed, feedType: value })}
                      >
                        <SelectTrigger data-testid="select-feed-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="rss">RSS/Atom Feed</SelectItem>
                          <SelectItem value="scraper">Web Scraper</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="municipality">Gemeente <span className="text-red-500">*</span></Label>
                      <Input
                        id="municipality"
                        value={newFeed.municipality}
                        onChange={(e) => setNewFeed({ ...newFeed, municipality: e.target.value, defaultAddress: e.target.value })}
                        placeholder="Oisterwijk"
                        data-testid="input-feed-municipality"
                      />
                      <p className="text-xs text-muted-foreground">De gemeente waartoe deze feed behoort</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Standaard categorie <span className="text-muted-foreground">(optioneel)</span></Label>
                      <Select
                        value={newFeed.defaultCategory || ''}
                        onValueChange={(value) => setNewFeed({ ...newFeed, defaultCategory: value })}
                      >
                        <SelectTrigger data-testid="select-feed-category">
                          <SelectValue placeholder="Bepaal per event" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Bepaal per event</SelectItem>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Leeg laten = categorie wordt per event bepaald</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="frequency">Min. wachttijd tussen syncs (minuten)</Label>
                      <Input
                        id="frequency"
                        type="number"
                        value={newFeed.updateFrequencyMinutes}
                        onChange={(e) => setNewFeed({ ...newFeed, updateFrequencyMinutes: parseInt(e.target.value) || 60 })}
                        data-testid="input-feed-frequency"
                      />
                      <p className="text-xs text-muted-foreground">
                        De automatische sync draait ~2× per week voor alle feeds tegelijk. Dit veld bepaalt alleen de minimale wachttijd tussen twee handmatige syncs van dezelfde feed — het heeft geen effect op de automatische planning.
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="autoCreate"
                        checked={newFeed.autoCreateEvents}
                        onCheckedChange={(checked) => setNewFeed({ ...newFeed, autoCreateEvents: checked })}
                        data-testid="switch-auto-create"
                      />
                      <Label htmlFor="autoCreate">Automatisch evenementen aanmaken</Label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Annuleren
                    </Button>
                    <Button 
                      onClick={() => createFeedMutation.mutate(newFeed)}
                      disabled={!newFeed.name || !newFeed.url || !newFeed.municipality || createFeedMutation.isPending}
                      data-testid="button-save-feed"
                    >
                      Toevoegen
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Totaal feeds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalFeeds || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Actieve feeds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats?.activeFeeds || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Feeds met fouten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats?.errorFeeds || 0}</div>
              </CardContent>
            </Card>
            {(stats?.pausedFeeds || 0) > 0 && (
              <Card className="border-orange-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-orange-700">Feeds gepauzeerd</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{stats?.pausedFeeds}</div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Geïmporteerde items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalImported || 0}</div>
              </CardContent>
            </Card>
          </div>

          {/* Paused Feeds Panel */}
          {feeds.filter(f => f.status === 'paused').length > 0 && (
            <Card className="mb-6 border-orange-200 bg-orange-50/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-orange-800">
                    <AlertCircle className="w-4 h-4" />
                    Gepauzeerde feeds ({feeds.filter(f => f.status === 'paused').length})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                    onClick={() => reactivatePausedFeedsMutation.mutate()}
                    disabled={reactivatePausedFeedsMutation.isPending}
                  >
                    {reactivatePausedFeedsMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Heractiveer alle
                  </Button>
                </div>
                <p className="text-xs text-orange-600 mt-1">
                  Feeds worden automatisch opnieuw geprobeerd na 24 uur. Handmatig heractiveren reset de foutenteller.
                </p>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {feeds.filter(f => f.status === 'paused').map(feed => {
                    const hoursAgo = feed.lastFetchedAt
                      ? Math.round((Date.now() - new Date(feed.lastFetchedAt).getTime()) / (60 * 60 * 1000))
                      : null;
                    const nextRetryInHours = hoursAgo !== null ? Math.max(0, 24 - hoursAgo) : null;
                    return (
                      <div key={feed.id} className="flex items-start justify-between gap-3 p-3 bg-white rounded-lg border border-orange-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{feed.name}</span>
                            <Badge variant="outline" className="text-xs border-orange-200 text-orange-700 shrink-0">
                              {feed.consecutiveFailures} fouten
                            </Badge>
                          </div>
                          {feed.lastErrorMessage && (
                            <p className="text-xs text-red-600 mt-0.5 truncate" title={feed.lastErrorMessage}>
                              {feed.lastErrorMessage}
                            </p>
                          )}
                          {nextRetryInHours !== null && (
                            <p className="text-xs text-orange-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {nextRetryInHours === 0 ? 'Auto-retry bij volgende sync' : `Auto-retry over ~${nextRetryInHours}u`}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-orange-700 hover:bg-orange-100 h-7 px-2 text-xs"
                          onClick={() => updateFeedMutation.mutate({ id: feed.id, status: 'active', consecutiveFailures: 0 })}
                          disabled={updateFeedMutation.isPending}
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Heractiveer
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {syncAllProgress && (syncAllProgress.isRunning || syncAllProgress.feedResults.length > 0) && (
            <Card className="mb-6 border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {syncAllProgress.isRunning ? (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    ) : (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    )}
                    {syncAllProgress.isRunning ? 'Sync Alle Feeds' : 'Sync Voltooid'}
                  </CardTitle>
                  {syncAllProgress.isRunning && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => cancelSyncAllMutation.mutate()}
                      disabled={cancelSyncAllMutation.isPending}
                    >
                      Stoppen
                    </Button>
                  )}
                  {!syncAllProgress.isRunning && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSyncAllProgress(null);
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
                      }}
                    >
                      Sluiten
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>Voortgang: {syncAllProgress.completedFeeds} / {syncAllProgress.totalFeeds} feeds</span>
                    <span>{syncAllProgress.percentComplete || 0}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${syncAllProgress.percentComplete || 0}%` }}
                    />
                  </div>
                  {/* Prominent live counters across all feeds */}
                  {syncAllProgress.isRunning && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold text-green-700">
                          {(syncAllProgress.feedResults.reduce((s, r) => s + (r.eventsCreated || 0), 0) || 0) +
                            (syncAllProgress.currentFeedProgress?.eventsCreated || 0)}
                        </div>
                        <div className="text-xs text-green-600 font-medium">[NIEUW]</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold text-blue-700">
                          {(syncAllProgress.feedResults.reduce((s, r) => s + (r.eventsUpdated || 0), 0) || 0) +
                            (syncAllProgress.currentFeedProgress?.eventsUpdated || 0)}
                        </div>
                        <div className="text-xs text-blue-600 font-medium">[UPDATE]</div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
                        <div className="text-2xl font-bold text-gray-600">
                          {(syncAllProgress.feedResults.reduce((s, r) => s + (r.eventsSkipped || 0), 0) || 0) +
                            (syncAllProgress.currentFeedProgress?.eventsSkipped || 0)}
                        </div>
                        <div className="text-xs text-gray-500 font-medium">[SKIP]</div>
                      </div>
                    </div>
                  )}

                  {syncAllProgress.currentFeedName && syncAllProgress.isRunning && (
                    <div className="p-3 bg-white/70 rounded-lg border border-blue-100">
                      <p className="text-sm font-medium mb-2">
                        Bezig met: <strong>{syncAllProgress.currentFeedName}</strong>
                      </p>
                      {syncAllProgress.currentFeedProgress && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`px-2 py-0.5 rounded font-medium ${
                              syncAllProgress.currentFeedProgress.phase === 'fetching' ? 'bg-blue-100 text-blue-700' :
                              syncAllProgress.currentFeedProgress.phase === 'parsing' ? 'bg-purple-100 text-purple-700' :
                              syncAllProgress.currentFeedProgress.phase === 'processing' ? 'bg-amber-100 text-amber-700' :
                              syncAllProgress.currentFeedProgress.phase === 'saving' ? 'bg-green-100 text-green-700' :
                              syncAllProgress.currentFeedProgress.phase === 'completed' ? 'bg-green-100 text-green-700' :
                              syncAllProgress.currentFeedProgress.phase === 'error' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {syncAllProgress.currentFeedProgress.phase === 'starting' && 'Starten'}
                              {syncAllProgress.currentFeedProgress.phase === 'fetching' && 'Ophalen'}
                              {syncAllProgress.currentFeedProgress.phase === 'parsing' && 'Parsen'}
                              {syncAllProgress.currentFeedProgress.phase === 'processing' && 'Verwerken'}
                              {syncAllProgress.currentFeedProgress.phase === 'saving' && 'Opslaan'}
                              {syncAllProgress.currentFeedProgress.phase === 'completed' && 'Voltooid'}
                              {syncAllProgress.currentFeedProgress.phase === 'error' && 'Fout'}
                            </span>
                            {/* Fetch-phase animated indicator with elapsed time */}
                            {(syncAllProgress.currentFeedProgress.phase === 'fetching' || syncAllProgress.currentFeedProgress.phase === 'starting') ? (
                              <span className="flex items-center gap-1 text-blue-600">
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                Ophalen... {Math.round((Date.now() - syncAllProgress.currentFeedProgress.startedAt) / 1000)}s
                              </span>
                            ) : (
                              <span className="text-muted-foreground">{syncAllProgress.currentFeedProgress.message}</span>
                            )}
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                            {syncAllProgress.currentFeedProgress.itemsFound !== undefined && (
                              <span>Items gevonden: {syncAllProgress.currentFeedProgress.itemsFound}</span>
                            )}
                            {syncAllProgress.currentFeedProgress.itemsProcessed !== undefined && (
                              <span>Verwerkt: {syncAllProgress.currentFeedProgress.itemsProcessed}</span>
                            )}
                            {syncAllProgress.currentFeedProgress.currentPage !== undefined && (
                              <span>Pagina: {syncAllProgress.currentFeedProgress.currentPage}{syncAllProgress.currentFeedProgress.totalPages ? `/${syncAllProgress.currentFeedProgress.totalPages}` : ''}</span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Live event ticker */}
                      {syncAllProgress.recentEvents && syncAllProgress.recentEvents.length > 0 && (
                        <div className="mt-2 bg-slate-900 rounded text-[11px] font-mono p-2 space-y-0.5">
                          {syncAllProgress.recentEvents.map((event, idx) => (
                            <div key={idx} className={`py-0.5 leading-tight ${
                              event.includes('[NIEUW]') ? 'text-green-400' :
                              event.includes('[UPDATE]') ? 'text-blue-400' :
                              event.includes('[SKIP]') ? 'text-slate-500' :
                              'text-slate-300'
                            }`}>
                              {event}
                            </div>
                          ))}
                        </div>
                      )}

                      {syncAllProgress.nextFeedIn && syncAllProgress.nextFeedIn > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Wacht {Math.round(syncAllProgress.nextFeedIn / 1000)}s tot volgende feed...
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Processed feeds results */}
                  {syncAllProgress.feedResults.filter(r => r.status !== 'skipped').length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Verwerkte feeds ({syncAllProgress.feedResults.filter(r => r.status !== 'skipped').length}):
                      </p>
                      <div className="space-y-1">
                        {syncAllProgress.feedResults
                          .filter(r => r.status !== 'skipped')
                          .slice(-8)
                          .map((result, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-white/50 rounded">
                            <span className="flex items-center gap-1 flex-1 min-w-0">
                              {result.status === 'success' ? (
                                <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                              )}
                              <span className="truncate">{result.feedName}</span>
                            </span>
                            <span className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {result.status === 'success' ? (
                                <>
                                  <span className="text-green-600" title="Nieuwe events">+{result.eventsCreated}</span>
                                  {(result.eventsUpdated || 0) > 0 && (
                                    <span className="text-blue-600" title="Bijgewerkte events">
                                      ↻{result.eventsUpdated}
                                    </span>
                                  )}
                                  {(result.eventsSkipped || 0) > 0 && (
                                    <span className="text-amber-600" title="Overgeslagen (duplicaten)">
                                      ~{result.eventsSkipped}
                                    </span>
                                  )}
                                  {(result.eventsRejected || 0) > 0 && (
                                    <span className="text-red-500" title="Afgewezen (validatie)">
                                      -{result.eventsRejected}
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-red-600 truncate max-w-[150px]" title={result.message}>{result.message}</span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Skipped feeds section */}
                  {syncAllProgress.feedResults.filter(r => r.status === 'skipped').length > 0 && (
                    <div className="mt-3">
                      <details className="group">
                        <summary className="text-xs font-medium text-amber-700 cursor-pointer hover:text-amber-800 flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform">▶</span>
                          Overgeslagen feeds ({syncAllProgress.feedResults.filter(r => r.status === 'skipped').length}) - recent gesynchroniseerd
                        </summary>
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                          {syncAllProgress.feedResults
                            .filter(r => r.status === 'skipped')
                            .map((result, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs p-1.5 bg-amber-50 rounded border border-amber-100">
                              <span className="flex items-center gap-1 flex-1 min-w-0">
                                <Clock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                                <span className="truncate">{result.feedName}</span>
                              </span>
                              <span className="text-amber-600 text-[10px] flex-shrink-0 ml-2">
                                {result.skipReason || 'Recent gesynchroniseerd'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                Feeds ({feeds.length})
              </TabsTrigger>
              <TabsTrigger value="map" className="flex items-center gap-2">
                <Map className="w-4 h-4" />
                Kaart
              </TabsTrigger>
              <TabsTrigger value="incomplete" className="flex items-center gap-2" data-testid="tab-incomplete">
                <AlertTriangle className="w-4 h-4" />
                Incompleet
              </TabsTrigger>
              <TabsTrigger value="gemeentes" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Gemeentes
              </TabsTrigger>
              <TabsTrigger value="coverage" className="flex items-center gap-2" data-testid="tab-coverage">
                <Crosshair className="w-4 h-4" />
                Dekking
              </TabsTrigger>
            </TabsList>

            <TabsContent value="map">
              <Suspense fallback={
                <div className="flex items-center justify-center h-[600px] bg-muted rounded-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <MunicipalityMap 
                  onAddFeed={(municipality) => {
                    setNewFeed(prev => ({ ...prev, name: `${municipality} Events`, defaultAddress: municipality }));
                    setIsAddDialogOpen(true);
                  }}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="list">
          {feeds.length === 0 && !isLoading && (
            <Card className="mb-6">
              <CardContent className="py-8 text-center">
                <Rss className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nog geen RSS feeds</h3>
                <p className="text-muted-foreground mb-4">
                  Importeer alle standaard feeds of voeg handmatig een feed toe.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={() => {
                    seedFeedsMutation.mutate();
                  }} disabled={seedFeedsMutation.isPending} data-testid="button-seed-feeds">
                    {seedFeedsMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {seedFeedsMutation.isPending ? 'Bezig met importeren...' : 'Alle standaard feeds importeren'}
                  </Button>
                  <Button variant="outline" onClick={addEindhovenFeeds} data-testid="button-add-eindhoven">
                    <Plus className="w-4 h-4 mr-2" />
                    Eindhoven feeds toevoegen
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actie nodig: rode en oranje bronnen bovenaan */}
          {(() => {
            const needsAction = feeds
              .map(f => ({ feed: f, info: sourceInfo[f.id] }))
              .filter(x => x.info && (x.info.status === 'red' || x.info.status === 'orange'))
              .sort((a, b) => {
                const rank = (s: string) => (s === 'red' ? 0 : 1);
                if (rank(a.info!.status) !== rank(b.info!.status)) return rank(a.info!.status) - rank(b.info!.status);
                // Geschatte fix-opbrengst: wat de bron aanbiedt maar (nog) niet oplevert.
                // Historisch aanbod (totalFound of eerdere actieve events) minus wat nu binnenkomt.
                const fixYield = (x: { info: SourceFeedInfo }) => {
                  const potential = Math.max(x.info.totalFound, x.info.activeEvents);
                  return Math.max(potential - x.info.imported, 0);
                };
                return fixYield(b as any) - fixYield(a as any);
              });
            if (needsAction.length === 0) return null;
            return (
              <Card className="mb-6 border-red-200" data-testid="card-action-needed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4" />
                    Actie nodig ({needsAction.length})
                  </CardTitle>
                  <CardDescription>
                    Bronnen die niet syncen, verouderd zijn of weinig opleveren. Klik op een bron voor details.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {needsAction.map(({ feed, info }) => (
                      <div
                        key={feed.id}
                        className="flex items-start justify-between gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedFeedId(expandedFeedId === feed.id ? null : feed.id)}
                        data-testid={`action-needed-${feed.id}`}
                      >
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${info!.status === 'red' ? 'bg-red-500' : 'bg-orange-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{feed.name}</span>
                              <Badge variant="outline" className="text-xs">{platformFamilies[info!.platform]?.label || info!.platform}</Badge>
                              {info!.neverSynced && <Badge variant="destructive" className="text-xs">Nooit gesynct</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{info!.reason}</p>
                            {expandedFeedId === feed.id && (
                              <FeedDetailPanel feed={feed} info={info!} platformFamilies={platformFamilies}
                                onPlatformChange={(platform) => updateFeedMutation.mutate({ id: feed.id, platform } as any)} />
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 text-xs text-muted-foreground">
                          <div>{info!.futureEvents} toekomstige events</div>
                          {info!.catchRate !== null && <div>vangst {info!.catchRate}%</div>}
                          <Button
                            size="sm" variant="ghost" className="h-6 px-2 mt-1 text-xs"
                            onClick={(e) => { e.stopPropagation(); syncSingleFeedMutation.mutate(feed.id); }}
                            disabled={syncingFeedId === feed.id}
                          >
                            <RefreshCw className={`w-3 h-3 mr-1 ${syncingFeedId === feed.id ? 'animate-spin' : ''}`} />
                            Sync nu
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {feeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Geconfigureerde bronnen</CardTitle>
                <CardDescription>
                  Alle RSS feeds en scrapers die evenementen importeren, gegroepeerd per platform-familie
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(
                  feeds.reduce((acc, feed) => {
                    const platform = sourceInfo[feed.id]?.platform || feed.platform || 'maatwerk';
                    if (!acc[platform]) acc[platform] = [];
                    acc[platform].push(feed);
                    return acc;
                  }, {} as Record<string, RssFeed[]>)
                ).sort(([a], [b]) => (platformFamilies[a]?.label || a).localeCompare(platformFamilies[b]?.label || b)).map(([platform, provinceFeeds]) => (
                  <div key={platform} className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">{platformFamilies[platform]?.label || platform}</Badge>
                      <span className="text-muted-foreground text-sm">({provinceFeeds.length} bronnen)</span>
                      {platformFamilies[platform]?.description && (
                        <span className="text-muted-foreground text-xs font-normal hidden md:inline">— {platformFamilies[platform].description}</span>
                      )}
                    </h3>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Gemeente</TableHead>
                      <TableHead>Feed</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actief</TableHead>
                      <TableHead>Incompleet</TableHead>
                      <TableHead>Laatst opgehaald</TableHead>
                      <TableHead>Toegevoegd</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {provinceFeeds.map((feed) => (
                      <Fragment key={feed.id}>
                      <TableRow data-testid={`row-feed-${feed.id}`} className="cursor-pointer" onClick={() => setExpandedFeedId(expandedFeedId === feed.id ? null : feed.id)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const info = sourceInfo[feed.id];
                              const color = !info ? 'bg-gray-300' :
                                info.status === 'green' ? 'bg-green-500' :
                                info.status === 'orange' ? 'bg-orange-400' :
                                info.status === 'red' ? 'bg-red-500' : 'bg-gray-400';
                              return <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} title={info?.reason || ''} />;
                            })()}
                            <span className="font-medium">{feed.municipality || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFeedTypeIcon(feed.feedType)}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{feed.name}</div>
                              {editingUrlFeedId === feed.id ? (
                                <div className="flex items-center gap-1 mt-1">
                                  <input
                                    type="text"
                                    value={editingUrlValue}
                                    onChange={(e) => setEditingUrlValue(e.target.value)}
                                    className="text-xs border rounded px-2 py-1 flex-1 min-w-0"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        updateFeedMutation.mutate({ id: feed.id, url: editingUrlValue });
                                        setEditingUrlFeedId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingUrlFeedId(null);
                                      }
                                    }}
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => {
                                      updateFeedMutation.mutate({ id: feed.id, url: editingUrlValue });
                                      setEditingUrlFeedId(null);
                                    }}
                                    disabled={updateFeedMutation.isPending}
                                  >
                                    <CheckCircle className="w-3 h-3 text-green-600" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setEditingUrlFeedId(null)}
                                  >
                                    <AlertCircle className="w-3 h-3 text-red-600" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 group">
                                  <a 
                                    href={feed.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1 truncate max-w-[200px]"
                                  >
                                    {feed.url.length > 40 ? feed.url.substring(0, 40) + '...' : feed.url}
                                    <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                  </a>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setEditingUrlFeedId(feed.id);
                                      setEditingUrlValue(feed.url);
                                    }}
                                    title="URL bewerken"
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className={feed.feedType === 'scraper' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}>
                              {feed.feedType === 'scraper' ? 'Scraper' : 'RSS'}
                            </Badge>
                            {(() => {
                              const active = feedOverview[feed.id]?.totalActive || 0;
                              const hasError = feed.status === 'error';
                              const recentSync = feed.lastFetchedAt && (Date.now() - new Date(feed.lastFetchedAt).getTime()) < 24 * 60 * 60 * 1000;
                              const score = hasError ? 0 : (active > 20 ? 100 : active > 10 ? 75 : active > 0 ? 50 : 25) * (recentSync ? 1 : 0.5);
                              const scoreColor = score >= 75 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600';
                              return (
                                <span className={`text-xs ${scoreColor} font-medium`} title={`Score: ${Math.round(score)}% (${active} events${hasError ? ', error' : ''}${!recentSync && !hasError ? ', niet recent' : ''})`}>
                                  {Math.round(score)}% kwaliteit
                                </span>
                              );
                            })()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(feed.status)}
                          {(() => {
                            const health = feedHealth[feed.id];
                            if (!health || health.status === 'healthy' || health.status === 'unknown') return null;
                            const isSuspect = health.status === 'suspect';
                            return (
                              <div
                                className={`mt-1 flex items-start gap-1 text-xs ${isSuspect ? 'text-red-600' : 'text-amber-600'}`}
                                title={health.reason}
                                data-testid={`feed-health-${feed.id}`}
                              >
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span className="max-w-[180px]">
                                  {isSuspect ? 'Importeert niets meer' : 'Geen nieuwe events'}
                                </span>
                              </div>
                            );
                          })()}
                          {feed.lastErrorMessage && (
                            <p className="text-xs text-red-500 mt-1 max-w-xs truncate" title={feed.lastErrorMessage}>
                              {feed.lastErrorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="link" 
                            className="p-0 h-auto font-medium text-primary hover:underline"
                            onClick={() => navigate(`/admin/events?feed=${feed.id}`)}
                            title="Bekijk actieve events van deze feed"
                          >
                            {feedOverview[feed.id]?.totalActive || 0}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {(feedOverview[feed.id]?.incomplete || 0) > 0 ? (
                            <Button 
                              variant="link" 
                              className="p-0 h-auto font-medium text-orange-600 hover:underline"
                              onClick={() => {
                                const tab = document.querySelector('[data-tab="incomplete"]');
                                if (tab) (tab as HTMLElement).click();
                              }}
                              title="Bekijk incomplete items"
                            >
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                                {feedOverview[feed.id]?.incomplete || 0}
                              </Badge>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <SyncHistoryTooltip feedId={feed.id} lastFetchedAt={feed.lastFetchedAt} />
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {sourceInfo[feed.id]?.lastNewEventAt ? (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-sm font-medium text-primary hover:underline"
                              onClick={() => setSyncMomentsFeed({ id: feed.id, name: feed.name })}
                              title="Bekijk de laatste 100 sync-momenten"
                              data-testid={`button-sync-moments-${feed.id}`}
                            >
                              {format(new Date(sourceInfo[feed.id].lastNewEventAt!), 'd MMM yyyy HH:mm', { locale: nl })}
                            </Button>
                          ) : (
                            <Button
                              variant="link"
                              className="p-0 h-auto text-sm text-muted-foreground hover:underline"
                              onClick={() => setSyncMomentsFeed({ id: feed.id, name: feed.name })}
                              title="Nog nooit een nieuw event opgehaald — bekijk sync-momenten"
                              data-testid={`button-sync-moments-${feed.id}`}
                            >
                              Nooit
                            </Button>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          {syncingFeedId === feed.id && syncProgress ? (
                            <div className="flex flex-col gap-2 min-w-[350px] max-w-[450px] bg-slate-50 p-3 rounded-lg border border-slate-200">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium">
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                  <span>{syncProgress.status === 'fetching' ? 'Feed ophalen...' : 'Verwerken...'}</span>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {syncProgress.processedItems}/{syncProgress.totalItems || '?'}
                                </span>
                              </div>
                              
                              {syncProgress.totalItems > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${syncProgress.percentComplete || 0}%` }}
                                  />
                                </div>
                              )}
                              
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                {syncProgress.eventsCreated > 0 && (
                                  <span className="text-green-600 font-medium">{syncProgress.eventsCreated} nieuw</span>
                                )}
                                {(syncProgress.eventsUpdated || 0) > 0 && (
                                  <span className="text-blue-600 font-medium">{syncProgress.eventsUpdated} bijgewerkt</span>
                                )}
                              </div>
                              
                              {/* Realtime log venster - always visible when logs exist or processing */}
                              {(syncProgress.logs && syncProgress.logs.length > 0) && (
                                <div ref={logScrollRef} className="bg-slate-900 text-slate-100 rounded text-[11px] font-mono p-2 max-h-[200px] overflow-y-auto scroll-smooth">
                                  {syncProgress.logs.map((log, idx) => (
                                    <div 
                                      key={idx} 
                                      className={`py-0.5 ${
                                        log.includes('[NIEUW]') ? 'text-green-400' : 
                                        log.includes('[UPDATE]') ? 'text-blue-400' : 
                                        log.includes('[SKIP]') ? 'text-slate-500' :
                                        log.includes('✓') ? 'text-green-300 font-semibold' :
                                        'text-slate-300'
                                      }`}
                                    >
                                      {log}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                          <div className="flex justify-end gap-2">
                            <Suspense fallback={null}>
                              <QualityCheckPanel feedId={feed.id} feedName={feed.name} />
                            </Suspense>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => syncSingleFeedMutation.mutate(feed.id)}
                              disabled={syncingFeedId === feed.id}
                              title="Nu synchroniseren"
                              data-testid={`button-sync-feed-${feed.id}`}
                            >
                              <RefreshCw className={`w-4 h-4 ${syncingFeedId === feed.id ? 'animate-spin' : ''}`} />
                            </Button>
                            {feed.aiExtractionProfileId && (
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setEditingVisualFeedId(feed.id);
                                  setIsFeedAnalyzerOpen(true);
                                }}
                                title="Visuele configuratie bewerken"
                              >
                                <FileCode className="w-4 h-4 text-blue-600" />
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => updateFeedMutation.mutate({ 
                                id: feed.id, 
                                status: feed.status === 'active' ? 'paused' : 'active' 
                              })}
                              title={feed.status === 'active' ? 'Pauzeren' : 'Activeren'}
                            >
                              {feed.status === 'active' ? '⏸' : '▶'}
                            </Button>
                            <AlertDialog open={deleteOptions.feedId === feed.id} onOpenChange={(open) => !open && setDeleteOptions({feedId: null, action: 'keep'})}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-delete-feed-${feed.id}`} onClick={() => setDeleteOptions({feedId: feed.id, action: 'keep'})}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Feed verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription asChild>
                                    <div className="space-y-4">
                                      <p>Weet je zeker dat je "{feed.name}" wilt verwijderen?</p>
                                      <div className="space-y-2">
                                        <Label className="text-sm font-medium">Wat moet er met de geïmporteerde events gebeuren?</Label>
                                        <RadioGroup 
                                          value={deleteOptions.action} 
                                          onValueChange={(value: 'keep' | 'delete' | 'unlink') => setDeleteOptions({...deleteOptions, action: value})}
                                          className="space-y-2"
                                        >
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="keep" id={`keep-${feed.id}`} />
                                            <Label htmlFor={`keep-${feed.id}`} className="font-normal cursor-pointer">
                                              Events behouden (aanbevolen)
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="delete" id={`delete-${feed.id}`} />
                                            <Label htmlFor={`delete-${feed.id}`} className="font-normal cursor-pointer text-destructive">
                                              Events verwijderen
                                            </Label>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="unlink" id={`unlink-${feed.id}`} />
                                            <Label htmlFor={`unlink-${feed.id}`} className="font-normal cursor-pointer">
                                              Events loskoppelen (voor herverbinden met andere feed)
                                            </Label>
                                          </div>
                                        </RadioGroup>
                                      </div>
                                    </div>
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteFeedMutation.mutate({id: feed.id, eventAction: deleteOptions.action})}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Verwijderen
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedFeedId === feed.id && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30">
                            <FeedDetailPanel feed={feed} info={sourceInfo[feed.id]} platformFamilies={platformFamilies}
                              onPlatformChange={(platform) => updateFeedMutation.mutate({ id: feed.id, platform } as any)} />
                          </TableCell>
                        </TableRow>
                      )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
                </div>
                </div>
                ))}
              </CardContent>
            </Card>
          )}
            </TabsContent>

            
            <TabsContent value="incomplete">
              <Suspense fallback={
                <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <IncompleteItemsManager />
              </Suspense>
            </TabsContent>

            <TabsContent value="coverage">
              {isLoadingCoverage ? (
                <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Dekking per gemeente</CardTitle>
                    <CardDescription>
                      Gemeentes met gaten (geen actieve bron of nauwelijks toekomstige events) staan bovenaan.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead></TableHead>
                            <TableHead>Gemeente</TableHead>
                            <TableHead>Provincie</TableHead>
                            <TableHead>Bronnen</TableHead>
                            <TableHead>Toekomstige events</TableHead>
                            <TableHead>Signaal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {coverage.map((m) => (
                            <TableRow key={m.municipality} data-testid={`coverage-${m.municipality}`}>
                              <TableCell>
                                <span className={`inline-block w-2.5 h-2.5 rounded-full ${m.hasGap ? 'bg-red-500' : 'bg-green-500'}`} />
                              </TableCell>
                              <TableCell className="font-medium">{m.municipality}</TableCell>
                              <TableCell className="text-muted-foreground">{m.province || '-'}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {m.feeds.map((f) => (
                                    <Badge
                                      key={f.id}
                                      variant="outline"
                                      className={`text-xs ${f.status !== 'active' ? 'opacity-50 line-through' : ''}`}
                                      title={`${f.name} (${f.status}) — ${f.futureEvents} toekomstige events`}
                                    >
                                      {f.name.length > 30 ? f.name.substring(0, 30) + '…' : f.name}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>{m.futureEvents}</TableCell>
                              <TableCell>
                                {m.hasGap ? (
                                  <span className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {m.gapReason}
                                  </span>
                                ) : (
                                  <span className="text-xs text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" /> OK
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="gemeentes">
              <Suspense fallback={
                <div className="flex items-center justify-center h-[400px] bg-muted rounded-lg">
                  <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              }>
                <MunicipalityFeedView
                  feeds={feeds}
                  feedOverview={feedOverview}
                  onEditFeed={(feed) => {
                    setEditingVisualFeedId(feed.id);
                    setIsFeedAnalyzerOpen(true);
                  }}
                  onOpenAnalyzer={(_municipality, _province) => {
                    setIsFeedAnalyzerOpen(true);
                  }}
                />
              </Suspense>
            </TabsContent>
          </Tabs>

          <Suspense fallback={null}>
            <FeedAnalyzerModal 
              open={isFeedAnalyzerOpen} 
              onOpenChange={(open) => {
                setIsFeedAnalyzerOpen(open);
                if (!open) {
                  setIsDirectVisualMode(false);
                  setEditingVisualFeedId(null);
                }
              }}
              onFeedCreated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
              }}
              directVisualMode={isDirectVisualMode}
              editingFeedId={editingVisualFeedId}
            />
          </Suspense>

          <Suspense fallback={null}>
            <SimpleFeedWizard 
              open={isSimpleWizardOpen} 
              onOpenChange={setIsSimpleWizardOpen}
              onFeedCreated={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
                queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
              }}
            />
          </Suspense>

          <SyncMomentsDialog feed={syncMomentsFeed} onClose={() => setSyncMomentsFeed(null)} />

                  </div>
    </AdminLayout>
  );
}
