import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Mail, Eye, EyeOff, Loader2, AlertCircle } from "lucide-react";
import { RadarLogoWithText } from "@/components/RadarLogo";
import { Link } from "wouter";

export default function WebLoginPage() {
  const [, setLocation] = useLocation();
  const { user, loginMutation } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const { data: googleStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  const urlParams = new URLSearchParams(window.location.search);
  const errorParam = urlParams.get("error");
  const returnTo = urlParams.get("returnTo") || "/web";

  if (user) {
    setLocation(returnTo);
    return null;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { email, password },
      { onSuccess: () => setLocation(returnTo) }
    );
  };

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/">
            <RadarLogoWithText className="h-10 mx-auto mb-4 cursor-pointer" />
          </Link>
          <h1 className="text-2xl font-bold">Welkom terug</h1>
          <p className="text-muted-foreground mt-1">
            Log in om evenementen te ontdekken en te beheren
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {errorParam && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>
                  {errorParam === "google_failed"
                    ? "Google login is mislukt. Probeer het opnieuw."
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
