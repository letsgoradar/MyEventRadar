import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Map, PlusCircle, Bookmark } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const themes = [
  {
    id: "blue",
    name: "Modern Blauw",
    description: "Professioneel en vertrouwenwekkend - perfect voor community platforms",
    primary: "#2563eb",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #2563eb, #1d4ed8)",
  },
  {
    id: "green",
    name: "Energie Groen",
    description: "Fris en energiek - ideaal voor actieve communities en duurzaamheid",
    primary: "#10b981",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    id: "orange",
    name: "Warm Oranje",
    description: "Uitnodigend en energiek - creëert een warme, toegankelijke sfeer",
    primary: "#f97316",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
  },
  {
    id: "purple",
    name: "Premium Paars",
    description: "Creatief en luxe - onderscheidend en modern",
    primary: "#9333ea",
    variant: "vibrant" as const,
    gradient: "linear-gradient(135deg, #9333ea, #7c3aed)",
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
          <h1 className="text-4xl font-bold mb-2">Kies jouw kleurthema</h1>
          <p className="text-gray-600">Selecteer het thema dat het beste bij jouw event platform past</p>
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
                    style={{ background: theme.gradient }}
                  >
                    <h3 className="text-white font-semibold text-lg">Event App</h3>
                    <p className="text-white/80 text-sm mt-1">Moderne header met gradient</p>
                  </div>

                  {/* Bottom navigation preview */}
                  <div 
                    className="rounded-lg p-3 shadow-md"
                    style={{ background: theme.gradient }}
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
                    className="w-full text-white font-semibold shadow-md"
                    style={{ background: theme.gradient }}
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
            className="text-white font-semibold px-8 shadow-lg"
            style={{ background: selectedTheme.gradient }}
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
