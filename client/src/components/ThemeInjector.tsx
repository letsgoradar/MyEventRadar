import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function ThemeInjector() {
  const { data: theme } = useQuery<{ colors?: string[]; textColor?: string }>({
    queryKey: ['/api/theme'],
  });

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
