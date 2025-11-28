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
    id: "silver",
    name: "Zilver",
    base: "#f5f5f5",
    surface: "#e8e8e8",
    accent: "#d4d4d4",
    textColor: "#1a1a1a",
  },
  {
    id: "warm-gray",
    name: "Warm Grijs",
    base: "#f5f5f4",
    surface: "#e7e5e4",
    accent: "#d6d3d1",
    textColor: "#292524",
  },
  {
    id: "cool-gray",
    name: "Koel Grijs",
    base: "#f1f5f9",
    surface: "#e2e8f0",
    accent: "#cbd5e1",
    textColor: "#1e293b",
  },
  {
    id: "sand",
    name: "Zand",
    base: "#faf8f5",
    surface: "#f0ebe4",
    accent: "#e0d6c8",
    textColor: "#44403c",
  },
  {
    id: "mist-blue",
    name: "Mist Blauw",
    base: "#f8fafc",
    surface: "#e8f4f8",
    accent: "#bae6fd",
    textColor: "#0c4a6e",
  },
  {
    id: "sage",
    name: "Salie Groen",
    base: "#f8faf8",
    surface: "#ecf4ec",
    accent: "#c6dcc6",
    textColor: "#1a3a1a",
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
