import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({ className, showText = false, textClassName }: LogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src="/images/letsgo-radar-brand.jpg"
        alt="letsgo radar"
        className="object-contain rounded-lg drop-shadow-sm"
        style={{ height: '32px', width: 'auto' }}
      />
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
