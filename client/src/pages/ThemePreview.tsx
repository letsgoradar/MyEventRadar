import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Map, PlusCircle, Bookmark } from "lucide-react";

const themes = [
  {
    id: "pastel-sky",
    name: "Pastel Lucht",
    description: "Zachte hemelblauwe tinten",
    primary: "#7dd3fc",
    variant: "tint" as const,
  },
  {
    id: "pastel-mint",
    name: "Pastel Mint",
    description: "Vriendelijk mint groen",
    primary: "#6ee7b7",
    variant: "tint" as const,
  },
  {
    id: "pastel-peach",
    name: "Pastel Perzik",
    description: "Warme zachte perzik",
    primary: "#fed7aa",
    variant: "tint" as const,
  },
  {
    id: "pastel-lavender",
    name: "Pastel Lavendel",
    description: "Rustige lila tinten",
    primary: "#c4b5fd",
    variant: "tint" as const,
  },
  {
    id: "pastel-aqua",
    name: "Pastel Aqua",
    description: "Fris turquoise blauw",
    primary: "#5eead4",
    variant: "tint" as const,
  },
  {
    id: "pastel-coral",
    name: "Pastel Koraal",
    description: "Zachte koraal roze",
    primary: "#fecaca",
    variant: "tint" as const,
  },
  {
    id: "pastel-sage",
    name: "Pastel Salie",
    description: "Rustgevend salie groen",
    primary: "#86efac",
    variant: "tint" as const,
  },
  {
    id: "pastel-lemon",
    name: "Pastel Citroen",
    description: "Vriendelijk licht geel",
    primary: "#fde047",
    variant: "tint" as const,
  },
  {
    id: "pastel-lilac",
    name: "Pastel Lila",
    description: "Zachte paarse tinten",
    primary: "#d8b4fe",
    variant: "tint" as const,
  },
  {
    id: "pastel-rose",
    name: "Pastel Roos",
    description: "Vriendelijk roze",
    primary: "#fda4af",
    variant: "tint" as const,
  },
  {
    id: "pastel-sky-indigo",
    name: "Pastel Indigo",
    description: "Zachte indigo blauw",
    primary: "#a5b4fc",
    variant: "tint" as const,
  },
  {
    id: "pastel-seafoam",
    name: "Pastel Zeeschuim",
    description: "Rustig blauw-groen",
    primary: "#67e8f9",
    variant: "tint" as const,
  },
];

export default function ThemePreview() {
  const [selectedTheme, setSelectedTheme] = useState(themes[0]);

  const applyTheme = async (theme: typeof themes[0]) => {
    await fetch('/api/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        variant: theme.variant,
        primary: theme.primary,
        appearance: "light",
        radius: 0.75
      })
    });
    
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 text-gray-800">
            Kies jouw kleurthema
          </h1>
          <p className="text-gray-600 text-lg">Vriendelijke pastel kleuren voor een zachte uitstraling</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {themes.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTheme.id === theme.id ? 'ring-2' : ''
              }`}
              style={{
                borderColor: selectedTheme.id === theme.id ? theme.primary : undefined,
                ringColor: selectedTheme.id === theme.id ? theme.primary : undefined,
              }}
              onClick={() => setSelectedTheme(theme)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {theme.name}
                      {selectedTheme.id === theme.id && (
                        <Check className="h-5 w-5" style={{ color: theme.primary }} />
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">{theme.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Grote kleur preview */}
                  <div 
                    className="h-24 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <span className="text-white font-bold text-xl drop-shadow-lg">
                      {theme.name}
                    </span>
                  </div>

                  {/* Button voorbeeld */}
                  <Button 
                    className="w-full text-white font-semibold"
                    style={{ backgroundColor: theme.primary }}
                  >
                    Voorbeeld Button
                  </Button>

                  {/* Kleine kleurpalett */}
                  <div className="grid grid-cols-5 gap-2">
                    <div 
                      className="h-10 rounded" 
                      style={{ backgroundColor: theme.primary, opacity: 0.3 }}
                      title="Lichter"
                    />
                    <div 
                      className="h-10 rounded" 
                      style={{ backgroundColor: theme.primary, opacity: 0.5 }}
                    />
                    <div 
                      className="h-10 rounded border-2 border-gray-300" 
                      style={{ backgroundColor: theme.primary }}
                      title="Hoofdkleur"
                    />
                    <div 
                      className="h-10 rounded" 
                      style={{ backgroundColor: theme.primary, filter: 'brightness(0.8)' }}
                    />
                    <div 
                      className="h-10 rounded" 
                      style={{ backgroundColor: theme.primary, filter: 'brightness(0.6)' }}
                      title="Donkerder"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button 
            size="lg"
            className="text-white font-semibold px-8"
            style={{ backgroundColor: selectedTheme.primary }}
            onClick={() => applyTheme(selectedTheme)}
          >
            <Check className="mr-2 h-5 w-5" />
            Kies {selectedTheme.name}
          </Button>
          <p className="text-sm text-gray-500 mt-3">
            De app wordt opnieuw geladen met je nieuwe kleurthema
          </p>
        </div>
      </div>
    </div>
  );
}
