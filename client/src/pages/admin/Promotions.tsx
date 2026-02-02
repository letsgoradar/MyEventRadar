import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminSidebar from "@/components/Layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Plus,
  MoreHorizontal,
  Send,
  Trash2,
  Pause,
  Play,
  Eye,
  MousePointerClick,
  Megaphone,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";

interface PromotedNotification {
  id: number;
  eventId?: number;
  title: string;
  message: string;
  imageUrl?: string;
  linkUrl?: string;
  targetRadius?: number;
  targetCity?: string;
  targetAllUsers: boolean;
  campaignName?: string;
  advertiserName?: string;
  advertiserEmail?: string;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  impressions: number;
  clicks: number;
  budgetCents?: number;
  cpmCents?: number;
  createdBy?: number;
  createdAt: string;
  updatedAt?: string;
}

export default function Promotions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    campaignName: "",
    advertiserName: "",
    advertiserEmail: "",
    targetAllUsers: true,
    targetCity: "",
    linkUrl: "",
  });

  const { data: promotions = [], isLoading } = useQuery<PromotedNotification[]>({
    queryKey: ["/api/admin/promotions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("/api/admin/promotions", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      setIsCreateDialogOpen(false);
      setFormData({
        title: "",
        message: "",
        campaignName: "",
        advertiserName: "",
        advertiserEmail: "",
        targetAllUsers: true,
        targetCity: "",
        linkUrl: "",
      });
      toast({ title: "Promotie aangemaakt", description: "De promotie is succesvol aangemaakt" });
    },
    onError: () => {
      toast({ title: "Fout", description: "Er ging iets mis bij het aanmaken", variant: "destructive" });
    },
  });

  const pushMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/promotions/${id}/push`, {
        method: "POST",
      });
    },
    onSuccess: (data: { notificationsCreated?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({
        title: "Promotie verstuurd",
        description: `${data.notificationsCreated || 0} notificaties aangemaakt`,
      });
    },
    onError: () => {
      toast({ title: "Fout", description: "Er ging iets mis bij het versturen", variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest(`/api/admin/promotions/${id}`, {
        method: "PATCH",
        data: { isActive },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/promotions/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Promotie verwijderd" });
    },
  });

  const totalImpressions = promotions.reduce((sum, p) => sum + (p.impressions || 0), 0);
  const totalClicks = promotions.reduce((sum, p) => sum + (p.clicks || 0), 0);
  const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : "0";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-teal-600" />
              Promotie Notificaties
            </h1>
            <p className="text-gray-600 mt-1">
              Beheer betaalde promoties die naar gebruikers worden gepusht
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nieuwe Promotie
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nieuwe Promotie Aanmaken</DialogTitle>
                <DialogDescription>
                  Maak een nieuwe gesponsorde notificatie aan om naar gebruikers te sturen
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="campaignName">Campagne Naam</Label>
                  <Input
                    id="campaignName"
                    placeholder="Bijv. Zomerfestival 2026"
                    value={formData.campaignName}
                    onChange={(e) => setFormData({ ...formData, campaignName: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="advertiserName">Adverteerder</Label>
                    <Input
                      id="advertiserName"
                      placeholder="Naam adverteerder"
                      value={formData.advertiserName}
                      onChange={(e) => setFormData({ ...formData, advertiserName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="advertiserEmail">Email</Label>
                    <Input
                      id="advertiserEmail"
                      type="email"
                      placeholder="email@voorbeeld.nl"
                      value={formData.advertiserEmail}
                      onChange={(e) => setFormData({ ...formData, advertiserEmail: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Notificatie Titel</Label>
                  <Input
                    id="title"
                    placeholder="Bijv. Ontdek dit weekend!"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Bericht</Label>
                  <Textarea
                    id="message"
                    placeholder="Het volledige bericht dat gebruikers zien..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="linkUrl">Link URL (optioneel)</Label>
                  <Input
                    id="linkUrl"
                    placeholder="https://..."
                    value={formData.linkUrl}
                    onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Stuur naar alle gebruikers</Label>
                    <p className="text-sm text-muted-foreground">
                      Anders alleen naar specifieke stad
                    </p>
                  </div>
                  <Switch
                    checked={formData.targetAllUsers}
                    onCheckedChange={(checked) => setFormData({ ...formData, targetAllUsers: checked })}
                  />
                </div>

                {!formData.targetAllUsers && (
                  <div className="space-y-2">
                    <Label htmlFor="targetCity">Doelgroep Stad</Label>
                    <Input
                      id="targetCity"
                      placeholder="Bijv. Amsterdam"
                      value={formData.targetCity}
                      onChange={(e) => setFormData({ ...formData, targetCity: e.target.value })}
                    />
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuleren
                </Button>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.title || !formData.message || createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Aanmaken
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Totaal Promoties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{promotions.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Actieve Promoties</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {promotions.filter((p) => p.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Eye className="h-4 w-4" /> Impressies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalImpressions.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <MousePointerClick className="h-4 w-4" /> Clicks (CTR {ctr}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Alle Promoties</CardTitle>
            <CardDescription>Overzicht van alle promotie-notificaties</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : promotions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nog geen promoties aangemaakt</p>
                <p className="text-sm">Klik op "Nieuwe Promotie" om te beginnen</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Campagne</TableHead>
                    <TableHead>Titel</TableHead>
                    <TableHead>Doelgroep</TableHead>
                    <TableHead className="text-right">Impressies</TableHead>
                    <TableHead className="text-right">Clicks</TableHead>
                    <TableHead>Aangemaakt</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promotions.map((promo) => (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <Badge variant={promo.isActive ? "default" : "secondary"}>
                          {promo.isActive ? "Actief" : "Gepauzeerd"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {promo.campaignName || "-"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {promo.title}
                      </TableCell>
                      <TableCell>
                        {promo.targetAllUsers ? (
                          <Badge variant="outline">Alle gebruikers</Badge>
                        ) : (
                          <Badge variant="outline">{promo.targetCity || "Niet ingesteld"}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{promo.impressions.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{promo.clicks.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatDistanceToNow(new Date(promo.createdAt), { addSuffix: true, locale: nl })}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => pushMutation.mutate(promo.id)}
                              disabled={pushMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Verstuur naar gebruikers
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleActiveMutation.mutate({
                                  id: promo.id,
                                  isActive: !promo.isActive,
                                })
                              }
                            >
                              {promo.isActive ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pauzeren
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Activeren
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(promo.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Verwijderen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
