import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FaGoogle, FaApple } from "react-icons/fa";
import {
  Mail, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2,
  Check, X, ArrowLeft, MailCheck, PartyPopper,
} from "lucide-react";

type AuthView = "welcome" | "login" | "register" | "verification_pending" | "verified";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialView?: "welcome" | "login" | "register";
}

function PasswordReq({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${met ? "text-teal-600" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
      <span>{label}</span>
    </div>
  );
}

function checkPw(pw: string) {
  return {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    digit: /[0-9]/.test(pw),
  };
}

export function AuthModal({ isOpen, onClose, onSuccess, initialView = "welcome" }: AuthModalProps) {
  const { loginMutation, registerMutation } = useAuth();
  const [view, setView] = useState<AuthView>(initialView);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState("");
  const [showPwHints, setShowPwHints] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [pendingEmail, setPendingEmail] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: googleStatus } = useQuery<{ enabled: boolean }>({
    queryKey: ["/api/auth/google/status"],
  });

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      setValidationError("");
      setEmailNotVerified(false);
    }
  }, [isOpen, initialView]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (view === "verification_pending" && pendingEmail) {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await apiRequest("/api/auth/check-verification", {
            method: "POST",
            data: { email: pendingEmail },
          });
          if (res.verified) {
            stopPolling();
            if (res.loggedIn) {
              await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
            }
            setView("verified");
          }
        } catch {}
      }, 3000);
    } else {
      stopPolling();
    }
    return stopPolling;
  }, [view, pendingEmail, stopPolling]);

  useEffect(() => {
    if (view === "verified") {
      const timer = setTimeout(() => {
        onSuccess();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [view, onSuccess]);

  if (!isOpen) return null;

  const pwChecks = checkPw(password);
  const passwordValid = Object.values(pwChecks).every(Boolean);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setUsername("");
    setConfirmPassword("");
    setValidationError("");
    setShowPwHints(false);
    setEmailNotVerified(false);
    setResendStatus("idle");
    setShowPassword(false);
  };

  const switchView = (v: AuthView) => {
    resetForm();
    setView(v);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNotVerified(false);
    setValidationError("");
    loginMutation.mutate(
      { email, password },
      {
        onSuccess: () => onSuccess(),
        onError: (err: any) => {
          if (err?.message === "email_not_verified") {
            setEmailNotVerified(true);
            setResendEmail(email);
          }
        },
      }
    );
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");
    if (!passwordValid) {
      setValidationError("Wachtwoord voldoet niet aan de eisen");
      setShowPwHints(true);
      return;
    }
    if (password !== confirmPassword) {
      setValidationError("Wachtwoorden komen niet overeen");
      return;
    }
    registerMutation.mutate(
      { username, email, password, role: "user" },
      {
        onSuccess: () => {
          setPendingEmail(email);
          setView("verification_pending");
        },
      }
    );
  };

  const handleResend = async (targetEmail?: string) => {
    setResendStatus("sending");
    try {
      await apiRequest("/api/auth/resend-verification", {
        method: "POST",
        data: { email: targetEmail || resendEmail },
      });
      setResendStatus("sent");
    } catch {
      setResendStatus("idle");
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(window.location.pathname)}`;
  };

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={view === "verification_pending" || view === "verified" ? undefined : onClose} />
      <div className="relative z-10 w-full max-w-sm bg-background/95 backdrop-blur-sm rounded-2xl shadow-xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">

        {/* ========== WELCOME VIEW ========== */}
        {view === "welcome" && (
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-primary">Welkom bij letsgo radar</h1>
              <p className="text-muted-foreground text-sm">Ontdek evenementen in jouw buurt</p>
              <p className="text-xs text-muted-foreground">Registreer of log in om alle details te bekijken</p>
            </div>
            <div className="space-y-3">
              {googleStatus?.enabled && (
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 h-11"
                  onClick={handleGoogleLogin}
                >
                  <FaGoogle className="h-4 w-4" />
                  Doorgaan met Google
                </Button>
              )}
              {!googleStatus?.enabled && (
                <Button
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 h-11 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <FaGoogle className="h-4 w-4" />
                  Doorgaan met Google
                  <span className="text-xs ml-1">(binnenkort)</span>
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11 opacity-50 cursor-not-allowed"
                disabled
              >
                <FaApple className="h-4 w-4" />
                Doorgaan met Apple
                <span className="text-xs ml-1">(binnenkort)</span>
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-background/95 px-3 text-muted-foreground text-sm">of</span>
                </div>
              </div>
              <Button
                className="w-full flex items-center justify-center gap-2 h-11"
                onClick={() => switchView("login")}
              >
                <Mail className="h-4 w-4" />
                Inloggen met e-mail
              </Button>
            </div>
            <div className="space-y-2 text-center text-sm">
              <p>
                <button onClick={() => switchView("register")} className="text-primary hover:underline font-medium">
                  Registreer met email
                </button>
              </p>
              <p>
                <button className="text-muted-foreground hover:text-primary hover:underline text-sm">
                  Wachtwoord vergeten?
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ========== LOGIN VIEW ========== */}
        {view === "login" && (
          <div className="space-y-4">
            <button
              onClick={() => switchView("welcome")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug
            </button>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Welkom terug</h2>
              <p className="text-muted-foreground text-sm">Log in om evenementen te ontdekken</p>
            </div>

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
                    onClick={() => handleResend()}
                    disabled={resendStatus === "sending"}
                    className="text-amber-700 underline underline-offset-2 hover:text-amber-900 disabled:opacity-50"
                  >
                    {resendStatus === "sending" ? "Versturen..." : "Verificatiemail opnieuw sturen"}
                  </button>
                )}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">E-mail of gebruikersnaam</Label>
                <Input
                  id="login-email"
                  type="text"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Wachtwoord</Label>
                <div className="relative">
                  <Input
                    id="login-password"
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
              <Button type="submit" className="w-full h-11" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Inloggen...</>
                ) : "Inloggen"}
              </Button>
            </form>
            <div className="text-center text-sm space-y-1">
              <p>
                <button onClick={() => switchView("register")} className="text-primary hover:underline font-medium">
                  Registreer met email
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ========== REGISTER VIEW ========== */}
        {view === "register" && (
          <div className="space-y-4">
            <button
              onClick={() => switchView("welcome")}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug
            </button>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold">Account aanmaken</h2>
              <p className="text-muted-foreground text-sm">Maak een gratis account aan</p>
            </div>

            {(validationError || registerMutation.error) && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{validationError || registerMutation.error?.message}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="reg-username">Gebruikersnaam</Label>
                <Input
                  id="reg-username"
                  type="text"
                  placeholder="jouw naam"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">E-mailadres</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-password">Wachtwoord</Label>
                <Input
                  id="reg-password"
                  type="password"
                  placeholder="Minimaal 8 tekens"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value.length > 0) setShowPwHints(true);
                  }}
                  required
                />
                {showPwHints && (
                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    <PasswordReq met={pwChecks.length} label="Min. 8 tekens" />
                    <PasswordReq met={pwChecks.upper} label="1 hoofdletter" />
                    <PasswordReq met={pwChecks.lower} label="1 kleine letter" />
                    <PasswordReq met={pwChecks.digit} label="1 cijfer" />
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-confirm">Wachtwoord bevestigen</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="Herhaal je wachtwoord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                {confirmPassword.length > 0 && (
                  <div className={`flex items-center gap-1.5 text-xs ${password === confirmPassword ? "text-teal-600" : "text-destructive"}`}>
                    {password === confirmPassword
                      ? <><Check className="h-3 w-3" /> Komt overeen</>
                      : <><X className="h-3 w-3" /> Komt niet overeen</>
                    }
                  </div>
                )}
              </div>
              <Button type="submit" className="w-full h-11" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Account aanmaken...</>
                ) : "Account aanmaken"}
              </Button>
            </form>
            <div className="text-center text-sm">
              <span className="text-muted-foreground">Heb je al een account? </span>
              <button onClick={() => switchView("login")} className="text-primary hover:underline font-medium">
                Inloggen
              </button>
            </div>
          </div>
        )}

        {/* ========== VERIFICATION PENDING VIEW ========== */}
        {view === "verification_pending" && (
          <div className="space-y-6 py-2">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="h-10 w-10 text-primary" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-primary/30 flex items-center justify-center">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold">Check je e-mail</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  We hebben een verificatiemail gestuurd naar
                </p>
                <p className="font-medium text-sm bg-muted/50 rounded-lg py-2 px-3 break-all">
                  {pendingEmail}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Klik op de link in de mail om je account te bevestigen. We wachten hier op je!
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span>Wachten op bevestiging...</span>
              </div>
            </div>
            <Separator />
            <div className="text-center space-y-3">
              <p className="text-xs text-muted-foreground">
                Geen mail ontvangen? Check je spam-map of verstuur opnieuw.
              </p>
              {resendStatus === "sent" ? (
                <div className="flex items-center justify-center gap-2 text-teal-700 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Nieuwe verificatiemail verzonden!</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleResend(pendingEmail)}
                  disabled={resendStatus === "sending"}
                  className="mx-auto"
                >
                  {resendStatus === "sending" ? (
                    <><Loader2 className="h-3 w-3 animate-spin mr-2" />Versturen...</>
                  ) : (
                    <><Mail className="h-3 w-3 mr-2" />Opnieuw versturen</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ========== VERIFIED VIEW ========== */}
        {view === "verified" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-teal-50 flex items-center justify-center animate-in zoom-in-50 duration-500">
                <CheckCircle2 className="h-12 w-12 text-teal-600" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <PartyPopper className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold text-teal-700">Account bevestigd!</h2>
                  <PartyPopper className="h-5 w-5 text-primary" />
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Je account is succesvol geverifieerd. Je wordt nu ingelogd en gaat terug naar waar je was gebleven.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Even geduld...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
