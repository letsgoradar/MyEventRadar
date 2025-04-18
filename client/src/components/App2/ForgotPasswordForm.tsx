import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  email: z.string().email("Ongeldig e-mailadres").min(1, "E-mailadres is verplicht"),
});

type FormData = z.infer<typeof formSchema>;

export function ForgotPasswordForm() {
  const { toast } = useToast();
  const [resetRequested, setResetRequested] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return await res.json();
    },
    onSuccess: () => {
      setResetRequested(true);
      toast({
        title: "Wachtwoord reset aangevraagd",
        description: "Als dit e-mailadres bij ons bekend is, ontvang je binnenkort een e-mail met instructies.",
      });
    },
    onError: (error: Error) => {
      // We tonen altijd een succesbericht vanwege privacy,
      // maar we loggen de fout wel voor debugging
      console.error("Password reset error:", error);
      setResetRequested(true);
      toast({
        title: "Wachtwoord reset aangevraagd",
        description: "Als dit e-mailadres bij ons bekend is, ontvang je binnenkort een e-mail met instructies.",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    resetPasswordMutation.mutate(data);
  };

  if (resetRequested) {
    return (
      <div className="text-center p-4 bg-muted rounded-lg">
        <h3 className="font-medium mb-2">Controleer je e-mail</h3>
        <p className="text-muted-foreground mb-4">
          We hebben instructies verzonden naar {form.getValues("email")} als dit e-mailadres bij ons bekend is.
        </p>
        <p className="text-sm text-muted-foreground">
          Let op: de link in de e-mail is 30 minuten geldig.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input 
                  placeholder="E-mailadres" 
                  {...field} 
                  autoComplete="email"
                  type="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
          type="submit" 
          className="w-full" 
          disabled={resetPasswordMutation.isPending}
        >
          {resetPasswordMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Even geduld...
            </>
          ) : (
            "Reset wachtwoord"
          )}
        </Button>
      </form>
    </Form>
  );
}