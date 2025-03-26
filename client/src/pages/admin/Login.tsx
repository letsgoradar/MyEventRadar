import React from 'react';
import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email({
    message: 'Voer een geldig e-mailadres in',
  }),
  password: z.string().min(6, {
    message: 'Wachtwoord moet minimaal 6 tekens bevatten',
  }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const AdminLogin: React.FC = () => {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  interface LoginResponse {
    id: number;
    username: string;
    email: string;
    role: string;
  }

  const loginMutation = useMutation<LoginResponse, Error, LoginFormValues>({
    mutationFn: async (data: LoginFormValues) => {
      return await apiRequest<LoginResponse>('/api/auth/login', {
        method: 'POST',
        data,
      });
    },
    onSuccess: (data) => {
      if (data.role === 'admin') {
        toast({
          title: 'Ingelogd als administrator',
          description: 'Je bent succesvol ingelogd als administrator.',
        });
        setLocation('/admin/dashboard');
      } else {
        toast({
          variant: 'destructive',
          title: 'Geen toegang',
          description: 'Je account heeft geen administratorrechten.',
        });
      }
    },
    onError: (error) => {
      console.error('Login error:', error);
      toast({
        variant: 'destructive',
        title: 'Inloggen mislukt',
        description: 'Controleer je e-mailadres en wachtwoord.',
      });
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Log in met je administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mailadres</FormLabel>
                    <FormControl>
                      <Input placeholder="jouw@email.nl" {...field} />
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
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
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
                  'Inloggen'
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button
            variant="link"
            onClick={() => setLocation('/')}
          >
            Terug naar hoofdpagina
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default AdminLogin;