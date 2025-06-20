import React, { useState, useEffect } from "react";
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
import { MapTransition } from "./MapTransition";
import { motion, AnimatePresence } from "framer-motion";

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
  const [animateMap, setAnimateMap] = useState(false);
  const [showForm, setShowForm] = useState(true);
  
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "testuser",
      password: "test123",
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data, {
      onSuccess: () => {
        // Start de animatie bij succesvol inloggen
        setAnimateMap(true);
        setShowForm(false);
        
        // De redirect naar /app2 gebeurt na de animatie (in MapTransition.onComplete)
      }
    });
  };

  const handleAnimationComplete = () => {
    // Navigeer naar de app na afronding van de animatie
    setTimeout(() => {
      setLocation("/app2");
    }, 500); // Korte vertraging om de animatie af te laten lopen
  };

  const goToForgotPassword = () => {
    setLocation("/app2/forgot-password");
  };

  const goToRegister = () => {
    setLocation("/app2/register");
  };

  return (
    <AnimatePresence>
      {showForm && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gebruikersnaam of E-mailadres</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Voer je gebruikersnaam of e-mailadres in"
                        {...field}
                        type="text"
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
        </motion.div>
      )}

      {animateMap && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <MapTransition 
            isActive={animateMap}
            onComplete={handleAnimationComplete}
          >
            <div className="w-full h-full">
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                </motion.div>
              </div>
            </div>
          </MapTransition>
        </div>
      )}
    </AnimatePresence>
  );
}