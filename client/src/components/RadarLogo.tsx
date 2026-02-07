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
  height = 32, 
  className = "", 
  textColor = "currentColor"
}: RadarLogoWithTextProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <img 
        src="/images/letsgo-radar-logo.png" 
        alt="letsgo radar" 
        style={{ height: `${height}px`, width: 'auto' }}
        className="object-contain rounded-md"
      />
      <span 
        style={{ 
          color: textColor, 
          fontSize: `${height * 0.6}px`,
          fontWeight: 700,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          lineHeight: 1,
        }}
      >
        letsgo radar
      </span>
    </div>
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
