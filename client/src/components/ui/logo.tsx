import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({ className, showText = false, textClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <img 
        src="/images/letsgo-radar-logo.png" 
        alt="letsgo radar" 
        className="h-8 w-auto object-contain"
      />
      {showText && (
        <span className={cn("font-bold text-lg", textClassName)}>
          letsgo radar
        </span>
      )}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <img 
      src="/images/letsgo-radar-logo.png" 
      alt="letsgo radar" 
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}
