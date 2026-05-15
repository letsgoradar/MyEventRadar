import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  CheckSquare,
  Euro,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Globe,
  Edit,
  Plus,
  Trash2,
  Loader2,
  Pin,
  Clock,
  ExternalLink,
  Save,
} from "lucide-react";
import type { Venue, VenueContact, VenueNote, VenueTask, SponsorCampaign } from "@shared/schema";

interface VenueEvent {
  id: number;
  title: string;
  startTime: string | Date | null;
  category: string;
}
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const AdminVenueDetail = () => {
  const { id } = useParams<{ id: string }>();
  const venueId = parseInt(id || "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("info");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<Venue>>({});

  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [showSponsorDialog, setShowSponsorDialog] = useState(false);

  const [newContact, setNewContact] = useState({ name: "", role: "", email: "", phone: "", notes: "" });
  const [newNote, setNewNote] = useState({ content: "", isPinned: false });
  const [newTask, setNewTask] = useState({ title: "", description: "", dueDate: "", priority: "medium" as const, status: "todo" as const });
  const [newSponsor, setNewSponsor] = useState({ name: "", sponsorName: "", sponsorEmail: "", campaignType: "visibility" as const, value: 0, status: "draft" as const, notes: "" });

  const { data: venue, isLoading: venueLoading } = useQuery<Venue>({
    queryKey: ["/api/admin/venues", venueId],
    enabled: venueId > 0,
  });

  const { data: contacts = [] } = useQuery<VenueContact[]>({
    queryKey: ["/api/admin/venues", venueId, "contacts"],
    enabled: venueId > 0,
  });

  const { data: notes = [] } = useQuery<VenueNote[]>({
    queryKey: ["/api/admin/venues", venueId, "notes"],
    enabled: venueId > 0,
  });

  const { data: tasks = [] } = useQuery<VenueTask[]>({
    queryKey: ["/api/admin/venues", venueId, "tasks"],
    enabled: venueId > 0,
  });

  const { data: sponsors = [] } = useQuery<SponsorCampaign[]>({
    queryKey: ["/api/admin/venues", venueId, "sponsors"],
    enabled: venueId > 0,
  });

  const { data: venueEvents = [] } = useQuery<VenueEvent[]>({
    queryKey: ["/api/admin/venues", venueId, "events"],
    enabled: venueId > 0,
  });

  const updateVenueMutation = useMutation({
    mutationFn: async (data: Partial<Venue>) => {
      return apiRequest(`/api/admin/venues/${venueId}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId] });
      toast({ title: "Venue bijgewerkt" });
      setEditMode(false);
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: typeof newContact) => {
      return apiRequest(`/api/admin/venues/${venueId}/contacts`, {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "contacts"] });
      toast({ title: "Contact toegevoegd" });
      setShowContactDialog(false);
      setNewContact({ name: "", role: "", email: "", phone: "", notes: "" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: number) => {
      return apiRequest(`/api/admin/venues/contacts/${contactId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "contacts"] });
      toast({ title: "Contact verwijderd" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: typeof newNote) => {
      return apiRequest(`/api/admin/venues/${venueId}/notes`, {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "notes"] });
      toast({ title: "Notitie toegevoegd" });
      setShowNoteDialog(false);
      setNewNote({ content: "", isPinned: false });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      return apiRequest(`/api/admin/venues/notes/${noteId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "notes"] });
      toast({ title: "Notitie verwijderd" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      return apiRequest(`/api/admin/venues/${venueId}/tasks`, {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "tasks"] });
      toast({ title: "Taak toegevoegd" });
      setShowTaskDialog(false);
      setNewTask({ title: "", description: "", dueDate: "", priority: "medium", status: "todo" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: number; data: Partial<VenueTask> }) => {
      return apiRequest(`/api/admin/venues/tasks/${taskId}`, {
        method: "PATCH",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "tasks"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiRequest(`/api/admin/venues/tasks/${taskId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "tasks"] });
      toast({ title: "Taak verwijderd" });
    },
  });

  const createSponsorMutation = useMutation({
    mutationFn: async (data: typeof newSponsor) => {
      return apiRequest(`/api/admin/venues/${venueId}/sponsors`, {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "sponsors"] });
      toast({ title: "Sponsor campagne toegevoegd" });
      setShowSponsorDialog(false);
      setNewSponsor({ name: "", sponsorName: "", sponsorEmail: "", campaignType: "visibility", value: 0, status: "draft", notes: "" });
    },
  });

  const deleteSponsorMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest(`/api/admin/venues/sponsors/${campaignId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venues", venueId, "sponsors"] });
      toast({ title: "Sponsor campagne verwijderd" });
    },
  });

  if (venueLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!venue) {
    return (
      <AdminLayout>
        <div className="p-6 text-center py-12">
          <p className="text-gray-500">Venue niet gevonden</p>
          <Button className="mt-4" onClick={() => setLocation("/admin/venues")}>
            Terug naar overzicht
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const priorityColors = {
    low: "bg-gray-100 text-gray-800",
    medium: "bg-blue-100 text-blue-800",
    high: "bg-orange-100 text-orange-800",
    urgent: "bg-red-100 text-red-800",
  };

  const statusColors = {
    todo: "bg-gray-100 text-gray-800",
    in_progress: "bg-blue-100 text-blue-800",
    done: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  const campaignStatusColors = {
    draft: "bg-gray-100 text-gray-800",
    proposed: "bg-yellow-100 text-yellow-800",
    active: "bg-green-100 text-green-800",
    completed: "bg-blue-100 text-blue-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/venues")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
              <p className="text-gray-500 flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {venue.address || "Geen adres"}
              </p>
            </div>
            <Badge variant={venue.status === "active" ? "default" : "secondary"}>
              {venue.status === "active" ? "Actief" : venue.status === "pending" ? "In afwachting" : "Gearchiveerd"}
            </Badge>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6 mb-6">
              <TabsTrigger value="info" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Info
              </TabsTrigger>
              <TabsTrigger value="contacts" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacten ({contacts.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notities ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Taken ({tasks.filter(t => t.status !== "done" && t.status !== "cancelled").length})
              </TabsTrigger>
              <TabsTrigger value="sponsors" className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                Sponsors ({sponsors.length})
              </TabsTrigger>
              <TabsTrigger value="events" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Events ({venueEvents.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Venue informatie</CardTitle>
                    <CardDescription>Basisgegevens en contactinformatie</CardDescription>
                  </div>
                  {editMode ? (
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setEditMode(false)}>Annuleren</Button>
                      <Button onClick={() => updateVenueMutation.mutate(editData)}>
                        <Save className="h-4 w-4 mr-2" />
                        Opslaan
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" onClick={() => { setEditMode(true); setEditData(venue); }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Bewerken
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Naam</Label>
                      {editMode ? (
                        <Input value={editData.name || ""} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                      ) : (
                        <p className="text-gray-900">{venue.name}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Categorie</Label>
                      {editMode ? (
                        <Select value={editData.category || ""} onValueChange={(v) => setEditData({ ...editData, category: v })}>
                          <SelectTrigger><SelectValue placeholder="Selecteer categorie" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="theater">Theater</SelectItem>
                            <SelectItem value="museum">Museum</SelectItem>
                            <SelectItem value="concert_hall">Concertzaal</SelectItem>
                            <SelectItem value="community_center">Gemeenschapscentrum</SelectItem>
                            <SelectItem value="sports">Sportlocatie</SelectItem>
                            <SelectItem value="outdoor">Buitenlocatie</SelectItem>
                            <SelectItem value="other">Anders</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-gray-900">{venue.category || "-"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Adres</Label>
                      {editMode ? (
                        <Input value={editData.address || ""} onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                      ) : (
                        <p className="text-gray-900 flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {venue.address || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Gemeente</Label>
                      {editMode ? (
                        <Input value={editData.municipality || ""} onChange={(e) => setEditData({ ...editData, municipality: e.target.value })} />
                      ) : (
                        <p className="text-gray-900">{venue.municipality || "-"}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Website</Label>
                      {editMode ? (
                        <Input value={editData.websiteUrl || ""} onChange={(e) => setEditData({ ...editData, websiteUrl: e.target.value })} />
                      ) : (
                        <p className="text-gray-900 flex items-center gap-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          {venue.websiteUrl ? <a href={venue.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{venue.websiteUrl}</a> : "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail</Label>
                      {editMode ? (
                        <Input value={editData.contactEmail || ""} onChange={(e) => setEditData({ ...editData, contactEmail: e.target.value })} />
                      ) : (
                        <p className="text-gray-900 flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          {venue.contactEmail || "-"}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Telefoon</Label>
                      {editMode ? (
                        <Input value={editData.contactPhone || ""} onChange={(e) => setEditData({ ...editData, contactPhone: e.target.value })} />
                      ) : (
                        <p className="text-gray-900 flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          {venue.contactPhone || "-"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Beschrijving</Label>
                    {editMode ? (
                      <Textarea value={editData.description || ""} onChange={(e) => setEditData({ ...editData, description: e.target.value })} rows={4} />
                    ) : (
                      <p className="text-gray-900">{venue.description || "-"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="contacts">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Contactpersonen</CardTitle>
                    <CardDescription>Beheer contacten voor deze venue</CardDescription>
                  </div>
                  <Button onClick={() => setShowContactDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Contact toevoegen
                  </Button>
                </CardHeader>
                <CardContent>
                  {contacts.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Nog geen contactpersonen toegevoegd</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Naam</TableHead>
                          <TableHead>Functie</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Telefoon</TableHead>
                          <TableHead>Notities</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell className="font-medium">
                              {contact.name}
                              {contact.isPrimary && <Badge className="ml-2" variant="outline">Primair</Badge>}
                            </TableCell>
                            <TableCell>{contact.role || "-"}</TableCell>
                            <TableCell>{contact.email || "-"}</TableCell>
                            <TableCell>{contact.phone || "-"}</TableCell>
                            <TableCell className="max-w-xs truncate">{contact.notes || "-"}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteContactMutation.mutate(contact.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Notities</CardTitle>
                    <CardDescription>Persoonlijke notities over deze venue</CardDescription>
                  </div>
                  <Button onClick={() => setShowNoteDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Notitie toevoegen
                  </Button>
                </CardHeader>
                <CardContent>
                  {notes.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Nog geen notities toegevoegd</p>
                  ) : (
                    <div className="space-y-4">
                      {notes.map((note) => (
                        <Card key={note.id} className={note.isPinned ? "border-yellow-300 bg-yellow-50" : ""}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                {note.isPinned && (
                                  <Badge variant="outline" className="mb-2">
                                    <Pin className="h-3 w-3 mr-1" />
                                    Vastgepind
                                  </Badge>
                                )}
                                <p className="text-gray-900 whitespace-pre-wrap">{note.content}</p>
                                <p className="text-sm text-gray-500 mt-2">
                                  {format(new Date(note.createdAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                                </p>
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => deleteNoteMutation.mutate(note.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Taken</CardTitle>
                    <CardDescription>Taken en actiepunten voor deze venue</CardDescription>
                  </div>
                  <Button onClick={() => setShowTaskDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Taak toevoegen
                  </Button>
                </CardHeader>
                <CardContent>
                  {tasks.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Nog geen taken toegevoegd</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Taak</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Prioriteit</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task) => (
                          <TableRow key={task.id} className={task.status === "done" ? "opacity-50" : ""}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{task.title}</p>
                                {task.description && <p className="text-sm text-gray-500">{task.description}</p>}
                              </div>
                            </TableCell>
                            <TableCell>
                              {task.dueDate ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-gray-400" />
                                  {format(new Date(task.dueDate), "d MMM yyyy", { locale: nl })}
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge className={priorityColors[task.priority || "medium"]}>
                                {task.priority === "low" ? "Laag" : task.priority === "medium" ? "Normaal" : task.priority === "high" ? "Hoog" : "Urgent"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={task.status || "todo"}
                                onValueChange={(v) => updateTaskMutation.mutate({ taskId: task.id, data: { status: v as any } })}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todo">Te doen</SelectItem>
                                  <SelectItem value="in_progress">Bezig</SelectItem>
                                  <SelectItem value="done">Klaar</SelectItem>
                                  <SelectItem value="cancelled">Geannuleerd</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteTaskMutation.mutate(task.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sponsors">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Sponsor campagnes</CardTitle>
                    <CardDescription>Beheer sponsoring en partnerships</CardDescription>
                  </div>
                  <Button onClick={() => setShowSponsorDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Campagne toevoegen
                  </Button>
                </CardHeader>
                <CardContent>
                  {sponsors.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Nog geen sponsor campagnes</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campagne</TableHead>
                          <TableHead>Sponsor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Waarde</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sponsors.map((sponsor) => (
                          <TableRow key={sponsor.id}>
                            <TableCell className="font-medium">{sponsor.name}</TableCell>
                            <TableCell>{sponsor.sponsorName || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {sponsor.campaignType === "visibility" ? "Zichtbaarheid" :
                                 sponsor.campaignType === "financial" ? "Financieel" :
                                 sponsor.campaignType === "in_kind" ? "In natura" :
                                 sponsor.campaignType === "media" ? "Media" : "Anders"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {sponsor.value ? `€${(sponsor.value / 100).toFixed(2)}` : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge className={campaignStatusColors[sponsor.status || "draft"]}>
                                {sponsor.status === "draft" ? "Concept" :
                                 sponsor.status === "proposed" ? "Voorgesteld" :
                                 sponsor.status === "active" ? "Actief" :
                                 sponsor.status === "completed" ? "Afgerond" : "Geannuleerd"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => deleteSponsorMutation.mutate(sponsor.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="events">
              <Card>
                <CardHeader>
                  <CardTitle>Evenementen</CardTitle>
                  <CardDescription>Evenementen gekoppeld aan deze venue</CardDescription>
                </CardHeader>
                <CardContent>
                  {venueEvents.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Geen evenementen gekoppeld aan deze venue</p>
                  ) : (
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Titel</TableHead>
                          <TableHead>Datum</TableHead>
                          <TableHead>Categorie</TableHead>
                          <TableHead className="w-20"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {venueEvents.map((event) => (
                          <TableRow key={event.id}>
                            <TableCell className="font-medium">{event.title}</TableCell>
                            <TableCell>
                              {event.startTime ? format(new Date(event.startTime), "d MMM yyyy", { locale: nl }) : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{event.category}</Badge>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => setLocation(`/admin/events/${event.id}`)}>
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contact toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Naam *</Label>
              <Input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Functie</Label>
              <Input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} placeholder="bijv. Programmeur, Marketing" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefoon</Label>
                <Input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notities</Label>
              <Textarea value={newContact.notes} onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>Annuleren</Button>
            <Button onClick={() => createContactMutation.mutate(newContact)} disabled={!newContact.name}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notitie toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Notitie</Label>
              <Textarea value={newNote.content} onChange={(e) => setNewNote({ ...newNote, content: e.target.value })} rows={4} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pinned" checked={newNote.isPinned} onChange={(e) => setNewNote({ ...newNote, isPinned: e.target.checked })} />
              <Label htmlFor="pinned">Vastpinnen bovenaan</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoteDialog(false)}>Annuleren</Button>
            <Button onClick={() => createNoteMutation.mutate(newNote)} disabled={!newNote.content}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Taak toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Prioriteit</Label>
                <Select value={newTask.priority} onValueChange={(v: any) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Laag</SelectItem>
                    <SelectItem value="medium">Normaal</SelectItem>
                    <SelectItem value="high">Hoog</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Annuleren</Button>
            <Button onClick={() => createTaskMutation.mutate(newTask)} disabled={!newTask.title}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSponsorDialog} onOpenChange={setShowSponsorDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sponsor campagne toevoegen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campagne naam *</Label>
              <Input value={newSponsor.name} onChange={(e) => setNewSponsor({ ...newSponsor, name: e.target.value })} placeholder="bijv. Zomer sponsoring 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sponsor naam</Label>
                <Input value={newSponsor.sponsorName} onChange={(e) => setNewSponsor({ ...newSponsor, sponsorName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sponsor e-mail</Label>
                <Input type="email" value={newSponsor.sponsorEmail} onChange={(e) => setNewSponsor({ ...newSponsor, sponsorEmail: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newSponsor.campaignType} onValueChange={(v: any) => setNewSponsor({ ...newSponsor, campaignType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visibility">Zichtbaarheid</SelectItem>
                    <SelectItem value="financial">Financieel</SelectItem>
                    <SelectItem value="in_kind">In natura</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="other">Anders</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Waarde (€)</Label>
                <Input type="number" value={newSponsor.value / 100} onChange={(e) => setNewSponsor({ ...newSponsor, value: parseFloat(e.target.value) * 100 || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notities</Label>
              <Textarea value={newSponsor.notes} onChange={(e) => setNewSponsor({ ...newSponsor, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSponsorDialog(false)}>Annuleren</Button>
            <Button onClick={() => createSponsorMutation.mutate(newSponsor)} disabled={!newSponsor.name}>Toevoegen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminVenueDetail;
