import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getCurrentBrand } from "@/lib/brand";

/** Zet een hex-kleur (#RRGGBB) om naar "H S% L%" voor shadcn CSS-variabelen. */
function hexToHslChannels(hex: string): string | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ThemeInjector() {
  const { data: theme } = useQuery<{ colors?: string[]; textColor?: string }>({
    queryKey: ['/api/theme'],
  });

  // Pas de actieve-merk-branding toe: primaire kleur, document-titel en
  // theme-color meta. Gebeurt direct op basis van de hostname.
  useEffect(() => {
    const brand = getCurrentBrand();
    const root = document.documentElement;

    const hsl = hexToHslChannels(brand.themeColor);
    if (hsl) {
      root.style.setProperty('--primary', hsl);
    }
    root.style.setProperty('--brand-color', brand.themeColor);

    document.title = brand.seo.homeTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', brand.seo.homeDescription);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', brand.themeColor);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme?.colors && theme.colors.length === 5) {
      theme.colors.forEach((color, index) => {
        root.style.setProperty(`--theme-color-${index + 1}`, color);
      });
    }
    
    if (theme?.textColor) {
      root.style.setProperty('--theme-text-color', theme.textColor);
    }
  }, [theme]);

  return null;
}
