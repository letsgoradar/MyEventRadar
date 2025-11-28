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
    id: "ocean",
    name: "Oceaan",
    base: "#f5f9fa",
    surface: "#e5f0f5",
    accent: "#78b8d8",
    textColor: "#1a3a4a",
  },
  {
    id: "navy",
    name: "Navy Blue",
    base: "#f5f7fa",
    surface: "#e5eaf2",
    accent: "#6888a8",
    textColor: "#1a2838",
  },
  {
    id: "summer-day",
    name: "Zomerse Dag",
    base: "#f5fafc",
    surface: "#e5f5f8",
    accent: "#68c8e0",
    textColor: "#1a404a",
  },
  {
    id: "cheerful",
    name: "Vrolijk",
    base: "#f5fcfa",
    surface: "#e5f8f2",
    accent: "#60d0b8",
    textColor: "#1a4a40",
  },
  {
    id: "calm",
    name: "Rustgevend",
    base: "#f5f8fa",
    surface: "#e8f0f5",
    accent: "#90b8c8",
    textColor: "#283840",
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
