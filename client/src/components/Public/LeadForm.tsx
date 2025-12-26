import { useState } from 'react';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface LeadFormProps {
  citySlug?: string;
  cityName?: string;
  ctaText?: string;
}

export function LeadForm({ citySlug, cityName, ctaText }: LeadFormProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Ongeldig emailadres',
        description: 'Vul een geldig emailadres in.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          citySlug,
          source: citySlug ? `city-page-${citySlug}` : 'website',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
        setEmail('');
        toast({
          title: 'Aanmelding gelukt!',
          description: data.message || 'Je ontvangt binnenkort de leukste evenementen.',
        });
      } else {
        throw new Error(data.message || 'Er ging iets mis');
      }
    } catch (error: any) {
      toast({
        title: 'Fout',
        description: error.message || 'Er ging iets mis bij het aanmelden.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 text-center" data-testid="lead-form-success">
        <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
          Je bent aangemeld!
        </h3>
        <p className="text-sm text-green-700 dark:text-green-300">
          Je ontvangt binnenkort de leukste evenementen{cityName ? ` in ${cityName}` : ''}.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-[#60d0b8]/10 to-[#60d0b8]/5 rounded-xl p-6" data-testid="lead-form">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-[#60d0b8] rounded-full flex items-center justify-center">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Blijf op de hoogte
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {ctaText || `Ontvang de leukste evenementen${cityName ? ` in ${cityName}` : ''} in je inbox`}
          </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="email"
          placeholder="jouw@email.nl"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
          disabled={isLoading}
          data-testid="input-lead-email"
        />
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-[#60d0b8] hover:bg-[#4db8a0] text-white"
          data-testid="button-lead-submit"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Aanmelden'
          )}
        </Button>
      </form>
    </div>
  );
}
