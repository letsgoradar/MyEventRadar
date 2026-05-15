import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import AdminLayout from "@/components/Layout/AdminLayout";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  CheckSquare,
  Search,
  Plus,
  MapPin,
  Calendar,
  ExternalLink,
  Loader2,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { Venue } from "@shared/schema";

interface VenueStats {
  totalVenues: number;
  activeVenues: number;
  totalContacts: number;
  totalTasks: number;
  openTasks: number;
}

interface PotentialVenue {
  address: string;
  eventCount: number;
  sampleTitle: string;
}

const AdminVenues = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showDiscoveryDialog, setShowDiscoveryDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");
  const [newVenueAddress, setNewVenueAddress] = useState("");

  const { data: venues = [], isLoading: venuesLoading } = useQuery<Venue[]>({
    queryKey: ["/api/admin/venues"],
  });

  const { data: stats } = useQuery<VenueStats>({
    queryKey: ["/api/admin/venues/stats"],
  });

  const { data: potentialVenues = [], isLoading: discoveryLoading } = useQuery<PotentialVenue[]>({
    queryKey: ["/api/admin/venues/discover", { minEvents: 3 }],
    enabled: showDiscoveryDialog,
  });

  const createVenueMutation = useMutation({
    mutationFn: async (data: { name: string; address: string }) => {
      return apiRequest("/api/admin/venues", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues/stats"] });
      toast({ title: "Venue aangemaakt", description: "De venue is succesvol toegevoegd." });
      setShowCreateDialog(false);
      setNewVenueName("");
      setNewVenueAddress("");
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon de venue niet aanmaken.", variant: "destructive" });
    },
  });

  const createFromLocationMutation = useMutation({
    mutationFn: async (data: { address: string; name?: string }) => {
      return apiRequest("/api/admin/venues/from-location", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues/discover"] });
      toast({ title: "Venue aangemaakt", description: "De locatie is omgezet naar een venue." });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon de venue niet aanmaken.", variant: "destructive" });
    },
  });

  const filteredVenues = venues.filter((venue) =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.municipality?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const StatCard = ({ title, value, icon: Icon, description }: { 
    title: string; 
    value: number | string; 
    icon: any; 
    description?: string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Venues</h1>
              <p className="text-gray-500 mt-1">Beheer locaties, contacten en sponsor acties</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDiscoveryDialog(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Ontdek locaties
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe venue
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              title="Totaal venues"
              value={stats?.totalVenues || 0}
              icon={Building2}
            />
            <StatCard
              title="Actieve venues"
              value={stats?.activeVenues || 0}
              icon={Building2}
              description="Met status 'actief'"
            />
            <StatCard
              title="Contactpersonen"
              value={stats?.totalContacts || 0}
              icon={Users}
            />
            <StatCard
              title="Totaal taken"
              value={stats?.totalTasks || 0}
              icon={CheckSquare}
            />
            <StatCard
              title="Open taken"
              value={stats?.openTasks || 0}
              icon={AlertCircle}
              description="Te doen of in progress"
            />
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Venue overzicht</CardTitle>
                  <CardDescription>
                    Klik op een venue om details te bekijken en te beheren
                  </CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Zoek venues..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {venuesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredVenues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? "Geen venues gevonden met deze zoekopdracht" : "Nog geen venues toegevoegd"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Naam</TableHead>
                      <TableHead>Adres</TableHead>
                      <TableHead>Gemeente</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acties</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVenues.map((venue) => (
                      <TableRow
                        key={venue.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => setLocation(`/admin/venues/${venue.id}`)}
                      >
                        <TableCell className="font-medium">{venue.name}</TableCell>
                        <TableCell className="max-w-xs truncate">{venue.address || "-"}</TableCell>
                        <TableCell>{venue.municipality || "-"}</TableCell>
                        <TableCell>
                          {venue.category ? (
                            <Badge variant="outline">{venue.category}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={venue.status === "active" ? "default" : "secondary"}
                          >
                            {venue.status === "active" ? "Actief" : venue.status === "pending" ? "In afwachting" : "Gearchiveerd"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/admin/venues/${venue.id}`);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

      <Dialog open={showDiscoveryDialog} onOpenChange={setShowDiscoveryDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Ontdek potentiële venues
            </DialogTitle>
            <DialogDescription>
              Locaties met 3 of meer evenementen die nog niet als venue zijn aangemaakt.
              Klik op "Maak venue" om een locatie om te zetten naar een beheerbare venue.
            </DialogDescription>
          </DialogHeader>
          
          {discoveryLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : potentialVenues.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Geen nieuwe locaties gevonden met voldoende evenementen
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adres</TableHead>
                  <TableHead>Evenementen</TableHead>
                  <TableHead>Voorbeeld</TableHead>
                  <TableHead className="text-right">Actie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {potentialVenues.slice(0, 50).map((location, index) => (
                  <TableRow key={index}>
                    <TableCell className="max-w-xs">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                        <span className="break-words">{location.address}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <Calendar className="h-3 w-3 mr-1" />
                        {location.eventCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-500">
                      {location.sampleTitle}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => createFromLocationMutation.mutate({ address: location.address })}
                        disabled={createFromLocationMutation.isPending}
                      >
                        {createFromLocationMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Maak venue
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuwe venue aanmaken</DialogTitle>
            <DialogDescription>
              Voer de gegevens in voor de nieuwe venue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam</Label>
              <Input
                id="name"
                value={newVenueName}
                onChange={(e) => setNewVenueName(e.target.value)}
                placeholder="bijv. Theater De Lieve Vrouw"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adres</Label>
              <Input
                id="address"
                value={newVenueAddress}
                onChange={(e) => setNewVenueAddress(e.target.value)}
                placeholder="bijv. Kerkstraat 1, 5000 AA Tilburg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annuleren
            </Button>
            <Button
              onClick={() => createVenueMutation.mutate({ name: newVenueName, address: newVenueAddress })}
              disabled={!newVenueName || createVenueMutation.isPending}
            >
              {createVenueMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Aanmaken
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminVenues;
