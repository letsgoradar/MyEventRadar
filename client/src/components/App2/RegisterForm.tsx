import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

// Schema voor registratie
const registerSchema = z.object({
  username: z
    .string()
    .min(3, { message: "Gebruikersnaam moet minimaal 3 tekens bevatten" })
    .max(50, { message: "Gebruikersnaam mag maximaal 50 tekens bevatten" }),
  email: z
    .string()
    .email({ message: "Voer een geldig e-mailadres in" }),
  password: z
    .string()
    .min(6, { message: "Wachtwoord moet minimaal 6 tekens bevatten" }),
  confirmPassword: z
    .string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Wachtwoorden komen niet overeen",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { registerMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    registerMutation.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
      role: "user",
    }, {
      onSuccess: () => {
        toast({
          title: "Account aangemaakt",
          description: "Je bent succesvol geregistreerd en ingelogd.",
          variant: "default",
        });
        setLocation("/app2");
      },
      onError: (error) => {
        toast({
          title: "Registratie mislukt",
          description: error.message || "Er is iets misgegaan bij het registreren.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gebruikersnaam</FormLabel>
              <FormControl>
                <Input
                  placeholder="Voer je gebruikersnaam in"
                  {...field}
                  autoComplete="username"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mailadres</FormLabel>
              <FormControl>
                <Input
                  placeholder="Voer je e-mailadres in"
                  {...field}
                  autoComplete="email"
                  type="email"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wachtwoord</FormLabel>
              <FormControl>
                <Input
                  placeholder="Voer je wachtwoord in"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bevestig wachtwoord</FormLabel>
              <FormControl>
                <Input
                  placeholder="Voer je wachtwoord nogmaals in"
                  {...field}
                  type="password"
                  autoComplete="new-password"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Bezig met registreren...
            </>
          ) : (
            "Registreren"
          )}
        </Button>
      </form>
    </Form>
  );
}