import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Map, PlusCircle, Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const themes = [
  {
    id: "sky",
    name: "Helder Hemelsblauw",
    description: "Licht en fris - modern met hoog contrast",
    primary: "#0ea5e9",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #38bdf8, #0ea5e9, #0284c7)",
    glow: "0 0 35px rgba(14, 165, 233, 0.5)",
  },
  {
    id: "ocean",
    name: "Diep Oceaanblauw",
    description: "Donker en krachtig - sterk contrast met witte tekst",
    primary: "#1e40af",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb, #1e40af)",
    glow: "0 0 35px rgba(37, 99, 235, 0.5)",
  },
  {
    id: "royal",
    name: "Koninklijk Blauw",
    description: "Klassiek en elegant - perfect contrast tussen licht en donker",
    primary: "#1d4ed8",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #60a5fa, #3b82f6, #1d4ed8)",
    glow: "0 0 35px rgba(59, 130, 246, 0.5)",
  },
  {
    id: "midnight",
    name: "Middernacht Blauw",
    description: "Zeer donker met lichte accenten - maximaal contrast",
    primary: "#1e3a8a",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #3b82f6, #1e40af, #1e3a8a)",
    glow: "0 0 35px rgba(30, 58, 138, 0.6)",
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
          <h1 className="text-4xl md:text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-800 bg-clip-text text-transparent">
            Kies jouw kleurthema
          </h1>
          <p className="text-gray-600 text-lg">Moderne blauwtinten van licht naar donker - sterk contrast met witte tekst</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {themes.map((theme) => (
            <Card 
              key={theme.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTheme.id === theme.id ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{ 
                borderColor: selectedTheme.id === theme.id ? theme.primary : undefined,
                ringColor: theme.primary 
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
                    className="rounded-lg p-4 shadow-md"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: (theme as any).glow || '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  >
                    <h3 className="text-white font-semibold text-lg drop-shadow-md">Event App</h3>
                    <p className="text-white/90 text-sm mt-1">Moderne header met gradient</p>
                  </div>

                  {/* Bottom navigation preview */}
                  <div 
                    className="rounded-lg p-3 shadow-md"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: (theme as any).glow || '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  >
                    <div className="flex items-center justify-around">
                      <div className="flex flex-col items-center gap-1">
                        <Map className="h-5 w-5 text-white" />
                        <span className="text-white text-xs">Map</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div className="bg-white rounded-full p-2" style={{ color: theme.primary }}>
                          <PlusCircle className="h-5 w-5" />
                        </div>
                        <span className="text-white text-xs mt-1">Aanmaken</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <Bookmark className="h-5 w-5 text-white/70" />
                        <span className="text-white/70 text-xs">Opgeslagen</span>
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
                    className="w-full text-white font-semibold"
                    style={{ 
                      background: theme.gradient,
                      boxShadow: (theme as any).glow || '0 4px 12px rgba(0,0,0,0.2)'
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
