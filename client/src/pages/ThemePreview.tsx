import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  base: string;
  surface: string;
  accent: string;
  textColor: string;
}

const themes: Theme[] = [
  {
    id: "champagne",
    name: "Champagne",
    base: "#faf9f6",
    surface: "#f5f1e8",
    accent: "#d4c9a8",
    textColor: "#4a4535",
  },
  {
    id: "gold",
    name: "Goud",
    base: "#faf9f5",
    surface: "#f5f0e5",
    accent: "#c9b896",
    textColor: "#4a4230",
  },
  {
    id: "bronze",
    name: "Brons",
    base: "#f9f8f5",
    surface: "#f2ede5",
    accent: "#b8a888",
    textColor: "#45402e",
  },
  {
    id: "copper",
    name: "Koper",
    base: "#faf8f5",
    surface: "#f3ede4",
    accent: "#c4a882",
    textColor: "#4a3f2d",
  },
  {
    id: "platinum",
    name: "Platina",
    base: "#f8f8f8",
    surface: "#f0f0ee",
    accent: "#c8c8c0",
    textColor: "#3a3a38",
  },
  {
    id: "silver",
    name: "Zilver",
    base: "#f5f5f5",
    surface: "#e8e8e8",
    accent: "#d4d4d4",
    textColor: "#1a1a1a",
  },
];

export default function ThemePreview() {
  const [selectedTheme, setSelectedTheme] = useState(themes[0]);

  const applyTheme = async (theme: Theme) => {
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant: "tint",
        primary: theme.accent,
        appearance: "light",
        radius: 0.75,
        colors: [theme.base, theme.surface, theme.accent, theme.surface, theme.base],
        textColor: theme.textColor
      })
    });
    
    window.location.reload();
  };

  return (
    <div className="bg-gray-50 min-h-screen overflow-y-auto">
      <div className="max-w-4xl mx-auto p-6 pb-32">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Kies jouw kleurthema
          </h1>
          <p className="text-gray-500">Rustige, subtiele kleurenschema's</p>
        </div>

        <div className="grid gap-4">
          {themes.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedTheme.id === theme.id ? 'ring-2 ring-gray-400' : ''
              }`}
              onClick={() => setSelectedTheme(theme)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  {selectedTheme.id === theme.id && (
                    <Check className="h-5 w-5 text-gray-600" />
                  )}
                  {theme.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 items-center">
                  <div className="flex gap-2 flex-1">
                    <div 
                      className="h-14 flex-1 rounded-lg border border-gray-200 flex items-center justify-center"
                      style={{ backgroundColor: theme.base }}
                    >
                      <span className="text-xs" style={{ color: theme.textColor }}>Basis</span>
                    </div>
                    <div 
                      className="h-14 flex-1 rounded-lg border border-gray-200 flex items-center justify-center"
                      style={{ backgroundColor: theme.surface }}
                    >
                      <span className="text-xs" style={{ color: theme.textColor }}>Oppervlak</span>
                    </div>
                    <div 
                      className="h-14 flex-1 rounded-lg border border-gray-200 flex items-center justify-center"
                      style={{ backgroundColor: theme.accent }}
                    >
                      <span className="text-xs" style={{ color: theme.textColor }}>Accent</span>
                    </div>
                  </div>
                  <Button 
                    className="font-medium"
                    style={{ 
                      backgroundColor: theme.accent,
                      color: theme.textColor
                    }}
                  >
                    Button
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg">
          <div className="max-w-4xl mx-auto text-center">
            <Button 
              size="lg"
              className="font-semibold px-8"
              style={{ 
                backgroundColor: selectedTheme.accent,
                color: selectedTheme.textColor
              }}
              onClick={() => applyTheme(selectedTheme)}
            >
              <Check className="mr-2 h-5 w-5" />
              Kies {selectedTheme.name}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
