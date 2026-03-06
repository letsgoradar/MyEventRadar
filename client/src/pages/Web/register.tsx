import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import { Loader2, AlertCircle, Mail, CheckCircle2, Check, X } from "lucide-react";
import { RadarLogoWithText } from "@/components/RadarLogo";
import { Link } from "wouter";

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-teal-600" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
      <span>{label}</span>
    </div>
  );
}

function checkPassword(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

export default function WebRegisterPage() {
  const [, setLocation] = useLocation();
  const { user, registerMutation } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);

  const { data: googleStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  const urlParams = new URLSearchParams(window.location.search);
  const returnTo = urlParams.get("returnTo") || "/web";

  if (user) {
    setLocation(returnTo);
    return null;
  }

  const pwChecks = checkPassword(password);
  const passwordValid = Object.values(pwChecks).every(Boolean);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!passwordValid) {
      setValidationError("Wachtwoord voldoet niet aan de eisen");
      setShowPasswordHints(true);
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Wachtwoorden komen niet overeen");
      return;
    }

    registerMutation.mutate(
      { username, email, password, role: "user" },
      {
        onSuccess: (data: any) => {
          if (data?.requiresVerification) {
            setRegistered(true);
          } else {
            setLocation(returnTo);
          }
        }
      }
    );
  };

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <Link href="/">
              <RadarLogoWithText height={52} className="mx-auto mb-4 cursor-pointer" />
            </Link>
          </div>
          <Card>
            <CardContent className="pt-8 pb-8 space-y-5 text-center">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-teal-50 flex items-center justify-center">
                  <Mail className="h-8 w-8 text-teal-600" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Check je e-mail</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We hebben een bevestigingsmail gestuurd naar <strong>{email}</strong>.
                  Klik op de link in de mail om je account te activeren en direct in te loggen.
                </p>
              </div>
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 text-left">
                <CheckCircle2 className="h-4 w-4 text-teal-500 flex-shrink-0 mt-0.5" />
                <span>Geen mail ontvangen? Check je spam-map of vraag een nieuwe mail aan via de loginpagina.</span>
              </div>
              <Link href={`/web/login?returnTo=${encodeURIComponent(returnTo)}`}>
                <Button variant="outline" className="w-full">Naar inloggen</Button>
              </Link>
            </CardContent>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="hover:underline">← Terug naar de kaart</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link href="/">
            <RadarLogoWithText height={52} className="mx-auto mb-4 cursor-pointer" />
          </Link>
          <h1 className="text-2xl font-bold">Account aanmaken</h1>
          <p className="text-muted-foreground mt-1">
            Maak een gratis account aan om evenementen te ontdekken
          </p>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {googleStatus?.enabled && (
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11"
                onClick={handleGoogleLogin}
              >
                <FaGoogle className="h-4 w-4" />
                <span>Registreren met Google</span>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-2 h-11 opacity-50 cursor-not-allowed"
              disabled
            >
              <FaApple className="h-4 w-4" />
              <span>Registreren met Apple</span>
              <span className="text-xs text-muted-foreground ml-1">(binnenkort)</span>
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-muted-foreground text-sm">of met e-mail</span>
              </div>
            </div>

            {(validationError || registerMutation.error) && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{validationError || registerMutation.error?.message}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Gebruikersnaam</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="jouw naam"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mailadres</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Wachtwoord</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimaal 8 tekens"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value.length > 0) setShowPasswordHints(true);
                  }}
                  required
                />
                {showPasswordHints && (
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <PasswordRequirement met={pwChecks.length} label="Minimaal 8 tekens" />
                    <PasswordRequirement met={pwChecks.upper} label="1 hoofdletter (A-Z)" />
                    <PasswordRequirement met={pwChecks.lower} label="1 kleine letter (a-z)" />
                    <PasswordRequirement met={pwChecks.digit} label="1 cijfer (0-9)" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Wachtwoord bevestigen</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Herhaal je wachtwoord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1.5 text-xs ${password === confirmPassword ? "text-teal-600" : "text-destructive"}`}>
                    {password === confirmPassword
                      ? <><Check className="h-3 w-3" /> Wachtwoorden komen overeen</>
                      : <><X className="h-3 w-3" /> Wachtwoorden komen niet overeen</>
                    }
                  </div>
                )}
              </div>
              <Button
                type="submit"
                className="w-full h-11"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Account aanmaken...
                  </>
                ) : (
                  "Account aanmaken"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Heb je al een account? </span>
            <Link href={`/web/login?returnTo=${encodeURIComponent(returnTo)}`} className="text-primary hover:underline font-medium">
              Inloggen
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
