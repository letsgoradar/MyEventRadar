import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Mail, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { RadarLogoWithText } from "@/components/RadarLogo";
import { Link } from "wouter";

export default function WebLoginPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  const { data: googleStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  const urlParams = new URLSearchParams(window.location.search);
  const errorParam = urlParams.get("error");
  const verifiedParam = urlParams.get("verified");
  const pendingParam = urlParams.get("pending");
  const returnTo = urlParams.get("returnTo") || "/web";

  if (user) {
    setLocation(returnTo);
    return null;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNotVerified(false);
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => setLocation(returnTo),
        onError: (err: any) => {
          if (err?.message === "email_not_verified") {
            setEmailNotVerified(true);
            setResendEmail(email);
          }
        }
      }
    );
  };

  const handleResendVerification = async () => {
    setResendStatus("sending");
    try {
      await apiRequest("/api/auth/resend-verification", {
        method: "POST",
        data: { email: resendEmail },
      });
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/">
            <RadarLogoWithText height={52} className="mx-auto mb-4 cursor-pointer" />
          </Link>
          <h1 className="text-2xl font-bold">Welkom terug</h1>
          <p className="text-muted-foreground mt-1">
            Log in om evenementen te ontdekken en te beheren
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {pendingParam === "true" && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-200">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  Je hebt een mail ontvangen waarmee je het account kunt bevestigen.
                  Bevestig je account en log dan in bij letsgo radar.
                </span>
              </div>
            )}

            {verifiedParam === "true" && (
              <div className="flex items-center gap-2 p-3 bg-teal-50 text-teal-700 rounded-lg text-sm border border-teal-200">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>Je e-mailadres is bevestigd. Je kunt nu inloggen.</span>
              </div>
            )}

            {errorParam && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {errorParam === "google_failed"
                    ? "Google login is mislukt. Probeer het opnieuw."
                    : errorParam === "invalid_token"
                    ? "De verificatielink is ongeldig."
                    : errorParam === "token_expired"
                    ? "De verificatielink is verlopen. Vraag een nieuwe aan."
                    : "Er is een fout opgetreden bij het inloggen."}
                </span>
              </div>
            )}

            {googleStatus?.enabled && (
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11"
                onClick={handleGoogleLogin}
              >
                <FaGoogle className="h-4 w-4" />
                <span>Doorgaan met Google</span>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2 h-11 opacity-50 cursor-not-allowed"
              disabled
            >
              <FaApple className="h-4 w-4" />
              <span>Doorgaan met Apple</span>
              <span className="text-xs text-muted-foreground ml-1">(binnenkort)</span>
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-muted-foreground text-sm">of</span>
              </div>
            </div>

            {!showEmailForm ? (
              <Button
                variant="secondary"
                className="w-full flex items-center justify-center gap-2 h-11"
                onClick={() => setShowEmailForm(true)}
              >
                <Mail className="h-4 w-4" />
                <span>Inloggen met e-mail</span>
              </Button>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-4">
                {loginMutation.error && !emailNotVerified && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{loginMutation.error.message}</span>
                  </div>
                )}

                {emailNotVerified && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm space-y-2">
                    <div className="flex items-start gap-2 text-amber-800">
                      <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>Je e-mailadres is nog niet bevestigd. Check je inbox (en spam-map).</span>
                    </div>
                    {resendStatus === "sent" ? (
                      <div className="flex items-center gap-2 text-teal-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Nieuwe verificatiemail verzonden.</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={resendStatus === "sending"}
                        className="text-amber-700 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
                      >
                        {resendStatus === "sending" ? "Versturen..." : "Verificatiemail opnieuw sturen"}
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail of gebruikersnaam</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="jouw@email.nl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Wachtwoord</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Inloggen...
                    </>
                  ) : (
                    "Inloggen"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="text-center space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Nog geen account? </span>
            <Link href={`/web/register?returnTo=${encodeURIComponent(returnTo)}`} className="text-primary hover:underline font-medium">
              Registreren
            </Link>
          </p>
          <p>
            <Link href="/app/forgot-password" className="text-muted-foreground hover:text-primary hover:underline">
              Wachtwoord vergeten?
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">← Terug naar de kaart</Link>
        </p>
      </div>
    </div>
  );
}
