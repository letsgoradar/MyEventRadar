import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { BUSINESS_CATEGORIES } from "@shared/schema";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2, ArrowRight, Loader2, CheckCircle2, MapPin } from "lucide-react";
import { Link } from "wouter";

const CATEGORY_LABELS: Record<string, string> = {
  museum: "Museum",
  dierentuin: "Dierentuin",
  brouwerij: "Brouwerij",
  pretpark: "Pretpark",
  horeca: "Horeca",
  theater: "Theater",
  bioscoop: "Bioscoop",
  sportlocatie: "Sportlocatie",
  overig: "Overig",
};

const registerSchema = z.object({
  companyName: z.string().min(2, "Bedrijfsnaam is verplicht"),
  description: z.string().optional(),
  websiteUrl: z.string().url("Voer een geldig URL in").optional().or(z.literal("")),
  address: z.string().optional(),
  businessCategory: z.enum(BUSINESS_CATEGORIES, {
    required_error: "Kies een categorie",
  }),
  phone: z.string().optional(),
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function AdvertiserRegister() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [registered, setRegistered] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: "",
      description: "",
      websiteUrl: "",
      address: "",
      businessCategory: undefined,
      phone: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      return await apiRequest("/api/advertiser/register", {
        method: "POST",
        data,
      });
    },
    onSuccess: () => {
      setRegistered(true);
      queryClient.invalidateQueries({ queryKey: ["/api/advertiser/profile"] });
      toast({
        title: "Registratie succesvol!",
        description: "Je adverteerdersprofiel is aangemaakt. Je kunt nu advertenties en promoties beheren.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registratie mislukt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Building2 className="h-12 w-12 mx-auto text-primary mb-2" />
            <CardTitle>Inloggen vereist</CardTitle>
            <CardDescription>
              Je moet eerst inloggen of een account aanmaken om je als adverteerder te registreren.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3 justify-center">
            <Button asChild>
              <Link href="/app/login">Inloggen</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/app/register">Account aanmaken</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (registered) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/40">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <CardTitle>Welkom als adverteerder!</CardTitle>
            <CardDescription>
              Je profiel is aangemaakt. Ga naar je dashboard om advertenties te maken of events te promoten.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => setLocation("/advertiser/dashboard")}>
              Naar dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <Building2 className="h-12 w-12 mx-auto text-primary mb-4" />
          <h1 className="text-3xl font-bold">Adverteerder worden</h1>
          <p className="text-muted-foreground mt-2">
            Vul je bedrijfsgegevens in om te starten met adverteren op letsgo radar.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bedrijfsgegevens</CardTitle>
            <CardDescription>
              Deze informatie wordt gebruikt voor je adverteerdersprofiel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrijfsnaam *</FormLabel>
                      <FormControl>
                        <Input placeholder="Jouw bedrijfsnaam" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="businessCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorie *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecteer een categorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BUSINESS_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {CATEGORY_LABELS[cat] || cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        <Textarea
                          placeholder="Korte beschrijving van je bedrijf..."
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Optioneel. Wordt getoond bij je advertenties.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="websiteUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input placeholder="https://www.voorbeeld.nl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefoonnummer</FormLabel>
                        <FormControl>
                          <Input placeholder="06-12345678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input className="pl-10" placeholder="Straat 1, 1234 AB Stad" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Je adres wordt gebruikt om advertenties te tonen aan gebruikers in de buurt.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <h4 className="font-medium text-sm mb-2">Na registratie kun je:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">1</Badge>
                      Bedrijfsadvertenties plaatsen (CPM-model)
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">2</Badge>
                      Events promoten bovenaan zoekresultaten
                    </li>
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">3</Badge>
                      Statistieken en budget beheren
                    </li>
                  </ul>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Registreren...
                    </>
                  ) : (
                    <>
                      Registreren als adverteerder
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
