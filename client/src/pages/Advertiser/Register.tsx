import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BUSINESS_CATEGORIES } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, Loader2, Mail, MapPin, ChevronDown } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  museum: "Museum", dierentuin: "Dierentuin", brouwerij: "Brouwerij", pretpark: "Pretpark",
  horeca: "Horeca", theater: "Theater", bioscoop: "Bioscoop", sportlocatie: "Sportlocatie", overig: "Overig",
};
const registerSchema = z.object({
  companyName: z.string().trim().min(2, "Organisatienaam is verplicht"),
  verificationEmail: z.string().trim().email("Voer een geldig verificatie-e-mailadres in"),
  description: z.string().optional(), websiteUrl: z.string().url("Voer een geldig URL in").optional().or(z.literal("")),
  address: z.string().optional(), businessCategory: z.enum(BUSINESS_CATEGORIES), phone: z.string().optional(),
});
type RegisterForm = z.infer<typeof registerSchema>;
type ProfileResponse = { profile?: { status: string; emailVerified?: boolean | null; companyName?: string; verificationEmail?: string } };

const cleanPayload = (data: RegisterForm) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => typeof value === "string" && value.trim() !== ""));

export default function AdvertiserRegister() {
  const { user, isLoading: authLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showOptional, setShowOptional] = useState(false);
  const inviteToken = new URLSearchParams(location.split("?")[1] || "").get("invite") || "";
  const inviteReturnTo = `/advertiser/register?invite=${encodeURIComponent(inviteToken)}`;
  const { data: invitation, error: invitationError, isLoading: invitationLoading } = useQuery<{
    organizationName: string;
    email: string;
  }>({
    queryKey: [`/api/promoter-invitations/accept?token=${encodeURIComponent(inviteToken)}`],
    enabled: !!inviteToken,
    retry: false,
  });
  const { data: profileData, isLoading: profileLoading } = useQuery<ProfileResponse>({
    queryKey: ["/api/advertiser/profile"], enabled: !!user, retry: false,
  });
  const profile = profileData?.profile;
  useEffect(() => {
    if (profile?.status === "active" && profile.emailVerified === true) setLocation("/advertiser/dashboard");
  }, [profile?.status, profile?.emailVerified, setLocation]);
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { companyName: "", verificationEmail: "", description: "", websiteUrl: "", address: "", businessCategory: "overig", phone: "" },
  });
  const resendMutation = useMutation({
    mutationFn: () => apiRequest("/api/advertiser/resend-verification", { method: "POST" }),
    onSuccess: () => toast({ title: "Verificatie-e-mail opnieuw verzonden" }),
    onError: (error: Error) => toast({ title: "Verzenden mislukt", description: error.message, variant: "destructive" }),
  });
  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) => apiRequest("/api/advertiser/register", { method: "POST", data: cleanPayload(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/profile"] });
      toast({ title: "Registratie ontvangen", description: "Controleer je verificatie-e-mail." });
    },
    onError: (error: Error) => toast({ title: "Registratie mislukt", description: error.message, variant: "destructive" }),
  });
  const acceptInvitationMutation = useMutation({
    mutationFn: () => apiRequest("/api/promoter-invitations/accept", { method: "POST", data: { token: inviteToken } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/profile"] });
      toast({ title: "Promotoraccount gekoppeld" });
      setLocation("/advertiser/dashboard");
    },
    onError: (error: Error) => toast({ title: "Koppelen mislukt", description: error.message, variant: "destructive" }),
  });

  if (authLoading || invitationLoading || (user && profileLoading)) return <div className="min-h-[100dvh] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (inviteToken && invitationError) return <StatusCard title="Uitnodiging niet geldig" description="Deze uitnodiging is verlopen, ingetrokken of al gebruikt. Vraag de beheerder om een nieuwe uitnodiging." />;
  if (!user) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md"><CardHeader className="text-center"><Building2 className="h-12 w-12 mx-auto text-primary mb-2" /><CardTitle>Promotoraccount nodig</CardTitle><CardDescription>Log in of maak eerst een account aan. Daarna kun je hier je organisatie registreren.</CardDescription></CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3 justify-center"><Button asChild><Link href={`/app/login?returnTo=${encodeURIComponent(inviteToken ? inviteReturnTo : "/advertiser/register")}`}>Inloggen</Link></Button><Button variant="outline" asChild><Link href={`/app/register?returnTo=${encodeURIComponent(inviteToken ? inviteReturnTo : "/advertiser/register")}`}>Account maken</Link></Button></CardContent>
      </Card>
    </div>
  );

  if (profile?.status === "active" && profile.emailVerified === true) return null;
  if (profile?.status === "suspended") return <StatusCard title="Promotoraccount opgeschort" description="Je promotoraccount is tijdelijk opgeschort. Neem contact op met support als je denkt dat dit niet klopt." />;
  if (profile && (profile.status === "pending" || profile.emailVerified !== true)) return <StatusCard title="Verificatie in behandeling" description={`We wachten op verificatie van ${profile.verificationEmail || "je e-mailadres"}. Controleer je inbox en spamfolder.`} resend />;
  if (invitation) return (
    <div className="min-h-[100dvh] overflow-y-auto bg-muted/40 px-4 py-8 sm:py-12">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="text-center"><Mail className="mx-auto mb-2 h-12 w-12 text-primary" /><CardTitle>Uitnodiging accepteren</CardTitle><CardDescription>Koppel {invitation.organizationName} aan je account. Alleen het uitgenodigde e-mailadres kan deze uitnodiging gebruiken.</CardDescription></CardHeader>
        <CardContent className="space-y-4"><div className="rounded-lg bg-muted p-4 text-sm"><div className="font-medium">{invitation.organizationName}</div><div className="text-muted-foreground">{invitation.email}</div></div><Button className="w-full" onClick={() => acceptInvitationMutation.mutate()} disabled={acceptInvitationMutation.isPending}>{acceptInvitationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Promotoraccount koppelen</Button></CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-muted/40 py-8 sm:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8"><Building2 className="h-12 w-12 mx-auto text-primary mb-4" /><h1 className="text-3xl font-bold">Promotor worden</h1><p className="text-muted-foreground mt-2">Maak één account voor algemene advertenties en eventcampagnes.</p></div>
        <Card><CardHeader><CardTitle>Organisatie registreren</CardTitle><CardDescription>Alleen je organisatienaam en verificatie-e-mail zijn nodig om te beginnen.</CardDescription></CardHeader><CardContent>
          <Form {...form}><form onSubmit={form.handleSubmit((data) => registerMutation.mutate(data))} className="space-y-5">
            <FormField control={form.control} name="companyName" render={({ field }) => <FormItem><FormLabel>Organisatienaam *</FormLabel><FormControl><Input placeholder="Bijv. Stadsmuseum Utrecht" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="verificationEmail" render={({ field }) => <FormItem><FormLabel>Verificatie-e-mail *</FormLabel><FormControl><Input type="email" placeholder="beheer@organisatie.nl" {...field} /></FormControl><FormDescription>We sturen alleen hiernaartoe een verificatielink.</FormDescription><FormMessage /></FormItem>} />
            <FormField control={form.control} name="businessCategory" render={({ field }) => <FormItem><FormLabel>Categorie</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{BUSINESS_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat] || cat}</SelectItem>)}</SelectContent></Select><FormDescription>Standaard ingesteld op Overig; pas dit alleen aan als dat nuttig is.</FormDescription><FormMessage /></FormItem>} />
            <button type="button" className="flex w-full items-center justify-between border-t pt-4 text-sm font-medium" onClick={() => setShowOptional(!showOptional)}>Meer gegevens (optioneel)<ChevronDown className={`h-4 w-4 transition-transform ${showOptional ? "rotate-180" : ""}`} /></button>
            {showOptional && <div className="space-y-5 rounded-lg bg-muted/40 p-4"><p className="text-sm text-muted-foreground">Deze velden helpen later bij je profiel en campagnes. Je kunt ze nu leeg laten; lege waarden worden niet opgeslagen.</p>
              <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Beschrijving</FormLabel><FormControl><Textarea rows={3} placeholder="Wat doet je organisatie?" {...field} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="websiteUrl" render={({ field }) => <FormItem><FormLabel>Website</FormLabel><FormControl><Input placeholder="https://organisatie.nl" {...field} /></FormControl><FormMessage /></FormItem>} />
              <div className="grid sm:grid-cols-2 gap-4"><FormField control={form.control} name="phone" render={({ field }) => <FormItem><FormLabel>Telefoonnummer</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} /><FormField control={form.control} name="address" render={({ field }) => <FormItem><FormLabel>Adres</FormLabel><FormControl><div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input className="pl-10" placeholder="Straat, postcode, plaats" {...field} /></div></FormControl><FormMessage /></FormItem>} /></div>
            </div>}
            <Button type="submit" className="w-full" disabled={registerMutation.isPending}>{registerMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registreren...</> : <>Promotoraccount registreren<ArrowRight className="ml-2 h-4 w-4" /></>}</Button>
          </form></Form>
        </CardContent></Card>
      </div>
    </div>
  );
}

function StatusCard({ title, description, resend = false }: { title: string; description: string; resend?: boolean }) {
  const { toast } = useToast();
  const resendMutation = useMutation({ mutationFn: () => apiRequest("/api/advertiser/resend-verification", { method: "POST" }), onSuccess: () => toast({ title: "Verificatie-e-mail opnieuw verzonden" }) });
  return <div className="min-h-[100dvh] flex items-center justify-center bg-muted/40 p-4"><Card className="w-full max-w-md"><CardHeader className="text-center"><Mail className="h-12 w-12 mx-auto text-primary mb-2" /><Badge variant="secondary" className="mx-auto">Promotoraccount</Badge><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="flex justify-center gap-3">{resend && <Button onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}>{resendMutation.isPending ? "Verzenden..." : "Opnieuw verzenden"}</Button>}<Button variant="outline" asChild><Link href="/adverteren">Terug naar overzicht</Link></Button></CardContent></Card></div>;
}