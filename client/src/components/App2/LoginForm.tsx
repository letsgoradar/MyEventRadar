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

// Schema voor login
const loginSchema = z.object({
  email: z
    .string()
    .email({ message: "Voer een geldig e-mailadres in" }),
  password: z
    .string()
    .min(1, { message: "Wachtwoord is verplicht" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const { loginMutation } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        setLocation("/app2");
      }
    });
  };

  const goToForgotPassword = () => {
    setLocation("/app2/forgot-password");
  };

  const goToRegister = () => {
    setLocation("/app2/register");
  };

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
                  autoComplete="current-password"
                  className="w-full"
                />
              </FormControl>
              <FormMessage />
              <div className="text-right">
                <button
                  type="button"
                  onClick={goToForgotPassword}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Wachtwoord vergeten?
                </button>
              </div>
            </FormItem>
          )}
        />
        
        <Button 
          type="submit" 
          className="w-full" 
          disabled={loginMutation.isPending}
        >
          {loginMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Inloggen...
            </>
          ) : (
            "Inloggen"
          )}
        </Button>
        
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Nog geen account?</span>{" "}
          <button 
            type="button"
            onClick={goToRegister} 
            className="text-primary hover:underline font-medium"
          >
            Registreren
          </button>
        </div>
      </form>
    </Form>
  );
}