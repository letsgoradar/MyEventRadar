import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Map, PlusCircle, Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const themes = [
  {
    id: "soft-blue",
    name: "Zacht Blauw",
    description: "Rustige pastel blauwtinten - harmonieus met kaartweergave",
    primary: "#60a5fa",
    variant: "tint" as const,
    gradient: "linear-gradient(135deg, #93c5fd, #60a5fa, #3b82f6)",
    glow: "0 0 25px rgba(96, 165, 250, 0.3)",
    borderGradient: "linear-gradient(135deg, #93c5fd, #60a5fa)",
  },
  {
    id: "mint-green",
    name: "Mint Groen",
    description: "Zachte mint en aqua tinten - fris en kalm",
    primary: "#6ee7b7",
    variant: "tint" as const,
    gradient: "linear-gradient(135deg, #a7f3d0, #6ee7b7, #5eead4, #67e8f9)",
    glow: "0 0 25px rgba(110, 231, 183, 0.3)",
    borderGradient: "linear-gradient(135deg, #a7f3d0, #6ee7b7)",
  },
  {
    id: "peach-cream",
    name: "Perzik Crème",
    description: "Warme pastel tinten - zacht en uitnodigend",
    primary: "#fdba74",
    variant: "tint" as const,
    gradient: "linear-gradient(135deg, #fde68a, #fcd34d, #fdba74, #fb923c)",
    glow: "0 0 25px rgba(253, 186, 116, 0.3)",
    borderGradient: "linear-gradient(135deg, #fde68a, #fcd34d)",
  },
  {
    id: "lavender-sky",
    name: "Lavendel Hemel",
    description: "Zachte lila en blauw tinten - rustig en elegant",
    primary: "#a5b4fc",
    variant: "tint" as const,
    gradient: "linear-gradient(135deg, #c7d2fe, #a5b4fc, #818cf8, #93c5fd)",
    glow: "0 0 25px rgba(165, 180, 252, 0.3)",
    borderGradient: "linear-gradient(135deg, #c7d2fe, #a5b4fc)",
  },
];

export default function ThemePreview() {
  const [selectedTheme, setSelectedTheme] = useState(themes[0]);

  const applyTheme = async (theme: typeof themes[0]) => {
    setSelectedTheme(theme);
    
    // Update theme.json via API
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
    
    // Reload om nieuwe kleuren te laden
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-300 via-green-300 via-yellow-300 to-orange-300 bg-clip-text text-transparent">
            Kies jouw kleurthema
          </h1>
          <p className="text-gray-600 text-lg">Zachte pastel kleuren - harmonieus met de kaartweergave</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {themes.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-2xl overflow-hidden ${
                selectedTheme.id === theme.id ? 'shadow-2xl' : ''
              }`}
              style={{ 
                border: selectedTheme.id === theme.id ? `3px solid transparent` : '1px solid #e5e7eb',
                backgroundImage: selectedTheme.id === theme.id ? `linear-gradient(white, white), ${(theme as any).borderGradient}` : undefined,
                backgroundOrigin: 'border-box',
                backgroundClip: selectedTheme.id === theme.id ? 'padding-box, border-box' : undefined,
              }}
              onClick={() => setSelectedTheme(theme)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
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
                {/* Preview van de menu's */}
                <div className="space-y-4">
                  {/* Header preview */}
                  <div 
                    className="rounded-xl p-4 shadow-lg border-2 border-white/20"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: `${(theme as any).glow || '0 4px 12px rgba(0,0,0,0.1)'}, inset 0 1px 0 rgba(255,255,255,0.2)`
                    }}
                  >
                    <h3 className="text-white font-bold text-lg drop-shadow-lg">Event App</h3>
                    <p className="text-white/95 text-sm mt-1 font-medium">Moderne header met regenboog</p>
                  </div>

                  {/* Bottom navigation preview */}
                  <div 
                    className="rounded-2xl p-3 shadow-lg border-2 border-white/20"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: `${(theme as any).glow || '0 4px 12px rgba(0,0,0,0.1)'}, inset 0 1px 0 rgba(255,255,255,0.2)`
                    }}
                  >
                    <div className="flex items-center justify-around">
                      <div className="flex flex-col items-center gap-1">
                        <Map className="h-5 w-5 text-white drop-shadow-md" />
                        <span className="text-white text-xs font-semibold drop-shadow">Map</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="bg-white rounded-full p-2.5 shadow-lg border-2 border-white/40" style={{ color: theme.primary }}>
                          <PlusCircle className="h-5 w-5" />
                        </div>
                        <span className="text-white text-xs mt-1 font-semibold">Aanmaken</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Bookmark className="h-5 w-5 text-white/80 drop-shadow" />
                        <span className="text-white/90 text-xs font-medium drop-shadow">Opgeslagen</span>
                      </div>
                    </div>
                  </div>

                  {/* Tabs preview */}
                  <div 
                    className="rounded-lg overflow-hidden shadow-sm"
                    style={{ background: theme.primary }}
                  >
                    <Tabs defaultValue="all" className="w-full">
                      <TabsList className="w-full grid grid-cols-3 h-11 rounded-none bg-transparent">
                        <TabsTrigger 
                          value="all" 
                          className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/15"
                        >
                          Alle
                        </TabsTrigger>
                        <TabsTrigger 
                          value="saved" 
                          className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/15"
                        >
                          Opgeslagen
                        </TabsTrigger>
                        <TabsTrigger 
                          value="joined" 
                          className="text-white/70 data-[state=active]:text-white data-[state=active]:bg-white/15"
                        >
                          Aangemeld
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Action button */}
                  <Button 
                    className="w-full text-white font-bold border-2 border-white/20 rounded-xl"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: `${(theme as any).glow || '0 4px 12px rgba(0,0,0,0.2)'}, inset 0 1px 0 rgba(255,255,255,0.2)`
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
              background: selectedTheme.gradient,
              boxShadow: (selectedTheme as any).glow || '0 4px 20px rgba(0,0,0,0.2)'
            }}
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
