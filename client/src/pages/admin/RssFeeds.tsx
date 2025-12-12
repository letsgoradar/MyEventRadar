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
import { Plus, RefreshCw, Trash2, Edit, ExternalLink, Rss, Globe, AlertCircle, CheckCircle, Eye, Map, List, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useLocation } from 'wouter';
import { nl } from 'date-fns/locale';
import { CATEGORIES } from '@shared/schema';
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

  const syncSingleFeedMutation = useMutation({
    mutationFn: async (id: number) => {
      setSyncingFeedId(id);
      return apiRequest(`/api/admin/rss-feeds/${id}/sync`, {
        method: 'POST',
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/rss-feeds/stats'] });
      setSyncingFeedId(null);
      toast({
        title: 'Feed gesynchroniseerd',
        description: `${data.feedName}: ${data.eventsCreated} nieuwe events aangemaakt.`,
      });
    },
    onError: (error: any) => {
      setSyncingFeedId(null);
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
                onClick={() => refreshFeedsMutation.mutate()}
                disabled={refreshFeedsMutation.isPending}
                data-testid="button-refresh-feeds"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshFeedsMutation.isPending ? 'animate-spin' : ''}`} />
                Vernieuwen
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-feed">
                    <Plus className="w-4 h-4 mr-2" />
                    Feed toevoegen
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

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="w-4 h-4" />
                Lijst
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
                          <Badge variant="outline">
                            {feed.feedType === 'scraper' ? 'Scraper' : 'RSS'}
                          </Badge>
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
          </Tabs>
        </div>
      </main>
    </div>
  );
}
