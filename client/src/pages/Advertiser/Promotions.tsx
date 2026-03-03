import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { RADIUS_OPTIONS } from "@shared/schema";
import { Link } from "wouter";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Megaphone, Plus, Loader2, Eye, MousePointerClick, Calendar, Clock,
  MapPin, ArrowRight, Search,
} from "lucide-react";
import AdvertiserSidebar from "@/components/Advertiser/Sidebar";

interface PricingItem {
  id: number;
  radiusKm: number;
  period: string;
  priceCents: number;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

const PERIOD_LABELS: Record<string, string> = {
  day: "1 dag",
  week: "1 week",
  month: "1 maand",
};

const purchaseSchema = z.object({
  eventId: z.number({ required_error: "Selecteer een event" }),
  period: z.enum(["day", "week", "month"], { required_error: "Kies een periode" }),
  radiusKm: z.number({ required_error: "Kies een radius" }),
});

type PurchaseForm = z.infer<typeof purchaseSchema>;

export default function AdvertiserPromotions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPurchase, setShowPurchase] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const { data: promotionsData, isLoading } = useQuery<{
    promotions: Array<{
      promotion: any;
      event: any;
    }>;
  }>({
    queryKey: ["/api/advertiser/my-promotions"],
    enabled: !!user,
  });

  const { data: pricingData } = useQuery<PricingItem[]>({
    queryKey: ["/api/promotions/pricing"],
  });

  const { data: profileData } = useQuery<{ profile: { emailVerified: boolean; status: string } }>({
    queryKey: ["/api/advertiser/profile"],
    enabled: !!user,
  });

  const { data: searchResults, isLoading: isSearching } = useQuery<any[]>({
    queryKey: ["/api/advertiser/events/search", searchQuery],
    enabled: searchQuery.length >= 2,
    queryFn: () => fetch(`/api/advertiser/events/search?q=${encodeURIComponent(searchQuery)}`).then(r => r.json()),
  });

  const isVerified = profileData?.profile?.emailVerified !== false;

  const form = useForm<PurchaseForm>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      eventId: undefined,
      period: "week",
      radiusKm: 10,
    },
  });

  const selectedPeriod = form.watch("period");
  const selectedRadius = form.watch("radiusKm");
  const selectedPrice = pricingData?.find(
    (p) => p.radiusKm === selectedRadius && p.period === selectedPeriod
  );

  const purchaseMutation = useMutation({
    mutationFn: async (data: PurchaseForm) => {
      return await apiRequest("/api/promotions/purchase", {
        method: "POST",
        data,
      });
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/my-promotions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/balance"] });
      setShowPurchase(false);
      setSelectedEvent(null);
      setSearchQuery("");
      form.reset({ eventId: undefined, period: "week", radiusKm: 10 });
      if (result.paymentRequired) {
        toast({
          title: "Betaling vereist",
          description: "Voltooi de betaling via Stripe om je promotie te activeren.",
        });
      } else {
        toast({
          title: "Promotie geactiveerd!",
          description: "Je event wordt nu gepromoot.",
        });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const statusLabels: Record<string, string> = {
    active: "Actief",
    expired: "Verlopen",
    cancelled: "Geannuleerd",
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    expired: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="h-screen flex bg-background">
      <AdvertiserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Megaphone className="h-8 w-8 text-primary" />
                Event Promoties
              </h1>
              <p className="text-muted-foreground">
                Promoot events bovenaan de zoekresultaten
              </p>
            </div>

            {profileData?.profile && !profileData.profile.emailVerified && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300 rounded-lg p-4 flex items-center gap-3 mr-4">
                <Megaphone className="h-5 w-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">Verifieer eerst je bedrijfs e-mail om events te promoten.</p>
                  <Link href="/advertiser/dashboard" className="text-sm underline flex items-center gap-1 mt-1">
                    Ga naar dashboard <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

            <Dialog open={showPurchase} onOpenChange={(open) => {
              setShowPurchase(open);
              if (!open) {
                setSelectedEvent(null);
                setSearchQuery("");
              }
            }}>
              <DialogTrigger asChild>
                <Button disabled={!isVerified}>
                  <Plus className="mr-2 h-4 w-4" /> Event promoten
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Event promoten</DialogTitle>
                  <DialogDescription>
                    Kies een event, periode en radius. Je event verschijnt als "Gepromoot" bovenaan zoekresultaten.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit((data) => purchaseMutation.mutate(data))}
                    className="space-y-4"
                  >
                    <FormItem>
                      <FormLabel>Event *</FormLabel>
                      {selectedEvent === null ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-9"
                              placeholder="Zoek op eventnaam of locatie..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                          </div>
                          {searchQuery.length >= 2 && (
                            <div className="max-h-48 overflow-y-auto border rounded-md">
                              {isSearching ? (
                                <div className="flex justify-center py-4">
                                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : searchResults && searchResults.length > 0 ? (
                                searchResults.map((event: any) => (
                                  <div
                                    key={event.id}
                                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                                    onClick={() => {
                                      setSelectedEvent(event);
                                      form.setValue("eventId", event.id);
                                    }}
                                  >
                                    <div className="font-medium text-sm">{event.title}</div>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                      {event.startTime && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="h-3 w-3" />
                                          {formatDate(event.startTime)}
                                        </span>
                                      )}
                                      {event.address && (
                                        <span className="flex items-center gap-1">
                                          <MapPin className="h-3 w-3" />
                                          {event.address}
                                        </span>
                                      )}
                                      {event.category && (
                                        <Badge variant="outline" className="text-xs py-0">
                                          {event.category}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="p-4 text-center text-sm text-muted-foreground">
                                  Geen events gevonden
                                </div>
                              )}
                            </div>
                          )}
                          {form.formState.errors.eventId && (
                            <p className="text-sm font-medium text-destructive">
                              {form.formState.errors.eventId.message}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Card className="relative">
                          <CardContent className="p-3 flex items-center gap-3">
                            {selectedEvent.imageUrl && (
                              <img
                                src={selectedEvent.imageUrl}
                                alt={selectedEvent.title}
                                className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{selectedEvent.title}</div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                                {selectedEvent.startTime && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(selectedEvent.startTime)}
                                  </span>
                                )}
                                {selectedEvent.address && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {selectedEvent.address}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedEvent(null);
                                setSearchQuery("");
                              }}
                            >
                              Wijzig
                            </Button>
                          </CardContent>
                        </Card>
                      )}
                    </FormItem>

                    <FormField
                      control={form.control}
                      name="period"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Periode *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="day">1 dag</SelectItem>
                              <SelectItem value="week">1 week</SelectItem>
                              <SelectItem value="month">1 maand</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="radiusKm"
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
                              {RADIUS_OPTIONS.map((r) => (
                                <SelectItem key={r} value={String(r)}>
                                  {r} km
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            Alleen gebruikers binnen deze radius zien je gepromote event.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {selectedPrice && (
                      <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">Totaalprijs</span>
                          <span className="text-xl font-bold text-primary">
                            {formatCents(selectedPrice.priceCents)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {PERIOD_LABELS[selectedPeriod]} × {selectedRadius} km radius
                        </p>
                      </div>
                    )}

                    <Button type="submit" className="w-full" disabled={purchaseMutation.isPending}>
                      {purchaseMutation.isPending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verwerken...</>
                      ) : (
                        <>Promotie kopen {selectedPrice ? `(${formatCents(selectedPrice.priceCents)})` : ""}</>
                      )}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {pricingData && pricingData.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Prijsoverzicht</CardTitle>
                <CardDescription>Prijs per periode en radius</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Radius</th>
                        <th className="text-right p-2 font-medium">1 dag</th>
                        <th className="text-right p-2 font-medium">1 week</th>
                        <th className="text-right p-2 font-medium">1 maand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {RADIUS_OPTIONS.map((r) => (
                        <tr key={r} className="border-b last:border-0">
                          <td className="p-2 font-medium">{r} km</td>
                          {(["day", "week", "month"] as const).map((period) => {
                            const price = pricingData.find(
                              (p) => p.radiusKm === r && p.period === period
                            );
                            return (
                              <td key={period} className="p-2 text-right">
                                {price ? formatCents(price.priceCents) : "-"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : promotionsData?.promotions && promotionsData.promotions.length > 0 ? (
            <div className="space-y-4">
              {promotionsData.promotions.map(({ promotion, event }) => {
                const ctr = promotion.impressions > 0
                  ? ((promotion.clicks / promotion.impressions) * 100).toFixed(2)
                  : "0.00";
                const endDate = new Date(promotion.endDate);
                const isExpired = endDate < new Date();

                return (
                  <Card key={promotion.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{event.title}</h3>
                            <Badge className={statusColors[promotion.status] || ""}>
                              {statusLabels[promotion.status] || promotion.status}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span>{PERIOD_LABELS[promotion.promotionPeriod]}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <span>{promotion.targetRadiusKm} km</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-muted-foreground" />
                              <span>{promotion.impressions.toLocaleString("nl-NL")} impressies</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                              <span>{promotion.clicks} kliks ({ctr}% CTR)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>
                                {isExpired
                                  ? "Verlopen"
                                  : `Tot ${endDate.toLocaleDateString("nl-NL")}`}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-lg font-bold">{formatCents(promotion.priceCents)}</div>
                          <div className="text-xs text-muted-foreground">Betaald</div>
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
                <Megaphone className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-medium mb-2">Nog geen promoties</h3>
                <p className="text-muted-foreground mb-4">
                  Promoot je event bovenaan de zoekresultaten van letsgo radar.
                </p>
                <Button onClick={() => setShowPurchase(true)} disabled={!isVerified}>
                  <Plus className="mr-2 h-4 w-4" /> Eerste event promoten
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
