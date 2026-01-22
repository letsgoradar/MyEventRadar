import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Globe, 
  Mail, 
  Phone, 
  Calendar,
  ArrowLeft,
  Settings,
  Plus,
  Eye,
  TrendingUp,
  Edit,
  Save,
  Loader2,
  Building2
} from 'lucide-react';
import { useState } from 'react';
import type { Venue, EventInterface } from '@shared/schema';

export default function VenueDashboard() {
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const venueId = params.id ? parseInt(params.id) : null;
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Venue>>({});

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ['/api/venues', venueId],
    enabled: venueId !== null,
  });

  const { data: events = [] } = useQuery<EventInterface[]>({
    queryKey: ['/api/venues', venueId, 'events'],
    enabled: venueId !== null,
  });

  const updateVenueMutation = useMutation({
    mutationFn: async (data: Partial<Venue>) => {
      return apiRequest(`/api/venues/${venueId}`, {
        method: 'PATCH',
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/venues', venueId] });
      toast({ title: "Venue bijgewerkt", description: "De wijzigingen zijn opgeslagen." });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const claimVenueMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/venues/${venueId}/claim`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/venues', venueId] });
      toast({ title: "Venue geclaimd", description: "Je aanvraag wordt beoordeeld door een beheerder." });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  if (venueLoading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full mb-6" />
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 text-center">
        <h1 className="text-2xl font-bold mb-4">Venue niet gevonden</h1>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar home
          </Button>
        </Link>
      </div>
    );
  }

  const isOwner = user && venue.claimedByUserId === user.id;
  const isAdmin = user?.role === 'admin';
  const canEdit = isOwner || isAdmin;
  const upcomingEvents = events.filter(e => new Date(e.startTime) >= new Date());

  const handleSave = () => {
    updateVenueMutation.mutate(formData);
  };

  const startEditing = () => {
    setFormData({
      name: venue.name,
      description: venue.description || '',
      address: venue.address || '',
      city: venue.city || '',
      contactEmail: venue.contactEmail || '',
      contactPhone: venue.contactPhone || '',
      websiteUrl: venue.websiteUrl || '',
    });
    setIsEditing(true);
  };

  if (!canEdit) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Link href={`/venue/${venueId}`}>
          <Button variant="ghost" size="sm" className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug naar venue
          </Button>
        </Link>

        <Card className="text-center py-12">
          <CardContent>
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Beheer {venue.name}</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Claim dit venue om evenementen aan te maken, je profiel bij te werken en statistieken te bekijken.
            </p>
            {venue.claimedByUserId ? (
              <Badge variant="secondary">Dit venue is al geclaimd</Badge>
            ) : user ? (
              <Button 
                onClick={() => claimVenueMutation.mutate()}
                disabled={claimVenueMutation.isPending}
              >
                {claimVenueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Claim dit venue
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Log in om dit venue te claimen</p>
                <Link href="/app/login">
                  <Button>Inloggen</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <Link href={`/venue/${venueId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Terug naar venue
            </Button>
          </Link>
          <Badge variant="outline" className="flex items-center gap-1">
            <Settings className="h-3 w-3" />
            Dashboard
          </Badge>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{venue.name}</h1>
            <p className="text-muted-foreground">Beheer je venue en evenementen</p>
          </div>
          {venue.isVerified && (
            <Badge variant="default" className="bg-green-500">Geverifieerd</Badge>
          )}
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overzicht</TabsTrigger>
            <TabsTrigger value="events">Evenementen</TabsTrigger>
            <TabsTrigger value="settings">Instellingen</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-3 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Aankomende events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{upcomingEvents.length}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Totaal events
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{events.length}</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Profiel views
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{venue.usageCount || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Snelle acties</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-3 flex-wrap">
                <Link href="/create-event">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuw evenement
                  </Button>
                </Link>
                <Link href={`/venue/${venueId}`}>
                  <Button variant="outline">
                    <Eye className="h-4 w-4 mr-2" />
                    Bekijk profiel
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="events">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Evenementen</CardTitle>
                  <CardDescription>Beheer je evenementen</CardDescription>
                </div>
                <Link href="/create-event">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nieuw
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {events.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nog geen evenementen</p>
                    <Link href="/create-event">
                      <Button variant="link">Maak je eerste evenement</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {events.map((event) => (
                      <div 
                        key={event.id}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div>
                          <h3 className="font-medium">{event.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(event.startTime).toLocaleDateString('nl-NL')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={new Date(event.startTime) >= new Date() ? "default" : "secondary"}>
                            {new Date(event.startTime) >= new Date() ? "Aankomend" : "Afgelopen"}
                          </Badge>
                          <Link href={`/events/${event.id}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Venue informatie</CardTitle>
                  <CardDescription>Beheer je venue profiel</CardDescription>
                </div>
                {!isEditing ? (
                  <Button variant="outline" onClick={startEditing}>
                    <Edit className="h-4 w-4 mr-2" />
                    Bewerken
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsEditing(false)}>
                      Annuleren
                    </Button>
                    <Button onClick={handleSave} disabled={updateVenueMutation.isPending}>
                      {updateVenueMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Save className="h-4 w-4 mr-2" />
                      Opslaan
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Naam</Label>
                    {isEditing ? (
                      <Input 
                        value={formData.name || ''} 
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">{venue.name}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Stad</Label>
                    {isEditing ? (
                      <Input 
                        value={formData.city || ''} 
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">{venue.city || '-'}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Adres</Label>
                  {isEditing ? (
                    <Input 
                      value={formData.address || ''} 
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">{venue.address || '-'}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Beschrijving</Label>
                  {isEditing ? (
                    <Textarea 
                      value={formData.description || ''} 
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={4}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded min-h-[100px]">{venue.description || '-'}</p>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    {isEditing ? (
                      <Input 
                        type="email"
                        value={formData.contactEmail || ''} 
                        onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">{venue.contactEmail || '-'}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Telefoon</Label>
                    {isEditing ? (
                      <Input 
                        value={formData.contactPhone || ''} 
                        onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                      />
                    ) : (
                      <p className="text-sm p-2 bg-muted rounded">{venue.contactPhone || '-'}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Website</Label>
                  {isEditing ? (
                    <Input 
                      value={formData.websiteUrl || ''} 
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm p-2 bg-muted rounded">{venue.websiteUrl || '-'}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
