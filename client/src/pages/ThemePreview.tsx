import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

interface Theme {
  id: string;
  name: string;
  description: string;
  colors: string[];
  textColor: string;
}

const themes: Theme[] = [
  {
    id: "ocean-sky",
    name: "Oceaan & Hemel",
    description: "Zachte blauwen en aqua tinten",
    colors: ["#dbeafe", "#bfdbfe", "#a5f3fc", "#cffafe", "#e0f2fe"],
    textColor: "#1e3a8a",
  },
  {
    id: "spring-garden",
    name: "Lente Tuin",
    description: "Frisse groentinten en geel",
    colors: ["#d1fae5", "#bbf7d0", "#fef3c7", "#fde68a", "#d9f99d"],
    textColor: "#14532d",
  },
  {
    id: "sunset-peach",
    name: "Zonsondergang",
    description: "Warme perzik en roze tinten",
    colors: ["#fed7aa", "#fecaca", "#fce7f3", "#fbcfe8", "#fee2e2"],
    textColor: "#9f1239",
  },
  {
    id: "lavender-dream",
    name: "Lavendel Droom",
    description: "Zachte paarse en blauwe tinten",
    colors: ["#f3e8ff", "#e9d5ff", "#ddd6fe", "#c7d2fe", "#e0e7ff"],
    textColor: "#4c1d95",
  },
  {
    id: "neutral-sand",
    name: "Neutraal Zand",
    description: "Warme beige en crème tinten",
    colors: ["#fef3c7", "#fef9e7", "#fef3c7", "#fde68a", "#fef08a"],
    textColor: "#78350f",
  },
  {
    id: "soft-gray",
    name: "Zachte Grijs",
    description: "Neutrale grijstinten",
    colors: ["#f3f4f6", "#e5e7eb", "#f9fafb", "#f3f4f6", "#e5e7eb"],
    textColor: "#1f2937",
  },
  {
    id: "warm-taupe",
    name: "Warm Taupe",
    description: "Warme neutrale bruintinten",
    colors: ["#f5f5f4", "#e7e5e4", "#fafaf9", "#f5f5f4", "#e7e5e4"],
    textColor: "#44403c",
  },
  {
    id: "cool-slate",
    name: "Koele Lei",
    description: "Koele blauwig grijze tinten",
    colors: ["#f1f5f9", "#e2e8f0", "#f8fafc", "#f1f5f9", "#e2e8f0"],
    textColor: "#334155",
  },
  {
    id: "mint-cream",
    name: "Mint & Crème",
    description: "Lichte mint en aqua tinten",
    colors: ["#d1fae5", "#cffafe", "#e0f2fe", "#dbeafe", "#bfdbfe"],
    textColor: "#064e3b",
  },
  {
    id: "soft-rose",
    name: "Zachte Roos",
    description: "Zeer lichte roze tinten",
    colors: ["#fce7f3", "#fbcfe8", "#fef3c7", "#fed7aa", "#fee2e2"],
    textColor: "#881337",
  },
  {
    id: "cream-white",
    name: "Crème Wit",
    description: "Bijna witte neutrale tinten",
    colors: ["#fefefe", "#fafafa", "#f9fafb", "#fefefe", "#fafafa"],
    textColor: "#0f172a",
  },
  {
    id: "pale-blue",
    name: "Bleek Blauw",
    description: "Zeer zachte blauwe tinten",
    colors: ["#eff6ff", "#dbeafe", "#f0f9ff", "#e0f2fe", "#dbeafe"],
    textColor: "#1e40af",
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
        primary: theme.colors[2],
        appearance: "light",
        radius: 0.75,
        colors: theme.colors,
        textColor: theme.textColor
      })
    });
    
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-gray-800">
            Kies jouw kleurthema
          </h1>
          <p className="text-gray-600 text-lg">Elk thema heeft 5 harmonieuze lichte pastel kleuren</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {themes.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTheme.id === theme.id ? 'ring-2 ring-blue-400' : ''
              }`}
              onClick={() => setSelectedTheme(theme)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {theme.name}
                      {selectedTheme.id === theme.id && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{theme.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Gradient preview zoals in menu's */}
                  <div 
                    className="h-20 rounded-xl flex items-center justify-center border-2 border-white/30"
                    style={{ 
                      background: `linear-gradient(135deg, ${theme.colors.join(', ')})`,
                      boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                      color: theme.textColor
                    }}
                  >
                    <span className="font-bold text-lg drop-shadow-sm">
                      Menu Voorbeeld
                    </span>
                  </div>

                  {/* Horizontale gradient zoals in tab bar */}
                  <div 
                    className="h-12 rounded-lg flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(90deg, ${theme.colors[0]}, ${theme.colors[2]}, ${theme.colors[4]})`,
                      color: theme.textColor
                    }}
                  >
                    <span className="font-semibold text-sm">
                      Tab Bar Voorbeeld
                    </span>
                  </div>

                  {/* Kleurenpalet - 5 kleuren */}
                  <div className="grid grid-cols-5 gap-2">
                    {theme.colors.map((color, index) => (
                      <div 
                        key={index}
                        className="h-16 rounded-lg border-2 border-gray-200 flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        <span className="text-xs font-semibold text-gray-700">{index + 1}</span>
                      </div>
                    ))}
                  </div>

                  {/* Button voorbeeld */}
                  <Button 
                    className="w-full text-white font-semibold"
                    style={{ 
                      background: `linear-gradient(135deg, ${theme.colors[1]}, ${theme.colors[3]})`,
                    }}
                  >
                    Voorbeeld Button
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button 
            size="lg"
            className="text-white font-semibold px-8"
            style={{ 
              background: `linear-gradient(135deg, ${selectedTheme.colors.join(', ')})`,
            }}
            onClick={() => applyTheme(selectedTheme)}
          >
            <Check className="mr-2 h-5 w-5" />
            Kies {selectedTheme.name}
          </Button>
          <p className="text-sm text-gray-500 mt-3">
            De app wordt opnieuw geladen met je nieuwe kleurenpalet
          </p>
        </div>
      </div>
    </div>
  );
}
