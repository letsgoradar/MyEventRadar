import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, AlertCircle, ArrowRight } from "lucide-react";

export default function AdvertiserVerify() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");

  const states: Record<string, { icon: any; title: string; description: string; color: string }> = {
    success: {
      icon: CheckCircle2,
      title: "E-mail geverifieerd!",
      description: "Je bedrijfsaccount is nu actief. Je kunt nu events promoten en advertenties plaatsen.",
      color: "text-green-500",
    },
    expired: {
      icon: Clock,
      title: "Link verlopen",
      description: "De verificatie-link is verlopen. Log in en vraag een nieuwe verificatie-e-mail aan via je dashboard.",
      color: "text-amber-500",
    },
    invalid: {
      icon: XCircle,
      title: "Ongeldige link",
      description: "Deze verificatie-link is ongeldig of al gebruikt. Controleer je e-mail voor de juiste link.",
      color: "text-red-500",
    },
    already: {
      icon: CheckCircle2,
      title: "Al geverifieerd",
      description: "Je e-mailadres is al geverifieerd. Je kunt direct naar je dashboard.",
      color: "text-blue-500",
    },
    error: {
      icon: AlertCircle,
      title: "Er ging iets mis",
      description: "Er is een fout opgetreden bij de verificatie. Probeer het later opnieuw.",
      color: "text-red-500",
    },
  };

  const state = states[status || "error"] || states.error;
  const Icon = state.icon;

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Icon className={`h-16 w-16 mx-auto mb-2 ${state.color}`} />
          <CardTitle className="text-2xl">{state.title}</CardTitle>
          <CardDescription className="text-base mt-2">
            {state.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          {status === "success" || status === "already" ? (
            <Button onClick={() => setLocation("/advertiser/dashboard")}>
              Naar dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button onClick={() => setLocation("/advertiser/dashboard")}>
                Naar dashboard
              </Button>
              <Button variant="outline" onClick={() => setLocation("/")}>
                Naar home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
