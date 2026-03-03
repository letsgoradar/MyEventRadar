import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet, TrendingUp, Eye, MousePointerClick, Megaphone,
  ImagePlus, CreditCard, ArrowRight, Building2, AlertCircle,
  BarChart3, Loader2, Mail,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdvertiserSidebar from "@/components/Advertiser/Sidebar";

interface BalanceData {
  balanceCents: number;
  currentMonthSpendCents: number;
  monthlyBudgetCapCents: number | null;
}

interface ProfileData {
  profile: {
    id: number;
    companyName: string;
    status: string;
    emailVerified: boolean;
    verificationEmail: string | null;
    balanceCents: number;
    currentMonthSpendCents: number;
    monthlyBudgetCapCents: number | null;
  };
}

interface AdData {
  ads: Array<{
    id: number;
    title: string;
    status: string;
    impressions: number;
    clicks: number;
    totalSpendCents: number;
  }>;
}

interface PromotionData {
  promotions: Array<{
    promotion: {
      id: number;
      status: string;
      impressions: number;
      clicks: number;
      priceCents: number;
      promotionPeriod: string;
      endDate: string;
    };
    event: {
      id: number;
      title: string;
    };
  }>;
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export default function AdvertiserDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const resendVerificationMutation = useMutation({
    mutationFn: () => apiRequest("/api/advertiser/resend-verification", { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Verificatie-e-mail opnieuw verzonden" });
    },
    onError: () => {
      toast({ title: "Fout bij verzenden", description: "Probeer het later opnieuw.", variant: "destructive" });
    },
  });

  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileData>({
    queryKey: ["/api/advertiser/profile"],
    enabled: !!user,
  });

  const { data: balanceData } = useQuery<BalanceData>({
    queryKey: ["/api/advertiser/balance"],
    enabled: !!user,
  });

  const { data: adsData } = useQuery<AdData>({
    queryKey: ["/api/advertiser/my-ads"],
    enabled: !!user,
  });

  const { data: promotionsData } = useQuery<PromotionData>({
    queryKey: ["/api/advertiser/my-promotions"],
    enabled: !!user,
  });

  if (authLoading || profileLoading) {
    return (
      <div className="h-screen flex bg-background">
        <AdvertiserSidebar />
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    setLocation("/app/login");
    return null;
  }

  const profile = profileData?.profile;
  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-2" />
            <CardTitle>Geen adverteerdersprofiel</CardTitle>
            <CardDescription>
              Je hebt nog geen adverteerdersprofiel. Registreer je eerst als adverteerder.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setLocation("/advertiser/register")}>
              Registreren <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeAds = adsData?.ads?.filter((a) => a.status === "active").length || 0;
  const totalImpressions = adsData?.ads?.reduce((sum, a) => sum + a.impressions, 0) || 0;
  const totalClicks = adsData?.ads?.reduce((sum, a) => sum + a.clicks, 0) || 0;
  const activePromotions = promotionsData?.promotions?.filter(
    (p) => p.promotion.status === "active"
  ).length || 0;

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    suspended: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  return (
    <div className="h-screen flex bg-background">
      <AdvertiserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Building2 className="h-8 w-8 text-primary" />
                {profile.companyName}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={statusColors[profile.status] || ""}>
                  {profile.status === "active" ? "Actief" : profile.status === "pending" ? "In afwachting" : "Opgeschort"}
                </Badge>
                <span className="text-muted-foreground text-sm">Adverteerder Dashboard</span>
              </div>
            </div>
          </div>

          {(profile.status === "pending" || !profile.emailVerified) && (
            <Card className="mb-6 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
              <CardContent className="flex items-center gap-4 py-4">
                <Mail className="h-8 w-8 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1">
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">E-mail verificatie vereist</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Je bedrijfsaccount is nog niet geverifieerd. Controleer je e-mail ({profile.verificationEmail}) voor de verificatie-link.
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
                  disabled={resendVerificationMutation.isPending}
                  onClick={() => resendVerificationMutation.mutate()}
                >
                  {resendVerificationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Opnieuw verzenden
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Wallet className="h-5 w-5" />
                  Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {formatCents(balanceData?.balanceCents || profile.balanceCents)}
                </div>
                <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">Beschikbaar tegoed</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <TrendingUp className="h-5 w-5" />
                  Verbruik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCents(balanceData?.currentMonthSpendCents || profile.currentMonthSpendCents)}
                </div>
                <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">
                  Deze maand
                  {balanceData?.monthlyBudgetCapCents
                    ? ` / ${formatCents(balanceData.monthlyBudgetCapCents)}`
                    : ""}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <Eye className="h-5 w-5" />
                  Impressies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                  {totalImpressions.toLocaleString("nl-NL")}
                </div>
                <p className="text-sm text-purple-600/80 dark:text-purple-400/80 mt-1">
                  Totaal vertoningen
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <MousePointerClick className="h-5 w-5" />
                  Kliks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                  {totalClicks.toLocaleString("nl-NL")}
                </div>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Totaal kliks
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImagePlus className="h-5 w-5" />
                  Bedrijfsadvertenties
                </CardTitle>
                <CardDescription>
                  {activeAds} actieve advertentie{activeAds !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {adsData?.ads && adsData.ads.length > 0 ? (
                  <div className="space-y-3">
                    {adsData.ads.slice(0, 5).map((ad) => (
                      <div key={ad.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{ad.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{ad.impressions} impressies</span>
                            <span>{ad.clicks} kliks</span>
                            <span>{formatCents(ad.totalSpendCents)} besteed</span>
                          </div>
                        </div>
                        <Badge variant={ad.status === "active" ? "default" : "secondary"}>
                          {ad.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ImagePlus className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nog geen advertenties</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setLocation("/advertiser/ads")}
                >
                  Alle advertenties <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Megaphone className="h-5 w-5" />
                  Event Promoties
                </CardTitle>
                <CardDescription>
                  {activePromotions} actieve promotie{activePromotions !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {promotionsData?.promotions && promotionsData.promotions.length > 0 ? (
                  <div className="space-y-3">
                    {promotionsData.promotions.slice(0, 5).map((p) => (
                      <div key={p.promotion.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="font-medium text-sm">{p.event.title}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            <span>{p.promotion.impressions} impressies</span>
                            <span>{p.promotion.clicks} kliks</span>
                            <span>{formatCents(p.promotion.priceCents)}</span>
                          </div>
                        </div>
                        <Badge variant={p.promotion.status === "active" ? "default" : "secondary"}>
                          {p.promotion.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Nog geen promoties</p>
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => setLocation("/advertiser/promotions")}
                >
                  Alle promoties <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Saldo & Facturatie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {formatCents(balanceData?.balanceCents || profile.balanceCents)}
                  </div>
                  <div className="text-sm text-muted-foreground">Huidig saldo</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {formatCents(balanceData?.currentMonthSpendCents || 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Besteed deze maand</div>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">
                    {balanceData?.monthlyBudgetCapCents
                      ? formatCents(balanceData.monthlyBudgetCapCents)
                      : "Geen limiet"}
                  </div>
                  <div className="text-sm text-muted-foreground">Maandbudget cap</div>
                </div>
              </div>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setLocation("/advertiser/billing")}
              >
                Beheer facturatie <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
