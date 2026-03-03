import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { RADIUS_OPTIONS } from "@shared/schema";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  ImagePlus, Plus, Loader2, Eye, MousePointerClick, Pause, Play, TrendingUp,
} from "lucide-react";
import AdvertiserSidebar from "@/components/Advertiser/Sidebar";

interface PricingItem {
  radiusKm: number;
  cpmCents: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

const createAdSchema = z.object({
  title: z.string().min(2, "Titel is verplicht").max(60, "Max 60 tekens"),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  ctaUrl: z.string().url("Voer een geldige URL in"),
  ctaText: z.string().max(30).optional(),
  targetRadiusKm: z.number(),
});

type CreateAdForm = z.infer<typeof createAdSchema>;

export default function AdvertiserAds() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);

  const { data: adsData, isLoading } = useQuery<{ ads: any[] }>({
    queryKey: ["/api/advertiser/my-ads"],
    enabled: !!user,
  });

  const { data: pricing } = useQuery<PricingItem[]>({
    queryKey: ["/api/advertiser/ads/pricing"],
  });

  const form = useForm<CreateAdForm>({
    resolver: zodResolver(createAdSchema),
    defaultValues: {
      title: "",
      description: "",
      imageUrl: "",
      ctaUrl: "",
      ctaText: "Meer info",
      targetRadiusKm: 10,
    },
  });

  const selectedRadius = form.watch("targetRadiusKm");
  const selectedPrice = pricing?.find((p) => p.radiusKm === selectedRadius);

  const createMutation = useMutation({
    mutationFn: async (data: CreateAdForm) => {
      return await apiRequest("/api/advertiser/create-ad", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/my-ads"] });
      setShowCreate(false);
      form.reset();
      toast({ title: "Advertentie aangemaakt", description: "Je advertentie is ingediend ter goedkeuring." });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest(`/api/advertiser/my-ads/${id}/status`, {
        method: "PATCH",
        data: { status },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/my-ads"] });
      toast({ title: "Status bijgewerkt" });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const statusLabels: Record<string, string> = {
    draft: "Concept",
    pending: "In afwachting",
    active: "Actief",
    paused: "Gepauzeerd",
    exhausted: "Budget op",
  };

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-800",
    pending: "bg-amber-100 text-amber-800",
    active: "bg-green-100 text-green-800",
    paused: "bg-blue-100 text-blue-800",
    exhausted: "bg-red-100 text-red-800",
  };

  return (
    <div className="h-screen flex bg-background">
      <AdvertiserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <ImagePlus className="h-8 w-8 text-primary" />
                Bedrijfsadvertenties
              </h1>
              <p className="text-muted-foreground">Beheer je advertenties (CPM-model)</p>
            </div>
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" /> Nieuwe advertentie
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nieuwe advertentie</DialogTitle>
                  <DialogDescription>
                    Maak een bedrijfsadvertentie aan. Deze wordt getoond aan gebruikers binnen je gekozen radius.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Titel *</FormLabel>
                          <FormControl>
                            <Input placeholder="Advertentie titel" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Beschrijving</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Korte beschrijving..." rows={2} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ctaUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link (CTA URL) *</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.voorbeeld.nl" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="ctaText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Knop tekst</FormLabel>
                          <FormControl>
                            <Input placeholder="Meer info" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="imageUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Afbeelding URL</FormLabel>
                          <FormControl>
                            <Input placeholder="https://..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetRadiusKm"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Doelradius *</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(parseInt(v))}
                            defaultValue={String(field.value)}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {RADIUS_OPTIONS.map((r) => {
                                const price = pricing?.find((p) => p.radiusKm === r);
                                return (
                                  <SelectItem key={r} value={String(r)}>
                                    {r} km {price ? `— ${formatCents(price.cpmCents)} per 1000 impressies` : ""}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Grotere radius = meer bereik, hogere CPM.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedPrice && (
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">CPM prijs ({selectedRadius} km)</span>
                          <span className="text-lg font-bold text-primary">
                            {formatCents(selectedPrice.cpmCents)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Per 1.000 vertoningen. Kosten worden van je saldo afgeschreven.
                        </p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                      {createMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aanmaken...</>
                      ) : (
                        "Advertentie aanmaken"
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : adsData?.ads && adsData.ads.length > 0 ? (
            <div className="space-y-4">
              {adsData.ads.map((ad: any) => {
                const ctr = ad.impressions > 0 ? ((ad.clicks / ad.impressions) * 100).toFixed(2) : "0.00";
                return (
                  <Card key={ad.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{ad.title}</h3>
                            <Badge className={statusColors[ad.status] || ""}>
                              {statusLabels[ad.status] || ad.status}
                            </Badge>
                          </div>
                          {ad.description && (
                            <p className="text-sm text-muted-foreground mb-3">{ad.description}</p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="flex items-center gap-2 text-sm">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <span>{ad.impressions.toLocaleString("nl-NL")} impressies</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                              <span>{ad.clicks.toLocaleString("nl-NL")} kliks</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <TrendingUp className="h-4 w-4 text-muted-foreground" />
                              <span>{ctr}% CTR</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Besteed:</span>{" "}
                              <span className="font-medium">{formatCents(ad.totalSpendCents)}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Radius:</span>{" "}
                              <span className="font-medium">{ad.targetRadiusKm} km</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {ad.status === "active" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => statusMutation.mutate({ id: ad.id, status: "paused" })}
                              disabled={statusMutation.isPending}
                            >
                              <Pause className="h-4 w-4 mr-1" /> Pauzeren
                            </Button>
                          )}
                          {ad.status === "paused" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => statusMutation.mutate({ id: ad.id, status: "active" })}
                              disabled={statusMutation.isPending}
                            >
                              <Play className="h-4 w-4 mr-1" /> Hervatten
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <ImagePlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-2">Nog geen advertenties</h3>
                <p className="text-muted-foreground mb-4">
                  Maak je eerste bedrijfsadvertentie aan om zichtbaar te worden bij gebruikers in de buurt.
                </p>
                <Button onClick={() => setShowCreate(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Eerste advertentie aanmaken
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
