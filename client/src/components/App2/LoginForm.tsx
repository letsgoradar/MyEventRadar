import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';

// Schema for login form validation
const loginSchema = z.object({
  email: z.string().email('Vul een geldig e-mailadres in'),
  password: z.string().min(6, 'Wachtwoord moet minimaal 6 tekens bevatten'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface App2LoginFormProps {
  redirectPath?: string;
  onSuccess?: (user: any) => void;
}

export function App2LoginForm({ redirectPath = '/app2', onSuccess }: App2LoginFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, navigate] = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);

      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: data
      });

      console.log('Login response:', response);

      toast({
        title: 'Ingelogd!',
        description: 'Je bent succesvol ingelogd.',
      });

      if (onSuccess) {
        onSuccess(response);
      }

      navigate(redirectPath);
    } catch (error) {
      console.error('Login error:', error);
      toast({
        title: 'Inloggen mislukt',
        description: 'Controleer je e-mailadres en wachtwoord.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full shadow-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Inloggen</CardTitle>
        <CardDescription className="text-center">
          Log in om toegang te krijgen tot je account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mailadres</Label>
              <Input 
                id="email"
                placeholder="naam@voorbeeld.nl" 
                {...register('email')}
                type="email"
                disabled={isLoading}
                autoComplete="email"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Wachtwoord</Label>
              <div className="relative">
                <Input
                  id="password"
                  placeholder="••••••••"
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="sr-only">
                    {showPassword ? 'Verberg wachtwoord' : 'Toon wachtwoord'}
                  </span>
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full mt-6"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Inloggen...</span>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" />
                Inloggen
              </>
            )}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-center text-sm">
          <a href="#" className="text-primary hover:underline">
            Wachtwoord vergeten?
          </a>
        </div>
        <div className="text-center text-sm">
          Nog geen account?{' '}
          <a href="/app2/register" className="text-primary hover:underline">
            Registreren
          </a>
        </div>
      </CardFooter>
    </Card>
  );
}

export default App2LoginForm;