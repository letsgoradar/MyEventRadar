interface RadarLogoProps {
  size?: number;
  className?: string;
  color?: string;
}

export function RadarLogo({ size = 32, className = "" }: RadarLogoProps) {
  return (
    <img
      src="/images/letsgo-radar-logo.png"
      alt="letsgo radar"
      width={size}
      height={size}
      className={`object-contain ${className}`}
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
}: RadarLogoWithTextProps) {
  const aspectRatio = 832 / 359;
  const width = Math.round(height * aspectRatio);

  return (
    <img
      src="/images/letsgo-radar-brand.jpg"
      alt="letsgo radar"
      style={{ height: `${height}px`, width: `${width}px` }}
      className={`object-contain rounded drop-shadow-sm ${className}`}
    />
  );
}

export function RadarLogoAnimated({ size = 32, className = "" }: RadarLogoProps) {
  return (
    <img
      src="/images/letsgo-radar-logo.png"
      alt="letsgo radar"
      width={size}
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
