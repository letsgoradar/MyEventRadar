import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  CreditCard, Wallet, TrendingUp, ShieldCheck, Plus, Loader2, Settings, ArrowRight,
} from "lucide-react";
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
    balanceCents: number;
    currentMonthSpendCents: number;
    monthlyBudgetCapCents: number | null;
    stripeCustomerId: string | null;
  };
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default function AdvertiserBilling() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showTopUp, setShowTopUp] = useState(false);
  const [showBudgetCap, setShowBudgetCap] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("10");
  const [budgetCapAmount, setBudgetCapAmount] = useState("");

  const { data: balanceData, isLoading: balanceLoading } = useQuery<BalanceData>({
    queryKey: ["/api/advertiser/balance"],
    enabled: !!user,
  });

  const { data: profileData } = useQuery<ProfileData>({
    queryKey: ["/api/advertiser/profile"],
    enabled: !!user,
  });

  const topUpMutation = useMutation({
    mutationFn: async (amountCents: number) => {
      return await apiRequest("/api/advertiser/top-up", {
        method: "POST",
        data: { amountCents },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/balance"] });
      setShowTopUp(false);
      toast({
        title: "Opwaardering aangevraagd",
        description: "Je saldo wordt bijgewerkt na succesvolle betaling.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const budgetCapMutation = useMutation({
    mutationFn: async (monthlyBudgetCapCents: number | null) => {
      return await apiRequest("/api/advertiser/budget-cap", {
        method: "PATCH",
        data: { monthlyBudgetCapCents },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/profile"] });
      setShowBudgetCap(false);
      toast({ title: "Budget cap bijgewerkt" });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const setupPaymentMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/advertiser/setup-payment", {
        method: "POST",
      });
    },
    onSuccess: () => {
      toast({
        title: "Betaalmethode instellen",
        description: "Betaalmethode wordt gekoppeld.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Fout", description: error.message, variant: "destructive" });
    },
  });

  const budgetUsagePercent = balanceData?.monthlyBudgetCapCents
    ? Math.min(100, Math.round((balanceData.currentMonthSpendCents / balanceData.monthlyBudgetCapCents) * 100))
    : null;

  return (
    <div className="h-screen flex bg-background">
      <AdvertiserSidebar />
      <main className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <CreditCard className="h-8 w-8 text-primary" />
              Saldo & Facturatie
            </h1>
            <p className="text-muted-foreground">Beheer je saldo, budget en betalingen</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                  <Wallet className="h-5 w-5" />
                  Huidig saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                  {balanceLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    formatCents(balanceData?.balanceCents || 0)
                  )}
                </div>
                <p className="text-sm text-green-600/80 dark:text-green-400/80 mt-1">
                  Beschikbaar voor advertenties
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-blue-700 dark:text-blue-300">
                  <TrendingUp className="h-5 w-5" />
                  Besteed deze maand
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCents(balanceData?.currentMonthSpendCents || 0)}
                </div>
                {budgetUsagePercent !== null && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs text-blue-600/80 dark:text-blue-400/80 mb-1">
                      <span>{budgetUsagePercent}% van budget</span>
                      <span>{formatCents(balanceData?.monthlyBudgetCapCents || 0)}</span>
                    </div>
                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                      <div
                        className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all"
                        style={{ width: `${budgetUsagePercent}%` }}
                      />
                    </div>
                  </div>
                )}
                {budgetUsagePercent === null && (
                  <p className="text-sm text-blue-600/80 dark:text-blue-400/80 mt-1">Geen budget limiet</p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-300">
                  <ShieldCheck className="h-5 w-5" />
                  Betaalmethode
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  {profileData?.profile?.stripeCustomerId ? "Gekoppeld" : "Niet gekoppeld"}
                </div>
                <p className="text-sm text-purple-600/80 dark:text-purple-400/80 mt-1">
                  {profileData?.profile?.stripeCustomerId
                    ? "Stripe account actief"
                    : "Koppel een betaalmethode"}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Saldo aanvullen
                </CardTitle>
                <CardDescription>
                  Vul je saldo aan om advertenties te kunnen draaien.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[10, 25, 50, 100, 200, 500].map((amount) => (
                    <Button
                      key={amount}
                      variant={topUpAmount === String(amount) ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setTopUpAmount(String(amount))}
                    >
                      {formatCents(amount * 100)}
                    </Button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-muted-foreground">€</span>
                    <Input
                      type="number"
                      className="pl-7"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      min="10"
                      step="1"
                    />
                  </div>
                  <Button
                    onClick={() => {
                      const cents = Math.round(parseFloat(topUpAmount) * 100);
                      if (cents >= 1000) {
                        topUpMutation.mutate(cents);
                      } else {
                        toast({
                          title: "Minimum bedrag",
                          description: "Het minimale opwaardeer bedrag is €10.",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={topUpMutation.isPending}
                  >
                    {topUpMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Opwaarderen</>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Minimum opwaardering: €10,00
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Maandbudget cap
                </CardTitle>
                <CardDescription>
                  Stel een maximumbedrag in dat per maand aan advertenties wordt besteed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Huidige cap</span>
                      <span className="text-lg font-bold">
                        {balanceData?.monthlyBudgetCapCents
                          ? formatCents(balanceData.monthlyBudgetCapCents)
                          : "Geen limiet"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-2.5 text-muted-foreground">€</span>
                      <Input
                        type="number"
                        className="pl-7"
                        placeholder="Bijv. 100"
                        value={budgetCapAmount}
                        onChange={(e) => setBudgetCapAmount(e.target.value)}
                        min="0"
                        step="1"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        const cents = budgetCapAmount
                          ? Math.round(parseFloat(budgetCapAmount) * 100)
                          : null;
                        budgetCapMutation.mutate(cents);
                      }}
                      disabled={budgetCapMutation.isPending}
                      variant="outline"
                    >
                      {budgetCapMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Opslaan"
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Laat leeg om de limiet te verwijderen. Wanneer het maximum is bereikt, worden je advertenties automatisch gepauzeerd.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {!profileData?.profile?.stripeCustomerId && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Betaalmethode koppelen
                </CardTitle>
                <CardDescription>
                  Koppel een betaalmethode (creditcard of SEPA automatische incasso) voor eenvoudige betalingen.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => setupPaymentMutation.mutate()}
                  disabled={setupPaymentMutation.isPending}
                >
                  {setupPaymentMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Instellen...</>
                  ) : (
                    <>Betaalmethode instellen <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
