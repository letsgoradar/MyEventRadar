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
    id: "subtle-orange",
    name: "Subtiel Oranje",
    description: "Grijs met zachte oranje tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#fed7aa", "#fef3e2"],
    textColor: "#1a1a1a",
  },
  {
    id: "subtle-blue",
    name: "Subtiel Blauw",
    description: "Grijs met zachte blauwe tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#bfdbfe", "#dbeafe"],
    textColor: "#1e3a5f",
  },
  {
    id: "subtle-green",
    name: "Subtiel Groen",
    description: "Grijs met zachte groene tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#bbf7d0", "#dcfce7"],
    textColor: "#14532d",
  },
  {
    id: "subtle-purple",
    name: "Subtiel Paars",
    description: "Grijs met zachte paarse tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#e9d5ff", "#f3e8ff"],
    textColor: "#3b0764",
  },
  {
    id: "subtle-pink",
    name: "Subtiel Roze",
    description: "Grijs met zachte roze tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#fbcfe8", "#fce7f3"],
    textColor: "#831843",
  },
  {
    id: "subtle-teal",
    name: "Subtiel Teal",
    description: "Grijs met zachte teal tint",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#99f6e4", "#ccfbf1"],
    textColor: "#134e4a",
  },
  {
    id: "pure-gray",
    name: "Puur Grijs",
    description: "Alleen grijstinten",
    colors: ["#f5f5f5", "#ebebeb", "#e5e5e5", "#d4d4d4", "#e8e8e8"],
    textColor: "#1a1a1a",
  },
  {
    id: "warm-gray",
    name: "Warm Grijs",
    description: "Warme grijstinten",
    colors: ["#f5f5f4", "#ededed", "#e7e5e4", "#d6d3d1", "#eae8e7"],
    textColor: "#292524",
  },
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
    colors: ["#f3f4f6", "#e5e7eb", "#d1d5db", "#e5e7eb", "#d1d5db"],
    textColor: "#1f2937",
  },
  {
    id: "warm-taupe",
    name: "Warm Taupe",
    description: "Warme neutrale bruintinten",
    colors: ["#f5f5f4", "#e7e5e4", "#d6d3d1", "#e7e5e4", "#d6d3d1"],
    textColor: "#44403c",
  },
  {
    id: "cool-slate",
    name: "Koele Lei",
    description: "Koele blauwig grijze tinten",
    colors: ["#f1f5f9", "#e2e8f0", "#cbd5e1", "#e2e8f0", "#cbd5e1"],
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
    <div className="bg-gray-50 min-h-screen overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 md:p-8 pb-40">
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

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
          <div className="max-w-6xl mx-auto text-center">
            <Button 
              size="lg"
              className="font-semibold px-8 shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${selectedTheme.colors.join(', ')})`,
                color: selectedTheme.textColor
              }}
              onClick={() => applyTheme(selectedTheme)}
            >
              <Check className="mr-2 h-5 w-5" />
              Kies {selectedTheme.name}
            </Button>
            <p className="text-sm text-gray-500 mt-2">
              De app wordt opnieuw geladen met je nieuwe kleurenpalet
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
