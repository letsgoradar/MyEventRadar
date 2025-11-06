import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Map, PlusCircle, Bookmark } from "lucide-react";

const themes = [
  {
    id: "sky-blue",
    name: "Hemel Blauw",
    description: "Zachte blauwe tinten zoals de lucht",
    primary: "#0ea5e9",
    variant: "tint" as const,
  },
  {
    id: "emerald-green",
    name: "Smaragd Groen",
    description: "Rustig groen zoals een bos",
    primary: "#10b981",
    variant: "tint" as const,
  },
  {
    id: "amber-gold",
    name: "Warm Goud",
    description: "Zachte gouden tinten",
    primary: "#f59e0b",
    variant: "tint" as const,
  },
  {
    id: "slate-gray",
    name: "Zachte Grijs",
    description: "Neutrale grijstinten - modern en rustig",
    primary: "#64748b",
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
          <p className="text-gray-600 text-lg">Deze kleuren worden echt toegepast in de hele app</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
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
