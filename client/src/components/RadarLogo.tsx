import { Radar } from "lucide-react";
import { getCurrentBrand } from "@/lib/brand";

interface RadarLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export function RadarLogo({ size = 32, className = "" }: RadarLogoProps) {
  const brand = getCurrentBrand();

  if (brand.logo) {
    return (
      <img
        src={brand.logo}
        alt={brand.name}
        width={size}
        height={size}
        className={`object-contain ${className}`}
      />
    );
  }

  return (
    <Radar
      size={size}
      className={`${className}`}
      style={{ color: brand.themeColor }}
      aria-label={brand.name}
    />
  );
}

interface RadarLogoWithTextProps {
  height?: number;
  className?: string;
  color?: string;
  textColor?: string;
}

export function RadarLogoWithText({
  height = 40,
  className = "",
  textColor,
}: RadarLogoWithTextProps) {
  const brand = getCurrentBrand();

  if (brand.logoWithText) {
    const aspectRatio = 930 / 230;
    const width = Math.round(height * aspectRatio);
    return (
      <img
        src={brand.logoWithText}
        alt={brand.displayName}
        style={{ height: `${height}px`, width: `${width}px` }}
        className={`object-contain drop-shadow-sm ${className}`}
      />
    );
  }

  const iconSize = Math.round(height * 0.85);
  const fontSize = Math.round(height * 0.55);
  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      style={{ height: `${height}px` }}
      aria-label={brand.displayName}
    >
      <Radar size={iconSize} style={{ color: brand.themeColor }} />
      <span
        className="font-bold tracking-tight leading-none"
        style={{ fontSize: `${fontSize}px`, color: textColor ?? brand.themeColor }}
      >
        {brand.name}
      </span>
    </div>
  );
}

export function RadarLogoAnimated({ size = 32, className = "" }: RadarLogoProps) {
  return <RadarLogo size={size} className={className} />;
}
