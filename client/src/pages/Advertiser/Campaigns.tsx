import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import AdvertiserSidebar from "@/components/Advertiser/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Loader2, Pause, Play, Calendar, MapPin, Target, Eye, MousePointerClick, XCircle } from "lucide-react";

type CampaignRow = { campaign: any; ad?: any; event?: any; venue?: any };
const radii = [0, 1, 5, 10, 25, 50];
const statusLabels: Record<string, string> = { draft: "Concept", pending: "In afwachting", active: "Actief", paused: "Gepauzeerd", exhausted: "Budget op", expired: "Verlopen" };

function cents(value: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format((value || 0) / 100);
}
function date(value: string) {
  return value ? new Date(value).toLocaleDateString("nl-NL") : "—";
}

export default function AdvertiserCampaigns() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", adId: "", placement: "banner", destinationType: "website", venueId: "",
    eventId: "", destinationUrl: "", startDate: "", endDate: "", budgetCents: "",
    targetRadiusKm: "10", targetCategories: "", status: "pending",
  });
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const { data: eventResults = [] } = useQuery<any[]>({
    queryKey: ["/api/advertiser/events/search", eventSearch],
    enabled: eventSearch.length >= 2,
    queryFn: () => fetch(`/api/advertiser/events/search?q=${encodeURIComponent(eventSearch)}`).then((r) => r.json()),
  });
  const { data, isLoading } = useQuery<{ campaigns: CampaignRow[] }>({
    queryKey: ["/api/advertiser/campaigns"], enabled: !!user,
  });
  const { data: ads } = useQuery<{ ads: any[] }>({
    queryKey: ["/api/advertiser/my-ads"], enabled: !!user,
  });
  const create = useMutation({
    mutationFn: (payload: any) => apiRequest("/api/advertiser/campaigns", { method: "POST", data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/campaigns"] });
      setOpen(false);
      toast({ title: "Campagne aangemaakt", description: "Je campagne wordt beoordeeld." });
    },
    onError: (e: Error) => toast({ title: "Campagne kon niet worden aangemaakt", description: e.message, variant: "destructive" }),
  });
  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/advertiser/campaigns/${id}/status`, { method: "PATCH", data: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/advertiser/campaigns"] }),
    onError: (e: Error) => toast({ title: "Status kon niet worden bijgewerkt", description: e.message, variant: "destructive" }),
  });
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const submit = () => {
    if (!form.name || !form.adId || !form.startDate || !form.endDate || !form.budgetCents) {
      toast({ title: "Vul de verplichte velden in", variant: "destructive" }); return;
    }
    create.mutate({
      name: form.name, adId: Number(form.adId), placement: form.placement,
      destinationType: form.destinationType, ...(form.venueId ? { venueId: Number(form.venueId) } : {}),
      ...(form.eventId ? { eventId: Number(form.eventId) } : {}),
      ...(form.destinationUrl ? { destinationUrl: form.destinationUrl } : {}),
      startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString(),
      budgetCents: Math.round(Number(form.budgetCents) * 100), targetRadiusKm: Number(form.targetRadiusKm),
      targetCategories: form.targetCategories ? form.targetCategories.split(",").map((v) => v.trim()).filter(Boolean) : undefined,
      status: form.status,
    });
  };
  return <div className="min-h-screen flex flex-col lg:flex-row bg-background">
    <AdvertiserSidebar />
    <main className="flex-1 overflow-auto pt-14 lg:pt-0"><div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><Megaphone className="h-8 w-8 text-primary" />Campagnes</h1>
          <p className="text-muted-foreground">Combineer je advertentiemateriaal met doelgroep, plaatsing en budget.</p></div>
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nieuwe campagne</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Nieuwe campagne</DialogTitle><DialogDescription>Kies materiaal, doel en looptijd. Event of locatie zijn optioneel.</DialogDescription></DialogHeader>
            <div className="grid gap-4">
              <Field label="Campagnenaam *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Zomercampagne" /></Field>
              <Field label="Advertentiemateriaal *"><Select value={form.adId} onValueChange={(v) => set("adId", v)}><SelectTrigger><SelectValue placeholder="Selecteer een advertentie" /></SelectTrigger><SelectContent>{(ads?.ads || []).map((ad) => <SelectItem key={ad.id} value={String(ad.id)}>{ad.title}</SelectItem>)}</SelectContent></Select></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Plaatsing"><Select value={form.placement} onValueChange={(v) => set("placement", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="banner">Banner</SelectItem><SelectItem value="external_interstitial">Externe doorverwijzing</SelectItem><SelectItem value="event_boost">Event uitlichten</SelectItem><SelectItem value="venue_spotlight">Locatie uitlichten</SelectItem></SelectContent></Select></Field>
                <Field label="Doeltype"><Select value={form.destinationType} onValueChange={(v) => set("destinationType", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="website">Website</SelectItem><SelectItem value="external">Externe link</SelectItem><SelectItem value="event">Event</SelectItem><SelectItem value="venue">Locatie</SelectItem></SelectContent></Select></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Startdatum *"><Input type="datetime-local" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field><Field label="Einddatum *"><Input type="datetime-local" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field></div>
              <div className="grid grid-cols-2 gap-3"><Field label="Budget (€) *"><Input type="number" min="1" step=".01" value={form.budgetCents} onChange={(e) => set("budgetCents", e.target.value)} placeholder="100" /></Field><Field label="Radius"><Select value={form.targetRadiusKm} onValueChange={(v) => set("targetRadiusKm", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{radii.map((r) => <SelectItem key={r} value={String(r)}>{r === 0 ? "Landelijk" : `${r} km`}</SelectItem>)}</SelectContent></Select></Field></div>
              <Field label="Event (optioneel)"><Input value={selectedEvent ? selectedEvent.title : eventSearch} onChange={(e) => { setEventSearch(e.target.value); setSelectedEvent(null); set("eventId", ""); }} placeholder="Zoek op eventnaam..." />{eventSearch.length >= 2 && !selectedEvent && <div className="border rounded-md max-h-32 overflow-y-auto">{eventResults.map((event) => <button type="button" className="block w-full text-left p-2 text-sm hover:bg-muted" key={event.id} onClick={() => { setSelectedEvent(event); setEventSearch(event.title); set("eventId", String(event.id)); }}>{event.title}</button>)}</div>}</Field>
              <Field label="Venue-ID (optioneel)"><Input type="number" value={form.venueId} onChange={(e) => set("venueId", e.target.value)} placeholder="Bijv. 45" /></Field>
              <Field label="Bestemmings-URL (optioneel)"><Input type="url" value={form.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} placeholder="https://jouwwebsite.nl" /></Field>
              <Field label="Categorieën (optioneel)"><Input value={form.targetCategories} onChange={(e) => set("targetCategories", e.target.value)} placeholder="muziek, festival" /><p className="text-xs text-muted-foreground">Scheid meerdere categorieën met komma's.</p></Field>
              <Button onClick={submit} disabled={create.isPending || !ads?.ads?.length}>{create.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aanmaken...</> : "Campagne aanmaken"}</Button>
              <p className="text-sm text-muted-foreground text-center">Nog geen materiaal? <a className="text-primary underline" href="/advertiser/ads">Maak eerst een advertentie</a>.</p>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : data?.campaigns?.length ? <div className="space-y-4">{data.campaigns.map(({ campaign, ad, event, venue }) => <Card key={campaign.id}><CardContent className="p-5"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-lg">{campaign.name}</h2><Badge>{statusLabels[campaign.status] || campaign.status}</Badge></div><p className="text-sm text-muted-foreground mt-1">{ad?.title || "Advertentie"} · {event?.title || venue?.name || "Algemene doelgroep"}</p><div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-3"><span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{date(campaign.startDate)} – {date(campaign.endDate)}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{campaign.targetRadiusKm === 0 ? "Landelijk" : `${campaign.targetRadiusKm} km`}</span><span className="flex items-center gap-1"><Target className="h-4 w-4" />Budget {cents(campaign.budgetCents)}</span></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-sm"><div className="rounded-md bg-muted/60 px-3 py-2"><div className="text-xs text-muted-foreground">Besteed</div><div className="font-semibold">{cents(campaign.spentCents || 0)} <span className="font-normal text-xs text-muted-foreground">/ {cents(campaign.budgetCents || 0)}</span></div></div><div className="rounded-md bg-muted/60 px-3 py-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />Impressies</div><div className="font-semibold">{(campaign.impressions || 0).toLocaleString("nl-NL")}</div></div><div className="rounded-md bg-muted/60 px-3 py-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><MousePointerClick className="h-3 w-3" />Kliks</div><div className="font-semibold">{(campaign.clicks || 0).toLocaleString("nl-NL")}</div></div><div className="rounded-md bg-muted/60 px-3 py-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><XCircle className="h-3 w-3" />Sluitingen</div><div className="font-semibold">{(campaign.closes || 0).toLocaleString("nl-NL")}</div></div></div></div><div>{campaign.status === "active" ? <Button variant="outline" size="sm" onClick={() => changeStatus.mutate({ id: campaign.id, status: "paused" })}><Pause className="h-4 w-4 mr-1" />Pauzeren</Button> : campaign.status === "paused" ? <Button variant="outline" size="sm" onClick={() => changeStatus.mutate({ id: campaign.id, status: "active" })}><Play className="h-4 w-4 mr-1" />Hervatten</Button> : null}</div></div></CardContent></Card>)}</div> : <Card><CardContent className="py-14 text-center"><Megaphone className="h-14 w-14 mx-auto mb-4 text-muted-foreground/30" /><h2 className="font-semibold text-lg">Nog geen campagnes</h2><p className="text-muted-foreground mt-1 mb-4">Maak advertentiemateriaal en start je eerste campagne.</p><Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Campagne maken</Button></CardContent></Card>}
    </div></main>
  </div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }