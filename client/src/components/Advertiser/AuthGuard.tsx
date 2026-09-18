import { ReactNode, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Loader, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

interface AdvertiserAuthGuardProps {
  children: ReactNode;
}

export default function AdvertiserAuthGuard({ children }: AdvertiserAuthGuardProps) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: profileData, isLoading: profileLoading } = useQuery<{ profile: { status: string; emailVerified?: boolean } }>({
    queryKey: ["/api/advertiser/profile"],
    enabled: !!user,
    retry: false,
  });
  const profile = profileData?.profile;
  useEffect(() => {
    if (user && !profileLoading && (!profile || profile.status !== "active" || profile.emailVerified !== true)) {
      setLocation("/advertiser/register");
    }
  }, [user, profileLoading, profile, setLocation]);

  if (isLoading || (!!user && profileLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
        <div className="w-full max-w-md p-8 space-y-6 bg-background rounded-xl shadow-lg">
          <div className="flex justify-center">
            <Loader className="h-10 w-10 animate-spin text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-center">
            Toegang controleren...
          </h1>
          <p className="text-center text-muted-foreground">
            Even geduld terwijl we je toegangsrechten verifiëren.
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-muted/40">
        <div className="w-full max-w-md p-8 space-y-6 bg-background rounded-xl shadow-lg">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-10 w-10 text-amber-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-center">
            Inloggen vereist
          </h1>
          <p className="text-center text-muted-foreground">
            Log in om je promotoraccount en campagnes te beheren.
          </p>
          <div className="flex flex-col justify-center gap-3 pt-4 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/adverteren">Terug</Link>
            </Button>
            <Button asChild>
              <Link href={`/app/login?returnTo=${encodeURIComponent(location)}`}>Inloggen</Link>
            </Button>
            <Button asChild>
              <Link href={`/app/register?returnTo=${encodeURIComponent(location)}`}>Account maken</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || profile.status !== "active" || profile.emailVerified !== true) {
    return <div className="flex min-h-screen items-center justify-center bg-muted/40"><Loader className="h-10 w-10 animate-spin text-primary" /></div>;
  }

  return <>{children}</>;
}
