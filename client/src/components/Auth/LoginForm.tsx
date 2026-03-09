import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo } from '@/components/ui/logo';

const loginSchema = z.object({
  email: z.string().email('Voer een geldig e-mailadres in'),
  password: z.string().min(1, 'Wachtwoord is verplicht'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginFormProps {
  redirectPath?: string;
  onSuccess?: (user: any) => void;
}

export function LoginForm({ redirectPath = '/admin', onSuccess }: LoginFormProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

      console.log('Attempting login with:', data);
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        data: data
      });

      console.log('Login response:', response);
      
      // Log activity but don't block login if it fails
      try {
        await apiRequest('/api/admin/log-activity', {
          method: 'POST',
          data: {
            userId: response.id,
            activityType: 'login',
            details: { 
              section: 'admin_panel'
            }
          }
        });
      } catch (error) {
        console.warn('Failed to log activity, but continuing login process:', error);
      }

      toast({
        title: 'Ingelogd!',
        description: 'Je bent succesvol ingelogd.',
      });

      if (onSuccess) {
        onSuccess(response);
      } else {
        // Redirect to admin dashboard
        window.location.href = redirectPath;
      }
    } catch (error) {
      console.error('Login error:', error);

      toast({
        title: 'Inloggen mislukt',
        description: 'Controleer je gebruikersnaam en wachtwoord en probeer opnieuw.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-6">
          <Logo className="h-12 w-12" />
        </div>
        <CardTitle className="text-2xl text-center">Inloggen</CardTitle>
        <CardDescription className="text-center">
          Log in om toegang te krijgen tot het beheerderspaneel
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mailadres</Label>
            <Input
              id="email"
              type="email"
              placeholder="Voer je e-mailadres in"
              {...register('email')}
              disabled={isLoading}
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
                type={showPassword ? 'text' : 'password'}
                placeholder="Voer je wachtwoord in"
                {...register('password')}
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
                onClick={togglePasswordVisibility}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inloggen...
              </>
            ) : (
              'Inloggen'
            )}
          </Button>
          <a
            href="/app/forgot-password"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Wachtwoord vergeten?
          </a>
        </CardFooter>
      </form>
    </Card>
  );
}