import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AdminLayout from "@/components/Layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MoreHorizontal,
  Check,
  X,
  Pause,
  Play,
  Eye,
  MousePointerClick,
  Megaphone,
  Loader2,
  Building2,
  DollarSign,
  TrendingUp,
  Settings,
  ExternalLink,
  Ban,
  CircleCheck,
  Clock,
  MapPin,
  Save,
  UserPlus,
  Send,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { nl } from "date-fns/locale";

interface AdvertiserProfile {
  id: number;
  userId: number;
  companyName: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  address?: string;
  businessCategory: string;
  phone?: string;
  balanceCents: number;
  monthlyBudgetCapCents?: number;
  currentMonthSpendCents: number;
  status: string;
  createdAt: string;
}

interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: string;
}
interface PromoterInvitation {
  id: number;
  organizationName: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

interface BusinessAd {
  id: number;
  advertiserId: number;
  title: string;
  description?: string;
  imageUrl?: string;
  ctaUrl: string;
  ctaText?: string;
  targetRadiusKm: number;
  targetCategories?: string[];
  status: string;
  impressions: number;
  clicks: number;
  cpmCents: number;
  totalSpendCents: number;
  createdAt: string;
}

interface EventPromotion {
  id: number;
  eventId: number;
  purchasedByUserId: number;
  promotionPeriod: string;
  startDate: string;
  endDate: string;
  targetRadiusKm: number;
  status: string;
  priceCents: number;
  impressions: number;
  clicks: number;
  createdAt: string;
}

interface EventInfo {
  id: number;
  title: string;
  category: string;
}

interface PricingConfigItem {
  id: number;
  productType: string;
  radiusKm: number;
  period?: string;
  priceCents: number;
  isActive: boolean;
}

interface RevenueData {
  totalAdSpendCents: number;
  totalPromotionRevenueCents: number;
  activeAds: number;
  activePromotions: number;
}

function formatCents(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function statusBadge(status: string) {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
     invited: { variant: "outline", label: "Uitgenodigd" },
     pending: { variant: "outline", label: "Wacht verificatie" },
    active: { variant: "default", label: "Actief" },
    suspended: { variant: "destructive", label: "Opgeschort" },
    draft: { variant: "secondary", label: "Concept" },
    paused: { variant: "secondary", label: "Gepauzeerd" },
    exhausted: { variant: "destructive", label: "Budget op" },
    expired: { variant: "secondary", label: "Verlopen" },
    cancelled: { variant: "destructive", label: "Geannuleerd" },
  };
  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function periodLabel(period: string): string {
  const labels: Record<string, string> = { day: "Dag", week: "Week", month: "Maand" };
  return labels[period] || period;
}

function AdvertisersTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ organizationName: "", email: "" });

  const { data, isLoading } = useQuery<{ advertisers: Array<{ profile: AdvertiserProfile; user: UserInfo }> }>({
    queryKey: ["/api/promotions/admin/advertisers"],
  });
  const invitationsQuery = useQuery<{ invitations: PromoterInvitation[] }>({
    queryKey: ["/api/promoter-invitations"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest(`/api/promotions/admin/advertisers/${id}/status`, {
        method: "PATCH",
        data: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/advertisers"] });
      toast({ title: "Status bijgewerkt" });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon status niet bijwerken", variant: "destructive" });
    },
  });
  const inviteMutation = useMutation({
    mutationFn: () => apiRequest("/api/promoter-invitations", { method: "POST", data: invite }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/advertisers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promoter-invitations"] });
      setInvite({ organizationName: "", email: "" });
      setInviteOpen(false);
      toast({ title: "Uitnodiging verzonden" });
    },
    onError: (error: Error) => toast({ title: "Uitnodiging mislukt", description: error.message, variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "resend" | "revoke" }) =>
      apiRequest(`/api/promoter-invitations/${id}/${action}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/advertisers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/promoter-invitations"] });
      toast({ title: "Uitnodiging bijgewerkt" });
    },
    onError: () => toast({ title: "Actie mislukt", description: "Probeer het opnieuw.", variant: "destructive" }),
  });

  const advertisers = data?.advertisers || [];
  const invitations = invitationsQuery.data?.invitations || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => setInviteOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Promotor uitnodigen</Button>
      </div>
      {invitations.length > 0 && <div className="mb-6 space-y-2">
        <h3 className="text-sm font-semibold">Uitnodigingen</h3>
        {invitations.map((invitation) => {
          const isExpired = invitation.status === "active" && new Date(invitation.expiresAt) <= new Date();
          const canResend = invitation.status === "active";
          const canRevoke = invitation.status === "active" && !isExpired;
          const label = invitation.status === "accepted" ? "Geaccepteerd" : invitation.status === "revoked" ? "Ingetrokken" : isExpired ? "Verlopen" : "Uitgenodigd";
          return <div key={invitation.id} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="flex items-center gap-2"><span className="font-medium">{invitation.organizationName}</span><Badge variant={canRevoke ? "outline" : "secondary"}>{label}</Badge></div><div className="text-sm text-muted-foreground">{invitation.email} · verloopt {format(new Date(invitation.expiresAt), "d MMM yyyy", { locale: nl })}</div></div>
            {canResend && <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ id: invitation.id, action: "resend" })}><Send className="mr-2 h-4 w-4" />Opnieuw</Button>{canRevoke && <Button size="sm" variant="outline" onClick={() => actionMutation.mutate({ id: invitation.id, action: "revoke" })}><Trash2 className="mr-2 h-4 w-4 text-red-600" />Intrekken</Button>}</div>}
          </div>;
        })}
      </div>}
      {advertisers.length === 0 ? (
        <div className="text-center py-12 text-gray-500"><Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nog geen promotors geregistreerd</p></div>
      ) : <Table>
        <TableHeader><TableRow>
          <TableHead>Bedrijf</TableHead>
          <TableHead>Gebruiker</TableHead>
          <TableHead>Categorie</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead className="text-right">Spend (maand)</TableHead>
          <TableHead className="text-right">Budget Cap</TableHead>
          <TableHead>Geregistreerd</TableHead>
          <TableHead></TableHead>
        </TableRow></TableHeader><TableBody>
        {advertisers.map(({ profile, user }) => (
          <TableRow key={profile.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {profile.logoUrl ? (
                  <img src={profile.logoUrl} alt="" className="w-8 h-8 rounded object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-xs font-bold">
                    {profile.companyName[0]}
                  </div>
                )}
                <div>
                  <div>{profile.companyName}</div>
                  {profile.websiteUrl && (
                    <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      Website
                    </a>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">{user.username}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </TableCell>
            <TableCell className="capitalize">{profile.businessCategory}</TableCell>
             <TableCell>{statusBadge(profile.status === "invited" ? "invited" : profile.status)}</TableCell>
            <TableCell className="text-right font-mono">{formatCents(profile.balanceCents)}</TableCell>
            <TableCell className="text-right font-mono">{formatCents(profile.currentMonthSpendCents)}</TableCell>
            <TableCell className="text-right font-mono">
              {profile.monthlyBudgetCapCents ? formatCents(profile.monthlyBudgetCapCents) : "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDistanceToNow(new Date(profile.createdAt), { addSuffix: true, locale: nl })}
            </TableCell>
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {profile.status !== "active" && (
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: profile.id, status: "active" })}>
                      <CircleCheck className="h-4 w-4 mr-2 text-green-600" />
                      Activeren
                    </DropdownMenuItem>
                  )}
                  {profile.status !== "suspended" && (
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: profile.id, status: "suspended" })}>
                      <Ban className="h-4 w-4 mr-2 text-red-600" />
                      Opschorten
                    </DropdownMenuItem>
                  )}
                  {profile.status !== "pending" && (
                    <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: profile.id, status: "pending" })}>
                      <Clock className="h-4 w-4 mr-2 text-amber-600" />
                      Naar In Afwachting
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody></Table>}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Promotor uitnodigen</DialogTitle><DialogDescription>Stuur een verificatie-uitnodiging naar een organisatie. Er is nog geen account nodig.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Organisatienaam</label><Input className="mt-1" value={invite.organizationName} onChange={(e) => setInvite({ ...invite, organizationName: e.target.value })} placeholder="Bijv. Stadsmuseum Utrecht" /></div>
            <div><label className="text-sm font-medium">E-mailadres</label><Input className="mt-1" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="beheer@organisatie.nl" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInviteOpen(false)}>Annuleren</Button><Button disabled={!invite.organizationName.trim() || !invite.email.trim() || inviteMutation.isPending} onClick={() => inviteMutation.mutate()}>{inviteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Uitnodiging verzenden</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BusinessAdsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedAdId, setSelectedAdId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery<{ ads: Array<{ ad: BusinessAd; profile: AdvertiserProfile }> }>({
    queryKey: ["/api/promotions/admin/all-ads"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return apiRequest(`/api/promotions/admin/ads/${id}/status`, {
        method: "PATCH",
        data: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/all-ads"] });
      toast({ title: "Advertentie status bijgewerkt" });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon status niet bijwerken", variant: "destructive" });
    },
  });

  const ads = data?.ads || [];

  const handleReject = () => {
    if (selectedAdId !== null) {
      updateStatusMutation.mutate({ id: selectedAdId, status: "draft" });
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedAdId(null);
      toast({ title: "Advertentie afgewezen", description: rejectReason || "Geen reden opgegeven" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (ads.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nog geen bedrijfsadvertenties</p>
      </div>
    );
  }

  const pendingCount = ads.filter(a => a.ad.status === "pending").length;

  return (
    <>
      {pendingCount > 0 && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          <strong>{pendingCount}</strong> advertentie(s) wachten op goedkeuring
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Advertentie</TableHead>
            <TableHead>Adverteerder</TableHead>
            <TableHead>Radius</TableHead>
            <TableHead className="text-right">CPM</TableHead>
            <TableHead className="text-right">Impressies</TableHead>
            <TableHead className="text-right">Clicks</TableHead>
            <TableHead className="text-right">Spend</TableHead>
            <TableHead>Aangemaakt</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ads.map(({ ad, profile }) => {
            const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(1) : "0";
            return (
              <TableRow key={ad.id} className={ad.status === "pending" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                <TableCell>{statusBadge(ad.status)}</TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    <div className="font-medium truncate">{ad.title}</div>
                    {ad.description && (
                      <div className="text-xs text-muted-foreground truncate">{ad.description}</div>
                    )}
                    <a href={ad.ctaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-0.5">
                      <ExternalLink className="h-3 w-3" />
                      {ad.ctaText || "Meer info"}
                    </a>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{profile.companyName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3" />
                    {ad.targetRadiusKm} km
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCents(ad.cpmCents)}</TableCell>
                <TableCell className="text-right">{ad.impressions.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {ad.clicks.toLocaleString()}
                  <span className="text-xs text-muted-foreground ml-1">({ctr}%)</span>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCents(ad.totalSpendCents)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(ad.createdAt), { addSuffix: true, locale: nl })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {ad.status === "pending" && (
                        <>
                          <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: ad.id, status: "active" })}>
                            <Check className="h-4 w-4 mr-2 text-green-600" />
                            Goedkeuren
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedAdId(ad.id); setRejectDialogOpen(true); }}>
                            <X className="h-4 w-4 mr-2 text-red-600" />
                            Afwijzen
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {ad.status === "active" && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: ad.id, status: "paused" })}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pauzeren
                        </DropdownMenuItem>
                      )}
                      {(ad.status === "paused" || ad.status === "draft") && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: ad.id, status: "active" })}>
                          <Play className="h-4 w-4 mr-2" />
                          Activeren
                        </DropdownMenuItem>
                      )}
                      {ad.status !== "pending" && ad.status !== "draft" && (
                        <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: ad.id, status: "pending" })}>
                          <Clock className="h-4 w-4 mr-2" />
                          Naar In Afwachting
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Advertentie Afwijzen</DialogTitle>
            <DialogDescription>
              Geef optioneel een reden op voor de afwijzing
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Reden voor afwijzing (optioneel)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Annuleren</Button>
            <Button variant="destructive" onClick={handleReject}>Afwijzen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EventPromotionsTab() {
  const { data, isLoading } = useQuery<{ promotions: Array<{ promotion: EventPromotion; event: EventInfo }> }>({
    queryKey: ["/api/promotions/admin/all-promotions"],
  });

  const promotions = data?.promotions || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nog geen event-promoties</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Event</TableHead>
          <TableHead>Periode</TableHead>
          <TableHead>Radius</TableHead>
          <TableHead>Start</TableHead>
          <TableHead>Einde</TableHead>
          <TableHead className="text-right">Prijs</TableHead>
          <TableHead className="text-right">Impressies</TableHead>
          <TableHead className="text-right">Clicks</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {promotions.map(({ promotion, event }) => {
          const ctr = promotion.impressions > 0 ? ((promotion.clicks / promotion.impressions) * 100).toFixed(1) : "0";
          return (
            <TableRow key={promotion.id}>
              <TableCell>{statusBadge(promotion.status)}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">
                {event.title}
              </TableCell>
              <TableCell>{periodLabel(promotion.promotionPeriod)}</TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-sm">
                  <MapPin className="h-3 w-3" />
                  {promotion.targetRadiusKm} km
                </div>
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(promotion.startDate), "d MMM yyyy", { locale: nl })}
              </TableCell>
              <TableCell className="text-sm">
                {format(new Date(promotion.endDate), "d MMM yyyy", { locale: nl })}
              </TableCell>
              <TableCell className="text-right font-mono">{formatCents(promotion.priceCents)}</TableCell>
              <TableCell className="text-right">{promotion.impressions.toLocaleString()}</TableCell>
              <TableCell className="text-right">
                {promotion.clicks.toLocaleString()}
                <span className="text-xs text-muted-foreground ml-1">({ctr}%)</span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function RevenueTab() {
  const { data: revenue, isLoading: revenueLoading } = useQuery<RevenueData>({
    queryKey: ["/api/promotions/admin/revenue"],
  });

  const { data: advertiserData } = useQuery<{ advertisers: Array<{ profile: AdvertiserProfile; user: UserInfo }> }>({
    queryKey: ["/api/promotions/admin/advertisers"],
  });

  if (revenueLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const totalRevenue = (revenue?.totalAdSpendCents || 0) + (revenue?.totalPromotionRevenueCents || 0);
  const advertisers = advertiserData?.advertisers || [];
  const sortedBySpend = [...advertisers].sort((a, b) => b.profile.currentMonthSpendCents - a.profile.currentMonthSpendCents);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Totale Inkomsten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCents(totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Advertentie Inkomsten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(revenue?.totalAdSpendCents || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Promotie Inkomsten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCents(revenue?.totalPromotionRevenueCents || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Actief</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg">
              <span className="font-bold">{revenue?.activeAds || 0}</span> ads,{" "}
              <span className="font-bold">{revenue?.activePromotions || 0}</span> promoties
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spend per Adverteerder</CardTitle>
          <CardDescription>Huidige maand uitgaven per adverteerder</CardDescription>
        </CardHeader>
        <CardContent>
          {sortedBySpend.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Geen adverteerders</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adverteerder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Spend (maand)</TableHead>
                  <TableHead className="text-right">Budget Cap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBySpend.map(({ profile }) => (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.companyName}</TableCell>
                    <TableCell>{statusBadge(profile.status)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCents(profile.balanceCents)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCents(profile.currentMonthSpendCents)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {profile.monthlyBudgetCapCents ? formatCents(profile.monthlyBudgetCapCents) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PricingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data, isLoading } = useQuery<{ pricing: PricingConfigItem[] }>({
    queryKey: ["/api/promotions/admin/pricing"],
  });

  const updatePricingMutation = useMutation({
    mutationFn: async ({ id, priceCents, isActive }: { id: number; priceCents?: number; isActive?: boolean }) => {
      return apiRequest(`/api/promotions/admin/pricing/${id}`, {
        method: "PATCH",
        data: { priceCents, isActive },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/pricing"] });
      setEditingId(null);
      setEditValue("");
      toast({ title: "Prijs bijgewerkt" });
    },
    onError: () => {
      toast({ title: "Fout", description: "Kon prijs niet bijwerken", variant: "destructive" });
    },
  });

  const pricing = data?.pricing || [];
  const eventPromotionPricing = pricing.filter(p => p.productType === "event_promotion");
  const businessAdPricing = pricing.filter(p => p.productType === "business_ad");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const handleSave = (id: number) => {
    const euros = parseFloat(editValue);
    if (isNaN(euros) || euros < 0) {
      toast({ title: "Ongeldige prijs", variant: "destructive" });
      return;
    }
    updatePricingMutation.mutate({ id, priceCents: Math.round(euros * 100) });
  };

  const renderPricingTable = (items: PricingConfigItem[], title: string, description: string) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Radius</TableHead>
              {items[0]?.period && <TableHead>Periode</TableHead>}
              <TableHead className="text-right">Prijs</TableHead>
              <TableHead>Actief</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {item.radiusKm} km
                  </div>
                </TableCell>
                {item.period !== undefined && <TableCell>{periodLabel(item.period || "")}</TableCell>}
                <TableCell className="text-right">
                  {editingId === item.id ? (
                    <div className="flex items-center gap-2 justify-end">
                      <span>€</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-24 h-8 text-right"
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(item.id); if (e.key === "Escape") { setEditingId(null); setEditValue(""); } }}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span className="font-mono cursor-pointer hover:text-primary" onClick={() => { setEditingId(item.id); setEditValue((item.priceCents / 100).toFixed(2)); }}>
                      {formatCents(item.priceCents)}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={item.isActive ? "default" : "secondary"}
                    className="cursor-pointer"
                    onClick={() => updatePricingMutation.mutate({ id: item.id, isActive: !item.isActive })}
                  >
                    {item.isActive ? "Actief" : "Inactief"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {editingId === item.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSave(item.id)} disabled={updatePricingMutation.isPending}>
                        <Save className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(null); setEditValue(""); }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingId(item.id); setEditValue((item.priceCents / 100).toFixed(2)); }}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {renderPricingTable(eventPromotionPricing, "Event Promotie Prijzen", "Prijs per radius en periode voor gepromote events")}
      {renderPricingTable(businessAdPricing, "Bedrijfsadvertentie CPM Prijzen", "CPM-prijs (per 1000 impressies) per radius voor bedrijfsadvertenties")}
    </div>
  );
}

function CampaignsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<any>({ name: "", advertiserId: "", adId: "", placement: "banner", destinationType: "website", startDate: "", endDate: "", budget: "", radius: "10" });
  const { data, isLoading } = useQuery<{ campaigns: Array<{ campaign: any; ad?: any; event?: any; venue?: any }> }>({
    queryKey: ["/api/promotions/admin/campaigns"],
  });
  const advertisersQuery = useQuery<{ advertisers: Array<{ profile: AdvertiserProfile; user: UserInfo }> }>({ queryKey: ["/api/promotions/admin/advertisers"] });
  const adsQuery = useQuery<{ ads: Array<{ ad: BusinessAd; profile: AdvertiserProfile }> }>({ queryKey: ["/api/promotions/admin/all-ads"] });
  const createMutation = useMutation({
    mutationFn: () => apiRequest("/api/promotions/admin/campaigns", { method: "POST", data: {
      name: draft.name, advertiserId: Number(draft.advertiserId), adId: Number(draft.adId), placement: draft.placement, destinationType: draft.destinationType,
      startDate: new Date(draft.startDate).toISOString(), endDate: new Date(draft.endDate).toISOString(), budgetCents: Math.round(Number(draft.budget) * 100), targetRadiusKm: Number(draft.radius), status: "pending",
    }}),
    onSuccess: () => { setOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/campaigns"] }); toast({ title: "Campagne aangemaakt" }); },
    onError: (e: Error) => toast({ title: "Campagne kon niet worden aangemaakt", description: e.message, variant: "destructive" }),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => apiRequest(`/api/promotions/admin/campaigns/${id}/status`, { method: "PATCH", data: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/promotions/admin/campaigns"] }),
    onError: (e: Error) => toast({ title: "Status kon niet worden bijgewerkt", description: e.message, variant: "destructive" }),
  });
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  const campaigns = data?.campaigns || [];
  return <><div className="flex justify-end mb-4"><Button onClick={() => setOpen(true)}><Megaphone className="h-4 w-4 mr-2" />Campagne aanmaken</Button></div>{campaigns.length ? <Table><TableHeader><TableRow><TableHead>Campagne</TableHead><TableHead>Materiaal</TableHead><TableHead>Doel</TableHead><TableHead>Looptijd</TableHead><TableHead>Budget</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{campaigns.map(({ campaign, ad, event, venue }) => <TableRow key={campaign.id}><TableCell className="font-medium">{campaign.name}</TableCell><TableCell>{ad?.title || "—"}</TableCell><TableCell>{event?.title || venue?.name || "Algemeen"}</TableCell><TableCell className="text-sm">{format(new Date(campaign.startDate), "d MMM", { locale: nl })} – {format(new Date(campaign.endDate), "d MMM yyyy", { locale: nl })}</TableCell><TableCell>{formatCents(campaign.budgetCents || 0)}</TableCell><TableCell>{statusBadge(campaign.status)}</TableCell><TableCell><Button size="sm" variant="outline" onClick={() => statusMutation.mutate({ id: campaign.id, status: campaign.status === "active" ? "paused" : "active" })}>{campaign.status === "active" ? "Pauzeren" : "Activeren"}</Button></TableCell></TableRow>)}</TableBody></Table> : <div className="text-center py-12 text-gray-500"><Megaphone className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>Nog geen campagnes</p></div>}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Campagne voor promotor</DialogTitle><DialogDescription>Selecteer promotor en advertentiemateriaal.</DialogDescription></DialogHeader><div className="space-y-3"><Input placeholder="Campagnenaam" onChange={(e) => setDraft({ ...draft, name: e.target.value })} /><select className="w-full border rounded-md p-2" value={draft.advertiserId} onChange={(e) => setDraft({ ...draft, advertiserId: e.target.value, adId: "" })}><option value="">Promotor selecteren</option>{(advertisersQuery.data?.advertisers || []).map(({ profile }) => <option key={profile.id} value={profile.id}>{profile.companyName}</option>)}</select><select className="w-full border rounded-md p-2" value={draft.adId} onChange={(e) => setDraft({ ...draft, adId: e.target.value })}><option value="">Advertentiemateriaal selecteren</option>{(adsQuery.data?.ads || []).filter(({ ad }) => String(ad.advertiserId) === String(draft.advertiserId)).map(({ ad }) => <option key={ad.id} value={ad.id}>{ad.title}</option>)}</select><div className="grid grid-cols-2 gap-2"><Input type="datetime-local" onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /><Input type="datetime-local" onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /></div><div className="grid grid-cols-2 gap-2"><Input type="number" placeholder="Budget €" onChange={(e) => setDraft({ ...draft, budget: e.target.value })} /><Input type="number" placeholder="Radius km" value={draft.radius} onChange={(e) => setDraft({ ...draft, radius: e.target.value })} /></div><Button className="w-full" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>Campagne aanmaken</Button></div></DialogContent></Dialog></>;
}

export default function Promotions() {
  const { data: revenue } = useQuery<RevenueData>({
    queryKey: ["/api/promotions/admin/revenue"],
  });

  const { data: adsData } = useQuery<{ ads: Array<{ ad: BusinessAd; profile: AdvertiserProfile }> }>({
    queryKey: ["/api/promotions/admin/all-ads"],
  });

  const { data: advertiserData } = useQuery<{ advertisers: Array<{ profile: AdvertiserProfile; user: UserInfo }> }>({
    queryKey: ["/api/promotions/admin/advertisers"],
  });

  const pendingAds = adsData?.ads?.filter(a => a.ad.status === "pending").length || 0;
  const pendingAdvertisers = advertiserData?.advertisers?.filter(a => a.profile.status === "pending").length || 0;
  const totalRevenue = (revenue?.totalAdSpendCents || 0) + (revenue?.totalPromotionRevenueCents || 0);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-foreground flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-teal-600" />
            Advertentie & Promotie Beheer
          </h1>
          <p className="text-gray-600 dark:text-muted-foreground mt-1">
            Beheer adverteerders, goedkeur advertenties, bekijk inkomsten en pas prijzen aan
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Building2 className="h-4 w-4" /> Adverteerders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{advertiserData?.advertisers?.length || 0}</div>
              {pendingAdvertisers > 0 && (
                <p className="text-xs text-amber-600">{pendingAdvertisers} wachtend op goedkeuring</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Eye className="h-4 w-4" /> Actieve Ads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenue?.activeAds || 0}</div>
              {pendingAds > 0 && (
                <p className="text-xs text-amber-600">{pendingAds} wachtend op goedkeuring</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" /> Actieve Promoties
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{revenue?.activePromotions || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <DollarSign className="h-4 w-4" /> Totale Inkomsten
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCents(totalRevenue)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="campaigns" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="campaigns">Campagnes</TabsTrigger>
            <TabsTrigger value="ads" className="relative">
              Materiaal (legacy)
              {pendingAds > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingAds}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="promotions">Event Promoties (legacy)</TabsTrigger>
            <TabsTrigger value="advertisers" className="relative">
              Adverteerders
              {pendingAdvertisers > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {pendingAdvertisers}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="revenue">Inkomsten</TabsTrigger>
            <TabsTrigger value="pricing">Prijsbeheer</TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>Campagnes</CardTitle>
                <CardDescription>Centraal overzicht van advertentiemateriaal, doelgroep, looptijd en budget</CardDescription>
              </CardHeader>
              <CardContent><CampaignsTab /></CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads">
            <Card>
              <CardHeader>
                <CardTitle>Bedrijfsadvertenties</CardTitle>
                <CardDescription>Alle advertenties met goedkeuringsworkflow — nieuwe advertenties starten als "In afwachting"</CardDescription>
              </CardHeader>
              <CardContent>
                <BusinessAdsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="promotions">
            <Card>
              <CardHeader>
                <CardTitle>Event Promoties</CardTitle>
                <CardDescription>Alle gepromote events met hun periode, radius en statistieken</CardDescription>
              </CardHeader>
              <CardContent>
                <EventPromotionsTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="advertisers">
            <Card>
              <CardHeader>
                <CardTitle>Adverteerders</CardTitle>
                <CardDescription>Overzicht van alle geregistreerde adverteerders met saldo en spend</CardDescription>
              </CardHeader>
              <CardContent>
                <AdvertisersTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue">
            <RevenueTab />
          </TabsContent>

          <TabsContent value="pricing">
            <PricingTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}