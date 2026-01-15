import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import AdminSidebar from '@/components/Layout/AdminSidebar';
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
import { Plus, RefreshCw, Trash2, Edit, ExternalLink, Rss, Globe, AlertCircle, CheckCircle, Eye, Map, List, AlertTriangle, Search, Loader2, Sparkles, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { nl } from 'date-fns/locale';
import { CATEGORIES, type FeedAnalysisResult } from '@shared/schema';
import { lazy, Suspense } from 'react';

const MunicipalityMap = lazy(() => import('@/components/admin/MunicipalityMap'));
const IncompleteItemsManager = lazy(() => import('@/components/admin/IncompleteItemsManager'));

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
  itemsImported: number;
  autoCreateEvents: boolean;
  createdAt: string;
}

interface RssFeedStats {
  totalFeeds: number;
  activeFeeds: number;
  errorFeeds: number;
  totalItems: number;
  totalImported: number;
}

export default function RssFeedsPage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<RssFeed | null>(null);
  const [activeTab, setActiveTab] = useState('analyzer'); // Start with analyzer as primary
  
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
      setEditingFeed(null);
      toast({
        title: 'Feed bijgewerkt',
        description: 'De RSS feed is succesvol bijgewerkt.',
      });
    },
  });

  const deleteFeedMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/rss-feeds/${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      toast({
        title: 'Feed verwijderd',
        description: 'De RSS feed is succesvol verwijderd.',
      });
    },
  });

  const [syncingFeedId, setSyncingFeedId] = useState<number | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    status: string;
    totalItems: number;
    processedItems: number;
    eventsCreated: number;
    percentComplete: number;
    message?: string;
  } | null>(null);
  
  const [analyzeUrl, setAnalyzeUrl] = useState('');
  const [analysisResult, setAnalysisResult] = useState<FeedAnalysisResult | null>(null);
  
  const analyzeFeedMutation = useMutation({
    mutationFn: async (url: string): Promise<FeedAnalysisResult> => {
      return apiRequest('/api/admin/rss-feeds/analyze', {
        method: 'POST',
        data: { url },
      });
    },
    onSuccess: (data: FeedAnalysisResult) => {
      setAnalysisResult(data);
      toast({
        title: data.isViable ? 'Feed is geschikt!' : 'Feed analyse voltooid',
        description: data.isViable 
          ? `Betrouwbaarheid: ${data.confidenceScore}% - ${data.feedType} feed gevonden`
          : `Let op: ${data.warnings?.length || 0} waarschuwingen`,
        variant: data.isViable ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Analyse mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
    },
  });

  const pollIntervalRef = { current: null as NodeJS.Timeout | null };
  
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
      setSyncingFeedId(id);
      setSyncProgress({ 
        status: 'pending', 
        totalItems: 0, 
        processedItems: 0, 
        eventsCreated: 0, 
        percentComplete: 0,
        message: 'Verbinden met feed...' 
      });
      
      // Start polling for progress
      pollIntervalRef.current = setInterval(async () => {
        const progress = await pollProgress(id);
        if (progress?.status === 'completed' || progress?.status === 'error') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }, 500);
      
      try {
        const result = await apiRequest(`/api/admin/rss-feeds/${id}/sync`, {
          method: 'POST',
        });
        return result;
      } finally {
        // Always clean up polling
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      setSyncingFeedId(null);
      setSyncProgress(null);
      toast({
        title: 'Feed gesynchroniseerd',
        description: `${data.feedName}: ${data.eventsCreated} nieuwe events aangemaakt.`,
      });
    },
    onError: (error: any) => {
      setSyncingFeedId(null);
      setSyncProgress(null);
      toast({
        title: 'Sync mislukt',
        description: error.message || 'Er is een fout opgetreden.',
        variant: 'destructive',
      });
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
    currentFeedName: string | null;
    percentComplete: number;
    feedResults: Array<{
      feedId: number;
      feedName: string;
      status: 'success' | 'error' | 'skipped';
      eventsCreated: number;
      message?: string;
    }>;
    nextFeedIn?: number;
  } | null>(null);
  
  const syncAllPollRef = { current: null as NodeJS.Timeout | null };
  
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
      
      // Start polling for progress
      syncAllPollRef.current = setInterval(async () => {
        const progress = await pollSyncAllProgress();
        if (progress && !progress.isRunning) {
          if (syncAllPollRef.current) {
            clearInterval(syncAllPollRef.current);
            syncAllPollRef.current = null;
          }
        }
      }, 1000);
      
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

  const addEindhovenFeeds = async () => {
    try {
      await apiRequest('/api/admin/rss-feeds', {
        method: 'POST',
        data: {
          name: 'Eindhoven Nieuws',
          url: 'https://www.eindhoven.nl/nieuws/rss',
          feedType: 'rss',
          defaultCategory: 'Gezellig en Sociaal',
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
          defaultCategory: 'Gezellig en Sociaal',
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Actief</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Fout</Badge>;
      case 'paused':
        return <Badge variant="secondary">Gepauzeerd</Badge>;
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
    <div className="flex h-screen bg-background">
      <AdminSidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-page-title">RSS Feeds</h1>
              <p className="text-muted-foreground mt-1">
                Beheer externe bronnen voor automatisch laden van evenementen
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => syncAllFeedsMutation.mutate()}
                disabled={syncAllFeedsMutation.isPending || syncAllProgress?.isRunning}
                data-testid="button-sync-all"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncAllProgress?.isRunning ? 'animate-spin' : ''}`} />
                Sync Alle Feeds
              </Button>
              <Button 
                onClick={() => setActiveTab('analyzer')}
                variant={activeTab === 'analyzer' ? 'default' : 'outline'}
                data-testid="button-add-feed"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Nieuwe Feed
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
                      <Label htmlFor="frequency">Update frequentie (minuten)</Label>
                      <Input
                        id="frequency"
                        type="number"
                        value={newFeed.updateFrequencyMinutes}
                        onChange={(e) => setNewFeed({ ...newFeed, updateFrequencyMinutes: parseInt(e.target.value) || 60 })}
                        data-testid="input-feed-frequency"
                      />
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
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Geïmporteerde items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalImported || 0}</div>
              </CardContent>
            </Card>
          </div>

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
                  {syncAllProgress.currentFeedName && syncAllProgress.isRunning && (
                    <p className="text-sm text-muted-foreground">
                      Bezig met: <strong>{syncAllProgress.currentFeedName}</strong>
                      {syncAllProgress.nextFeedIn && syncAllProgress.nextFeedIn > 0 && (
                        <span className="ml-2 text-xs">
                          (wacht {Math.round(syncAllProgress.nextFeedIn / 1000)}s tot volgende)
                        </span>
                      )}
                    </p>
                  )}
                  {syncAllProgress.feedResults.length > 0 && (
                    <div className="mt-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Resultaten:</p>
                      <div className="space-y-1">
                        {syncAllProgress.feedResults.slice(-5).map((result, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs p-1 bg-white/50 rounded">
                            <span className="flex items-center gap-1">
                              {result.status === 'success' ? (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              ) : (
                                <AlertCircle className="w-3 h-3 text-red-600" />
                              )}
                              {result.feedName}
                            </span>
                            <span className={result.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                              {result.status === 'success' ? `+${result.eventsCreated} events` : result.message}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="analyzer" className="flex items-center gap-2" data-testid="tab-analyzer">
                <Sparkles className="w-4 h-4" />
                Feed Analyzer
              </TabsTrigger>
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
                  Voeg je eerste feed toe om evenementen automatisch te laden.
                </p>
                <Button onClick={addEindhovenFeeds} data-testid="button-add-eindhoven">
                  <Plus className="w-4 h-4 mr-2" />
                  Eindhoven feeds toevoegen
                </Button>
              </CardContent>
            </Card>
          )}

          {feeds.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Geconfigureerde feeds</CardTitle>
                <CardDescription>
                  Alle RSS feeds en scrapers die evenementen importeren, gegroepeerd per provincie
                </CardDescription>
              </CardHeader>
              <CardContent>
                {Object.entries(
                  feeds.reduce((acc, feed) => {
                    const province = feed.province || 'Overig';
                    if (!acc[province]) acc[province] = [];
                    acc[province].push(feed);
                    return acc;
                  }, {} as Record<string, RssFeed[]>)
                ).sort(([a], [b]) => a.localeCompare(b)).map(([province, provinceFeeds]) => (
                  <div key={province} className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">{province}</Badge>
                      <span className="text-muted-foreground text-sm">({provinceFeeds.length} feeds)</span>
                    </h3>
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
                      <TableRow key={feed.id} data-testid={`row-feed-${feed.id}`}>
                        <TableCell>
                          <span className="font-medium">{feed.municipality || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFeedTypeIcon(feed.feedType)}
                            <div>
                              <div className="font-medium">{feed.name}</div>
                              <a 
                                href={feed.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:underline flex items-center gap-1"
                              >
                                {feed.url.substring(0, 40)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
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
                          {feed.lastFetchedAt 
                            ? format(new Date(feed.lastFetchedAt), 'dd MMM HH:mm', { locale: nl })
                            : 'Nog niet opgehaald'}
                        </TableCell>
                        <TableCell>
                          {(feedOverview[feed.id]?.addedLastSync || 0) > 0 ? (
                            <Badge variant="default" className="bg-green-100 text-green-700">
                              +{feedOverview[feed.id]?.addedLastSync || 0}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {syncingFeedId === feed.id && syncProgress ? (
                            <div className="flex flex-col items-end gap-1 min-w-[150px]">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>{syncProgress.message || 'Bezig...'}</span>
                              </div>
                              {syncProgress.totalItems > 0 && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div 
                                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                                    style={{ width: `${syncProgress.percentComplete || 0}%` }}
                                  />
                                </div>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {syncProgress.processedItems}/{syncProgress.totalItems} items
                                {syncProgress.eventsCreated > 0 && ` • ${syncProgress.eventsCreated} nieuw`}
                              </span>
                            </div>
                          ) : (
                          <div className="flex justify-end gap-2">
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
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-delete-feed-${feed.id}`}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Feed verwijderen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Weet je zeker dat je "{feed.name}" wilt verwijderen? 
                                    Geïmporteerde evenementen blijven behouden.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteFeedMutation.mutate(feed.id)}
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
                    ))}
                  </TableBody>
                </Table>
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

            <TabsContent value="analyzer">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Slimme Feed Analyzer
                  </CardTitle>
                  <CardDescription>
                    Analyseer automatisch een nieuwe event-bron om te bepalen of deze geschikt is voor import.
                    De analyzer detecteert het feed-type, beschikbare velden en geeft een geschiktheidsscore.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <Label htmlFor="analyze-url">URL van de event-bron</Label>
                      <Input
                        id="analyze-url"
                        placeholder="https://example.com/events of /feed.xml"
                        value={analyzeUrl}
                        onChange={(e) => setAnalyzeUrl(e.target.value)}
                        data-testid="input-analyze-url"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        onClick={() => {
                          if (analyzeUrl) {
                            setAnalysisResult(null);
                            analyzeFeedMutation.mutate(analyzeUrl);
                          }
                        }}
                        disabled={!analyzeUrl || analyzeFeedMutation.isPending}
                        data-testid="button-analyze-feed"
                      >
                        {analyzeFeedMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Analyseren...
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4 mr-2" />
                            Analyseer Feed
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {analysisResult && (
                    <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          {analysisResult.isViable ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          )}
                          Analyse Resultaat
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge variant={analysisResult.feedType === 'unknown' ? 'destructive' : 'outline'}>
                            {analysisResult.feedType?.toUpperCase()}
                          </Badge>
                          <Badge variant={analysisResult.isViable ? 'default' : 'destructive'}>
                            {analysisResult.confidenceScore}% betrouwbaar
                          </Badge>
                        </div>
                      </div>

                      {analysisResult.eventStats && (
                        <div className="grid gap-4 md:grid-cols-4 p-3 bg-background rounded-lg border">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-primary">{analysisResult.eventStats.totalFound}</div>
                            <div className="text-xs text-muted-foreground">Gevonden</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{analysisResult.eventStats.importable}</div>
                            <div className="text-xs text-muted-foreground">Importeerbaar</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{analysisResult.eventStats.withDate}</div>
                            <div className="text-xs text-muted-foreground">Met datum</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-amber-600">{analysisResult.eventStats.withImage}</div>
                            <div className="text-xs text-muted-foreground">Met afbeelding</div>
                          </div>
                        </div>
                      )}

                      {analysisResult.suggestedMunicipality && (
                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
                          <Globe className="w-4 h-4 text-blue-600" />
                          <span>Herkende gemeente: <strong>{analysisResult.suggestedMunicipality}</strong></span>
                        </div>
                      )}

                      {(analysisResult as any).recommendedImportMethod && (
                        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-green-800 dark:text-green-200">
                            <CheckCircle className="w-4 h-4" />
                            Aanbevolen importmethode
                          </h4>
                          <div className="text-sm space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-green-600">
                                {(analysisResult as any).recommendedImportMethod.method.toUpperCase()}
                              </Badge>
                              <span className="text-green-700 dark:text-green-300">
                                ~{(analysisResult as any).recommendedImportMethod.estimatedEvents} events
                              </span>
                            </div>
                            <p className="text-green-700 dark:text-green-300">
                              {(analysisResult as any).recommendedImportMethod.reason}
                            </p>
                          </div>
                        </div>
                      )}

                      {(analysisResult as any).alternativeSources?.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">Import Opties (gerangschikt op wenselijkheid)</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setAnalysisResult(null);
                                analyzeFeedMutation.mutate(analyzeUrl);
                              }}
                              disabled={analyzeFeedMutation.isPending}
                            >
                              <RefreshCw className={`w-3 h-3 mr-1 ${analyzeFeedMutation.isPending ? 'animate-spin' : ''}`} />
                              Opnieuw scannen
                            </Button>
                          </div>
                          <div className="space-y-3">
                            {(analysisResult as any).alternativeSources.map((source: any, idx: number) => (
                              <div 
                                key={idx} 
                                className={`p-3 rounded-lg border ${idx === 0 ? 'border-green-300 bg-green-50/50 dark:bg-green-950/30' : 'bg-muted/50'}`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                      {idx === 0 && <Badge className="bg-green-600">Aanbevolen</Badge>}
                                      <Badge variant="outline">{source.type.toUpperCase()}</Badge>
                                      <span className="font-medium">{source.desirabilityScore || 50}% wenselijk</span>
                                      {source.itemCount > 0 && (
                                        <Badge variant="secondary">{source.itemCount} events</Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate" title={source.url}>
                                      {source.url}
                                    </div>
                                    <div className="text-sm">{source.recommendation}</div>
                                    {(source.pros?.length > 0 || source.cons?.length > 0) && (
                                      <div className="flex gap-4 text-xs">
                                        {source.pros?.length > 0 && (
                                          <div className="flex-1">
                                            <span className="text-green-600 font-medium">Voordelen:</span>
                                            <ul className="list-disc list-inside text-muted-foreground">
                                              {source.pros.slice(0, 2).map((pro: string, i: number) => (
                                                <li key={i}>{pro}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                        {source.cons?.length > 0 && (
                                          <div className="flex-1">
                                            <span className="text-red-600 font-medium">Nadelen:</span>
                                            <ul className="list-disc list-inside text-muted-foreground">
                                              {source.cons.slice(0, 2).map((con: string, i: number) => (
                                                <li key={i}>{con}</li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <Button
                                      size="sm"
                                      variant={idx === 0 ? 'default' : 'outline'}
                                      onClick={() => {
                                        const feedTypeMap: Record<string, 'rss' | 'scraper'> = {
                                          'rss': 'rss',
                                          'atom': 'rss',
                                          'ical': 'rss',
                                          'json-api': 'scraper',
                                          'json-feed': 'scraper',
                                          'json-ld': 'scraper',
                                          'sitemap': 'scraper',
                                          'scraper': 'scraper',
                                        };
                                        setNewFeed({
                                          name: (analysisResult as any).suggestedFeedName || 'Nieuwe feed',
                                          url: source.url,
                                          feedType: feedTypeMap[source.type] || 'scraper',
                                          defaultCategory: '',
                                          defaultAddress: (analysisResult as any).suggestedMunicipality || '',
                                          defaultLatitude: '',
                                          defaultLongitude: '',
                                          municipality: (analysisResult as any).suggestedMunicipality || '',
                                          updateFrequencyMinutes: 60,
                                          autoCreateEvents: true,
                                        });
                                        setIsAddDialogOpen(true);
                                      }}
                                    >
                                      <Plus className="w-3 h-3 mr-1" />
                                      Selecteer
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setAnalyzeUrl(source.url);
                                        setAnalysisResult(null);
                                        analyzeFeedMutation.mutate(source.url);
                                      }}
                                      disabled={analyzeFeedMutation.isPending}
                                    >
                                      <Eye className="w-3 h-3 mr-1" />
                                      Analyseer
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-3">Veldanalyse</h4>
                          <div className="grid gap-2 md:grid-cols-2">
                            {['title', 'date', 'location', 'description', 'image', 'link', 'time'].map((field) => {
                              const info = (analysisResult.detectedFields || {})[field];
                              const isMissing = (analysisResult.missingRequiredFields || []).includes(field);
                              const isRequired = ['title', 'date'].includes(field);
                              
                              return (
                                <div 
                                  key={field} 
                                  className={`p-2 rounded border flex items-center justify-between ${
                                    info ? 'bg-green-50 dark:bg-green-950/30 border-green-200' : 
                                    isMissing ? 'bg-red-50 dark:bg-red-950/30 border-red-200' : 
                                    'bg-muted/50 border-muted'
                                  }`}
                                >
                                  <div className="flex items-center gap-2">
                                    {info ? (
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                    ) : isMissing ? (
                                      <AlertCircle className="w-4 h-4 text-red-600" />
                                    ) : (
                                      <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30" />
                                    )}
                                    <span className="capitalize font-medium text-sm">{field}</span>
                                    {isRequired && (
                                      <Badge variant="outline" className="text-xs px-1 py-0">
                                        verplicht
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {info && (
                                      <Badge 
                                        variant={info.confidence >= 80 ? 'default' : info.confidence >= 50 ? 'secondary' : 'outline'}
                                        className="text-xs"
                                      >
                                        {info.confidence}%
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {Object.keys(analysisResult.detectedFields || {}).some(k => !['title', 'date', 'location', 'description', 'image', 'link', 'time'].includes(k)) && (
                          <div>
                            <h5 className="text-sm text-muted-foreground mb-2">Extra gevonden velden:</h5>
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(analysisResult.detectedFields || {})
                                .filter(([k]) => !['title', 'date', 'location', 'description', 'image', 'link', 'time'].includes(k))
                                .map(([field, info]: [string, any]) => (
                                  <Badge key={field} variant="outline" className="text-xs">
                                    {field} ({info.confidence}%)
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {analysisResult.warnings?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Waarschuwingen</h4>
                          <div className="space-y-1">
                            {analysisResult.warnings.map((warning: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {warning}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {(analysisResult as any).platformDetected && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg border border-indigo-200">
                          <h4 className="font-medium mb-2 flex items-center gap-2 text-indigo-800 dark:text-indigo-200">
                            <Globe className="w-4 h-4" />
                            Platform gedetecteerd: {(analysisResult as any).platformDetected}
                            {(analysisResult as any).platformInfo?.version && (
                              <Badge variant="outline" className="text-xs">{(analysisResult as any).platformInfo.version}</Badge>
                            )}
                          </h4>
                          <div className="text-sm text-indigo-700 dark:text-indigo-300 space-y-1">
                            {(analysisResult as any).platformInfo?.feedAvailable && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> RSS feed beschikbaar
                              </div>
                            )}
                            {(analysisResult as any).platformInfo?.apiAvailable && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> REST API beschikbaar
                              </div>
                            )}
                            {(analysisResult as any).platformInfo?.hasEventsPlugin && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> Events plugin gevonden
                              </div>
                            )}
                            {(analysisResult as any).platformInfo?.categories?.length > 0 && (
                              <div className="flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> {(analysisResult as any).platformInfo.categories.length} categorieën gevonden
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {(analysisResult as any).aiRecommendation && (
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                          <h4 className="font-semibold mb-3 flex items-center gap-2 text-purple-800 dark:text-purple-200">
                            <Sparkles className="w-5 h-5" />
                            AI Aanbeveling
                          </h4>
                          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                            {(analysisResult as any).aiRecommendation}
                          </div>
                        </div>
                      )}

                      {analysisResult.suggestions?.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2">Suggesties</h4>
                          <div className="space-y-1">
                            {analysisResult.suggestions.map((suggestion: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 text-sm text-blue-700">
                                <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                {suggestion}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {analysisResult.sampleItems?.length > 0 && (
                        <div className="space-y-3">
                          <h4 className="font-medium">Voorbeeld evenementen ({analysisResult.sampleItems.length} gevonden)</h4>
                          <div className="space-y-2 max-h-80 overflow-y-auto">
                            {analysisResult.sampleItems.slice(0, 5).map((item: any, idx: number) => (
                              <div key={idx} className="p-3 bg-background rounded-lg border text-sm">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 space-y-1">
                                    <div className="font-medium text-primary">
                                      {item.title || item.name || `Event ${idx + 1}`}
                                    </div>
                                    {(item.date || item.startDate) && (
                                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                        <Calendar className="w-3 h-3" />
                                        {item.date || item.startDate}
                                        {item.time && ` om ${item.time}`}
                                      </div>
                                    )}
                                    {(item.location || item.venue || item.address) && (
                                      <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                        <MapPin className="w-3 h-3" />
                                        {item.location || item.venue || item.address}
                                      </div>
                                    )}
                                    {item.description && (
                                      <div className="text-xs text-muted-foreground line-clamp-2">
                                        {typeof item.description === 'string' 
                                          ? item.description.substring(0, 150) 
                                          : ''}
                                        {item.description?.length > 150 && '...'}
                                      </div>
                                    )}
                                  </div>
                                  {item.image && (
                                    <div className="w-16 h-16 rounded overflow-hidden flex-shrink-0">
                                      <img 
                                        src={item.image} 
                                        alt="" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                      />
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {Object.keys(item).slice(0, 6).map((key) => (
                                    <Badge key={key} variant="outline" className="text-xs">
                                      {key}
                                    </Badge>
                                  ))}
                                  {Object.keys(item).length > 6 && (
                                    <Badge variant="secondary" className="text-xs">
                                      +{Object.keys(item).length - 6} meer
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          {analysisResult.sampleItems.length > 5 && (
                            <p className="text-xs text-muted-foreground">
                              En nog {analysisResult.sampleItems.length - 5} andere evenementen...
                            </p>
                          )}
                        </div>
                      )}

                      <div className="pt-4 border-t flex gap-2">
                        <Button
                          onClick={() => {
                            const suggestedCity = analysisResult.suggestedMunicipality || '';
                            const suggestedName = analysisResult.suggestedFeedName || `Events ${suggestedCity}`;
                              
                            setNewFeed(prev => ({
                              ...prev,
                              url: analyzeUrl,
                              feedType: analysisResult.feedType === 'html-scraper' ? 'scraper' : 'rss',
                              name: suggestedName,
                              municipality: suggestedCity,
                              defaultAddress: suggestedCity,
                            }));
                            setIsAddDialogOpen(true);
                          }}
                          variant={analysisResult.isViable ? 'default' : 'outline'}
                          data-testid="button-create-from-analysis"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          {analysisResult.isViable ? 'Feed aanmaken' : 'Toch feed aanmaken'}
                        </Button>
                        {!analysisResult.isViable && (
                          <p className="text-sm text-muted-foreground self-center">
                            Je kunt de feed nog steeds handmatig toevoegen
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
