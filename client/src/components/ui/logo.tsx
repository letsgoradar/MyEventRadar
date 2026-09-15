import { cn } from '@/lib/utils';
import { getCurrentBrand } from '@/lib/brand';

interface LogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function Logo({ className, showText = false, textClassName }: LogoProps) {
  const brand = getCurrentBrand();
  return (
    <div className={cn("flex items-center", className)}>
      <img
        src={brand.logoWithText ?? undefined}
        alt={brand.displayName}
        className="brand-wordmark object-contain drop-shadow-sm"
        style={{ height: '32px', width: 'auto' }}
      />
      {!brand.logoWithText && <span className={cn("font-semibold", textClassName)}>{brand.name}</span>}
    </div>
  );
}

export function LogoIcon({ className }: { className?: string }) {
  const brand = getCurrentBrand();
  return (
    brand.logo ? <img src={brand.logo} alt={brand.name} className={cn("h-8 w-8 object-contain", className)} /> :
    <span className={cn("h-8 w-8 flex items-center justify-center rounded-md font-bold text-primary", className)} aria-label={brand.name}>R</span>
  );
}
