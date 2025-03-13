import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';

interface FocusLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export default function FocusLayout({ children, title }: FocusLayoutProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] overflow-auto">
      <div className="min-h-screen bg-background">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-50"
            onClick={() => setLocation('/')}
          >
            <X className="h-4 w-4" />
          </Button>
          {title && (
            <div className="p-4 border-b">
              <h1 className="text-2xl font-bold">{title}</h1>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
