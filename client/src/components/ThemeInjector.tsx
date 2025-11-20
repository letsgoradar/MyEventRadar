import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export function ThemeInjector() {
  const { data: theme } = useQuery<{ colors?: string[] }>({
    queryKey: ['/api/theme'],
  });

  useEffect(() => {
    if (theme?.colors && theme.colors.length === 5) {
      const root = document.documentElement;
      theme.colors.forEach((color, index) => {
        root.style.setProperty(`--theme-color-${index + 1}`, color);
      });
    }
  }, [theme]);

  return null;
}
