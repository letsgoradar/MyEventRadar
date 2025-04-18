import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

// Schema voor wachtwoord reset aanvraag
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .email({ message: "Voer een geldig e-mailadres in" }),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    }
  });

  const onSubmit = async (data: ForgotPasswordValues) => {
    setIsSubmitting(true);
    try {
      // API aanroep implementeren voor wachtwoord reset
      const response = await fetch("/api/request-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: data.email }),
      });
      
      if (response.ok) {
        setSuccess(true);
        toast({
          title: "Wachtwoord reset aangevraagd",
          description: "We hebben een e-mail gestuurd met instructies om je wachtwoord te resetten.",
          variant: "default",
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || "Er is iets misgegaan bij het verwerken van je aanvraag.");
      }
    } catch (error) {
      toast({
        title: "Aanvraag mislukt",
        description: error instanceof Error ? error.message : "Er is iets misgegaan bij het verwerken van je aanvraag.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const backToLogin = () => {
    setLocation("/app2/login");
  };

  if (success) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg bg-primary/10 p-6 text-center">
          <h3 className="mb-2 text-lg font-medium">E-mail verzonden</h3>
          <p className="mb-4 text-muted-foreground">
            We hebben een e-mail gestuurd naar <strong>{form.getValues("email")}</strong> met instructies om je wachtwoord te resetten.
          </p>
          <p className="text-sm text-muted-foreground">
            Controleer je inbox en span (of ongewenste mail) als je de e-mail niet kunt vinden.
          </p>
        </div>
        <Button variant="outline" onClick={backToLogin} className="w-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar inloggen
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  type="email"
                  autoComplete="email"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="space-y-3">
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Aanvraag verwerken...
              </>
            ) : (
              "Wachtwoord resetten"
            )}
          </Button>
          
          <Button 
            type="button" 
            variant="outline" 
            className="w-full" 
            onClick={backToLogin}
          >
            Terug naar inloggen
          </Button>
        </div>
      </form>
    </Form>
  );
}