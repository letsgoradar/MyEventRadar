import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import AdminSidebar from "@/components/Layout/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tags,
  Users,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
} from "lucide-react";
import * as LucideIcons from "lucide-react";

interface EventTag {
  id: number;
  name: string;
  slug: string;
  icon: string;
  group: string;
  keywords: string[];
  parentCategory?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface TargetAudience {
  id: number;
  name: string;
  slug: string;
  icon: string;
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
}

interface SeasonalTheme {
  id: number;
  name: string;
  slug: string;
  icon: string;
  keywords: string[];
  startMonth: number | null;
  startDay: number | null;
  endMonth: number | null;
  endDay: number | null;
  isFloating: boolean;
  floatingRule: string | null;
  isActive: boolean;
  sortOrder: number;
}

const LUCIDE_ICONS = [
  "Music", "MicVocal", "Disc", "Piano", "Music2", "Headphones", "Mic", "AudioLines",
  "Theater", "Sparkles", "Laugh", "Mic2", "Baby", "Tent",
  "Film", "Frame", "Palette", "Paintbrush",
  "UtensilsCrossed", "Wine", "ChefHat", "Soup",
  "Wrench", "BookOpen", "Presentation", "Flower2", "Landmark",
  "Ticket", "PartyPopper", "Crown", "CircleDot", "Users", "GlassWater", "Ferriswheel",
  "Heart", "Sparkle",
  "Target", "Footprints", "Snowflake", "Bike",
  "MapPinned", "Trees", "Search",
  "HelpCircle", "Grid3X3", "Puzzle", "Spade",
  "Cake", "BookOpenText", "Candy",
  "Store", "Gift", "Recycle", "Building", "ShoppingCart",
  "Sun", "Home", "Gamepad2", "Lock", "Glasses", "Rainbow",
  "Star", "Egg", "Flag", "Leaf", "Flower",
];

function IconComponent({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Tags className={className} />;
  return <Icon className={className} />;
}

function KeywordEditor({ 
  keywords, 
  onChange 
}: { 
  keywords: string[]; 
  onChange: (keywords: string[]) => void 
}) {
  const [newKeyword, setNewKeyword] = useState("");

  const addKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim().toLowerCase())) {
      onChange([...keywords, newKeyword.trim().toLowerCase()]);
      setNewKeyword("");
    }
  };

  const removeKeyword = (keyword: string) => {
    onChange(keywords.filter(k => k !== keyword));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {keywords.map(keyword => (
          <Badge key={keyword} variant="secondary" className="gap-1">
            {keyword}
            <X 
              className="h-3 w-3 cursor-pointer hover:text-destructive" 
              onClick={() => removeKeyword(keyword)}
            />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Nieuw keyword..."
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
          className="flex-1"
        />
        <Button type="button" size="sm" onClick={addKeyword}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function IconSelector({ 
  value, 
  onChange 
}: { 
  value: string; 
  onChange: (icon: string) => void 
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = LUCIDE_ICONS.filter(icon => 
    icon.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <IconComponent iconName={value} className="h-4 w-4" />
          {value}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Kies een icoon</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Zoek icoon..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />
        <div className="grid grid-cols-6 gap-2 overflow-y-auto flex-1">
          {filteredIcons.map(iconName => (
            <Button
              key={iconName}
              variant={value === iconName ? "default" : "outline"}
              className="h-16 flex-col gap-1"
              onClick={() => {
                onChange(iconName);
                setOpen(false);
              }}
            >
              <IconComponent iconName={iconName} className="h-6 w-6" />
              <span className="text-xs truncate w-full text-center">{iconName}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TagForm({ 
  tag, 
  onSubmit, 
  onCancel,
  isLoading 
}: { 
  tag?: EventTag; 
  onSubmit: (data: Partial<EventTag>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(tag?.name || "");
  const [icon, setIcon] = useState(tag?.icon || "Tags");
  const [group, setGroup] = useState(tag?.group || "");
  const [keywords, setKeywords] = useState<string[]>(tag?.keywords || []);
  const [parentCategory, setParentCategory] = useState<string>(tag?.parentCategory || "none");
  const [isActive, setIsActive] = useState(tag?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      icon,
      group,
      keywords,
      parentCategory: parentCategory === "none" ? null : parentCategory,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Naam</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Groep</Label>
          <Input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="bijv. Muziek, Sport" required />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Icoon</Label>
        <IconSelector value={icon} onChange={setIcon} />
      </div>
      <div className="space-y-2">
        <Label>Categorie-override (parentCategory)</Label>
        <Select value={parentCategory} onValueChange={setParentCategory}>
          <SelectTrigger>
            <SelectValue placeholder="Geen (gebruik keyword-detectie)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Geen (gebruik keyword-detectie)</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Wanneer deze tag wordt gematcht, wordt de categorie van het evenement overschreven.</p>
      </div>
      <div className="space-y-2">
        <Label>Keywords (voor automatische matching)</Label>
        <KeywordEditor keywords={keywords} onChange={setKeywords} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label>Actief</Label>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel}>Annuleren</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tag ? "Opslaan" : "Toevoegen"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AudienceForm({ 
  audience, 
  onSubmit, 
  onCancel,
  isLoading 
}: { 
  audience?: TargetAudience; 
  onSubmit: (data: Partial<TargetAudience>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(audience?.name || "");
  const [icon, setIcon] = useState(audience?.icon || "Users");
  const [keywords, setKeywords] = useState<string[]>(audience?.keywords || []);
  const [isActive, setIsActive] = useState(audience?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      icon,
      keywords,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Naam</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Icoon</Label>
        <IconSelector value={icon} onChange={setIcon} />
      </div>
      <div className="space-y-2">
        <Label>Keywords (voor automatische matching)</Label>
        <KeywordEditor keywords={keywords} onChange={setKeywords} />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label>Actief</Label>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel}>Annuleren</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {audience ? "Opslaan" : "Toevoegen"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ThemeForm({ 
  theme, 
  onSubmit, 
  onCancel,
  isLoading 
}: { 
  theme?: SeasonalTheme; 
  onSubmit: (data: Partial<SeasonalTheme>) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [name, setName] = useState(theme?.name || "");
  const [icon, setIcon] = useState(theme?.icon || "Calendar");
  const [keywords, setKeywords] = useState<string[]>(theme?.keywords || []);
  const [startMonth, setStartMonth] = useState(theme?.startMonth?.toString() || "");
  const [startDay, setStartDay] = useState(theme?.startDay?.toString() || "");
  const [endMonth, setEndMonth] = useState(theme?.endMonth?.toString() || "");
  const [endDay, setEndDay] = useState(theme?.endDay?.toString() || "");
  const [isFloating, setIsFloating] = useState(theme?.isFloating ?? false);
  const [floatingRule, setFloatingRule] = useState(theme?.floatingRule || "");
  const [isActive, setIsActive] = useState(theme?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      icon,
      keywords,
      startMonth: startMonth ? parseInt(startMonth) : null,
      startDay: startDay ? parseInt(startDay) : null,
      endMonth: endMonth ? parseInt(endMonth) : null,
      endDay: endDay ? parseInt(endDay) : null,
      isFloating,
      floatingRule: floatingRule || null,
      isActive,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Naam</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label>Icoon</Label>
        <IconSelector value={icon} onChange={setIcon} />
      </div>
      <div className="space-y-2">
        <Label>Keywords (voor automatische matching)</Label>
        <KeywordEditor keywords={keywords} onChange={setKeywords} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <Switch checked={isFloating} onCheckedChange={setIsFloating} />
        <Label>Variabele datum (bijv. Pasen, Carnaval)</Label>
      </div>
      {isFloating ? (
        <div className="space-y-2">
          <Label>Berekeningsregel</Label>
          <Input 
            value={floatingRule} 
            onChange={(e) => setFloatingRule(e.target.value)} 
            placeholder="bijv. easter-2-weeks, carnival-period"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Start maand</Label>
            <Input type="number" min="1" max="12" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Start dag</Label>
            <Input type="number" min="1" max="31" value={startDay} onChange={(e) => setStartDay(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Eind maand</Label>
            <Input type="number" min="1" max="12" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Eind dag</Label>
            <Input type="number" min="1" max="31" value={endDay} onChange={(e) => setEndDay(e.target.value)} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Switch checked={isActive} onCheckedChange={setIsActive} />
        <Label>Actief</Label>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel}>Annuleren</Button>
        </DialogClose>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {theme ? "Opslaan" : "Toevoegen"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function TagManager() {
  const { toast } = useToast();
  const [editingTag, setEditingTag] = useState<EventTag | null>(null);
  const [editingAudience, setEditingAudience] = useState<TargetAudience | null>(null);
  const [editingTheme, setEditingTheme] = useState<SeasonalTheme | null>(null);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [isAddingAudience, setIsAddingAudience] = useState(false);
  const [isAddingTheme, setIsAddingTheme] = useState(false);

  const { data: tags = [], isLoading: tagsLoading } = useQuery<EventTag[]>({
    queryKey: ["/api/event-tags"],
  });

  const { data: audiences = [], isLoading: audiencesLoading } = useQuery<TargetAudience[]>({
    queryKey: ["/api/target-audiences"],
  });

  const { data: themes = [], isLoading: themesLoading } = useQuery<SeasonalTheme[]>({
    queryKey: ["/api/seasonal-themes"],
  });

  const createTagMutation = useMutation({
    mutationFn: (data: Partial<EventTag>) => apiRequest("POST", "/api/admin/event-tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-tags"] });
      setIsAddingTag(false);
      toast({ title: "Tag toegevoegd" });
    },
    onError: () => toast({ title: "Fout bij toevoegen", variant: "destructive" }),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EventTag> }) => 
      apiRequest("PATCH", `/api/admin/event-tags/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-tags"] });
      setEditingTag(null);
      toast({ title: "Tag bijgewerkt" });
    },
    onError: () => toast({ title: "Fout bij opslaan", variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/event-tags/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/event-tags"] });
      toast({ title: "Tag verwijderd" });
    },
    onError: () => toast({ title: "Fout bij verwijderen", variant: "destructive" }),
  });

  const createAudienceMutation = useMutation({
    mutationFn: (data: Partial<TargetAudience>) => apiRequest("POST", "/api/admin/target-audiences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-audiences"] });
      setIsAddingAudience(false);
      toast({ title: "Doelgroep toegevoegd" });
    },
    onError: () => toast({ title: "Fout bij toevoegen", variant: "destructive" }),
  });

  const updateAudienceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TargetAudience> }) => 
      apiRequest("PATCH", `/api/admin/target-audiences/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-audiences"] });
      setEditingAudience(null);
      toast({ title: "Doelgroep bijgewerkt" });
    },
    onError: () => toast({ title: "Fout bij opslaan", variant: "destructive" }),
  });

  const deleteAudienceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/target-audiences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-audiences"] });
      toast({ title: "Doelgroep verwijderd" });
    },
    onError: () => toast({ title: "Fout bij verwijderen", variant: "destructive" }),
  });

  const createThemeMutation = useMutation({
    mutationFn: (data: Partial<SeasonalTheme>) => apiRequest("POST", "/api/admin/seasonal-themes", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasonal-themes"] });
      setIsAddingTheme(false);
      toast({ title: "Thema toegevoegd" });
    },
    onError: () => toast({ title: "Fout bij toevoegen", variant: "destructive" }),
  });

  const updateThemeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SeasonalTheme> }) => 
      apiRequest("PATCH", `/api/admin/seasonal-themes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasonal-themes"] });
      setEditingTheme(null);
      toast({ title: "Thema bijgewerkt" });
    },
    onError: () => toast({ title: "Fout bij opslaan", variant: "destructive" }),
  });

  const deleteThemeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/seasonal-themes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/seasonal-themes"] });
      toast({ title: "Thema verwijderd" });
    },
    onError: () => toast({ title: "Fout bij verwijderen", variant: "destructive" }),
  });

  const groupedTags = tags.reduce((acc, tag) => {
    if (!acc[tag.group]) acc[tag.group] = [];
    acc[tag.group].push(tag);
    return acc;
  }, {} as Record<string, EventTag[]>);

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6">Tag Manager</h1>
        <p className="text-muted-foreground mb-6">
          Beheer event tags, doelgroepen en seizoensthema's. Keywords worden automatisch gebruikt om events te taggen bij import.
        </p>

        <Tabs defaultValue="tags">
          <TabsList className="mb-4">
            <TabsTrigger value="tags" className="gap-2">
              <Tags className="h-4 w-4" />
              Tags ({tags.length})
            </TabsTrigger>
            <TabsTrigger value="audiences" className="gap-2">
              <Users className="h-4 w-4" />
              Doelgroepen ({audiences.length})
            </TabsTrigger>
            <TabsTrigger value="themes" className="gap-2">
              <Calendar className="h-4 w-4" />
              Thema's ({themes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tags">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Event Tags</CardTitle>
                <Dialog open={isAddingTag} onOpenChange={setIsAddingTag}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Nieuwe Tag</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nieuwe Tag</DialogTitle>
                    </DialogHeader>
                    <TagForm 
                      onSubmit={(data) => createTagMutation.mutate(data)}
                      onCancel={() => setIsAddingTag(false)}
                      isLoading={createTagMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {tagsLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  Object.entries(groupedTags).map(([group, groupTags]) => (
                    <div key={group} className="mb-6">
                      <h3 className="font-semibold text-lg mb-2">{group}</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12">Icoon</TableHead>
                            <TableHead>Naam</TableHead>
                            <TableHead>Categorie-override</TableHead>
                            <TableHead>Keywords</TableHead>
                            <TableHead className="w-20">Status</TableHead>
                            <TableHead className="w-24">Acties</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {groupTags.map(tag => (
                            <TableRow key={tag.id}>
                              <TableCell>
                                <IconComponent iconName={tag.icon} className="h-5 w-5" />
                              </TableCell>
                              <TableCell className="font-medium">{tag.name}</TableCell>
                              <TableCell>
                                {tag.parentCategory ? (
                                  <Badge variant="outline" className="text-xs font-medium">{tag.parentCategory}</Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">—</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1 max-w-md">
                                  {tag.keywords.slice(0, 5).map(kw => (
                                    <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                                  ))}
                                  {tag.keywords.length > 5 && (
                                    <Badge variant="secondary" className="text-xs">+{tag.keywords.length - 5}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {tag.isActive ? (
                                  <Badge variant="default"><Check className="h-3 w-3" /></Badge>
                                ) : (
                                  <Badge variant="secondary">Inactief</Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Dialog open={editingTag?.id === tag.id} onOpenChange={(open) => !open && setEditingTag(null)}>
                                    <DialogTrigger asChild>
                                      <Button size="sm" variant="ghost" onClick={() => setEditingTag(tag)}>
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>Tag bewerken</DialogTitle>
                                      </DialogHeader>
                                      <TagForm 
                                        tag={editingTag || undefined}
                                        onSubmit={(data) => updateTagMutation.mutate({ id: tag.id, data })}
                                        onCancel={() => setEditingTag(null)}
                                        isLoading={updateTagMutation.isPending}
                                      />
                                    </DialogContent>
                                  </Dialog>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="sm" variant="ghost" className="text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Tag verwijderen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Weet je zeker dat je "{tag.name}" wilt verwijderen?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteTagMutation.mutate(tag.id)}>
                                          Verwijderen
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audiences">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Doelgroepen</CardTitle>
                <Dialog open={isAddingAudience} onOpenChange={setIsAddingAudience}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Nieuwe Doelgroep</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nieuwe Doelgroep</DialogTitle>
                    </DialogHeader>
                    <AudienceForm 
                      onSubmit={(data) => createAudienceMutation.mutate(data)}
                      onCancel={() => setIsAddingAudience(false)}
                      isLoading={createAudienceMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {audiencesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Icoon</TableHead>
                        <TableHead>Naam</TableHead>
                        <TableHead>Keywords</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-24">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audiences.map(audience => (
                        <TableRow key={audience.id}>
                          <TableCell>
                            <IconComponent iconName={audience.icon} className="h-5 w-5" />
                          </TableCell>
                          <TableCell className="font-medium">{audience.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-md">
                              {audience.keywords.map(kw => (
                                <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {audience.isActive ? (
                              <Badge variant="default"><Check className="h-3 w-3" /></Badge>
                            ) : (
                              <Badge variant="secondary">Inactief</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog open={editingAudience?.id === audience.id} onOpenChange={(open) => !open && setEditingAudience(null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingAudience(audience)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Doelgroep bewerken</DialogTitle>
                                  </DialogHeader>
                                  <AudienceForm 
                                    audience={editingAudience || undefined}
                                    onSubmit={(data) => updateAudienceMutation.mutate({ id: audience.id, data })}
                                    onCancel={() => setEditingAudience(null)}
                                    isLoading={updateAudienceMutation.isPending}
                                  />
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Doelgroep verwijderen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Weet je zeker dat je "{audience.name}" wilt verwijderen?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteAudienceMutation.mutate(audience.id)}>
                                      Verwijderen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="themes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Seizoensthema's</CardTitle>
                <Dialog open={isAddingTheme} onOpenChange={setIsAddingTheme}>
                  <DialogTrigger asChild>
                    <Button><Plus className="mr-2 h-4 w-4" /> Nieuw Thema</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Nieuw Thema</DialogTitle>
                    </DialogHeader>
                    <ThemeForm 
                      onSubmit={(data) => createThemeMutation.mutate(data)}
                      onCancel={() => setIsAddingTheme(false)}
                      isLoading={createThemeMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {themesLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Icoon</TableHead>
                        <TableHead>Naam</TableHead>
                        <TableHead>Periode</TableHead>
                        <TableHead>Keywords</TableHead>
                        <TableHead className="w-20">Status</TableHead>
                        <TableHead className="w-24">Acties</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {themes.map(theme => (
                        <TableRow key={theme.id}>
                          <TableCell>
                            <IconComponent iconName={theme.icon} className="h-5 w-5" />
                          </TableCell>
                          <TableCell className="font-medium">{theme.name}</TableCell>
                          <TableCell>
                            {theme.isFloating ? (
                              <Badge variant="secondary">{theme.floatingRule}</Badge>
                            ) : theme.startMonth && theme.endMonth ? (
                              <span className="text-sm">
                                {theme.startDay}/{theme.startMonth} - {theme.endDay}/{theme.endMonth}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {theme.keywords.slice(0, 3).map(kw => (
                                <Badge key={kw} variant="outline" className="text-xs">{kw}</Badge>
                              ))}
                              {theme.keywords.length > 3 && (
                                <Badge variant="secondary" className="text-xs">+{theme.keywords.length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {theme.isActive ? (
                              <Badge variant="default"><Check className="h-3 w-3" /></Badge>
                            ) : (
                              <Badge variant="secondary">Inactief</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Dialog open={editingTheme?.id === theme.id} onOpenChange={(open) => !open && setEditingTheme(null)}>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingTheme(theme)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Thema bewerken</DialogTitle>
                                  </DialogHeader>
                                  <ThemeForm 
                                    theme={editingTheme || undefined}
                                    onSubmit={(data) => updateThemeMutation.mutate({ id: theme.id, data })}
                                    onCancel={() => setEditingTheme(null)}
                                    isLoading={updateThemeMutation.isPending}
                                  />
                                </DialogContent>
                              </Dialog>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Thema verwijderen?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Weet je zeker dat je "{theme.name}" wilt verwijderen?
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteThemeMutation.mutate(theme.id)}>
                                      Verwijderen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
