import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X, Check, Users, Snowflake, Tag, RotateCcw, Flame, Search, PersonStanding } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventTag {
  id: number;
  name: string;
  slug: string;
  icon: string;
  group: string;
  isActive: boolean;
  eventCount?: number;
}

interface TargetAudience {
  id: number;
  name: string;
  slug: string;
  icon: string;
  isActive: boolean;
}

interface SeasonalTheme {
  id: number;
  name: string;
  slug: string;
  icon: string;
  isActive: boolean;
}

export interface EventFilterState {
  tagIds: number[];
  audienceIds: number[];
  themeIds: number[];
  startDate: Date | null;
  endDate: Date | null;
}

interface EventFiltersProps {
  filters: EventFilterState;
  onFiltersChange: (filters: EventFilterState) => void;
  resultCount?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  userLat?: number;
  userLng?: number;
  userRadius?: number;
}

function IconComponent({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Tag className={className} />;
  return <Icon className={className} />;
}

function FilterChip({ 
  item, 
  isSelected, 
  onClick 
}: { 
  item: { id: number; name: string; icon: string }; 
  isSelected: boolean; 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all min-w-[80px] ${
        isSelected 
          ? "border-primary bg-primary/10 text-primary" 
          : "border-border hover:border-primary/50 hover:bg-muted"
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 ${
        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
      }`}>
        <IconComponent iconName={item.icon} className="h-5 w-5" />
      </div>
      <span className="text-xs font-medium text-center leading-tight">{item.name}</span>
      {isSelected && (
        <Check className="h-3 w-3 mt-1 text-primary" />
      )}
    </button>
  );
}

function FilterSection({ 
  title, 
  icon: Icon, 
  children 
}: { 
  title: string; 
  icon: any; 
  children: React.ReactNode 
}) {
  return (
    <div className="py-4">
      <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </h3>
      {children}
    </div>
  );
}

function FilterContent({
  filters,
  onFiltersChange,
  tags,
  popularTags,
  audiences,
  themes,
  onReset,
}: {
  filters: EventFilterState;
  onFiltersChange: (filters: EventFilterState) => void;
  tags: EventTag[];
  popularTags: EventTag[];
  audiences: TargetAudience[];
  themes: SeasonalTheme[];
  onReset: () => void;
}) {
  const [tagSearch, setTagSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const toggleTag = (id: number) => {
    const newTagIds = filters.tagIds.includes(id)
      ? filters.tagIds.filter((t) => t !== id)
      : [...filters.tagIds, id];
    onFiltersChange({ ...filters, tagIds: newTagIds });
  };

  const toggleAudience = (id: number) => {
    const newAudienceIds = filters.audienceIds.includes(id)
      ? filters.audienceIds.filter((a) => a !== id)
      : [...filters.audienceIds, id];
    onFiltersChange({ ...filters, audienceIds: newAudienceIds });
  };

  const toggleTheme = (id: number) => {
    const newThemeIds = filters.themeIds.includes(id)
      ? filters.themeIds.filter((t) => t !== id)
      : [...filters.themeIds, id];
    onFiltersChange({ ...filters, themeIds: newThemeIds });
  };

  const groupedTags = tags.reduce((acc, tag) => {
    if (!acc[tag.group]) acc[tag.group] = [];
    acc[tag.group].push(tag);
    return acc;
  }, {} as Record<string, EventTag[]>);

  // Toggle all tags in a group: select all if not all selected, otherwise deselect all
  const toggleGroup = (groupTags: EventTag[]) => {
    const groupIds = groupTags.map((t) => t.id);
    const allSelected = groupIds.every((id) => filters.tagIds.includes(id));
    const newTagIds = allSelected
      ? filters.tagIds.filter((id) => !groupIds.includes(id))
      : Array.from(new Set([...filters.tagIds, ...groupIds]));
    onFiltersChange({ ...filters, tagIds: newTagIds });
  };

  // Smarter search: match on tag name OR group name, sort by eventCount
  const searchResults = tagSearch.trim()
    ? tags
        .filter(t => {
          const q = tagSearch.toLowerCase();
          return t.name.toLowerCase().includes(q) || t.group.toLowerCase().includes(q);
        })
        .sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
        .slice(0, 8)
    : [];

  // Suggestions when search field is focused but empty: top popular tags not yet selected
  const suggestions = !tagSearch.trim() && searchFocused
    ? [...tags]
        .sort((a, b) => (b.eventCount ?? 0) - (a.eventCount ?? 0))
        .filter((t) => !filters.tagIds.includes(t.id))
        .slice(0, 5)
    : [];

  return (
    <ScrollArea className="flex-1 px-4 max-h-[60vh] overflow-y-auto">

      {/* Popular Tags */}
      {popularTags.length > 0 && (
        <>
          <FilterSection title="Populaire filters" icon={Flame}>
            <div className="flex flex-wrap gap-2">
              {popularTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                    filters.tagIds.includes(tag.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  <IconComponent iconName={tag.icon} className="h-3.5 w-3.5" />
                  {tag.name}
                </button>
              ))}
            </div>
          </FilterSection>
          <Separator />
        </>
      )}

      {/* Gezelschap (replaces "Voor wie") */}
      <FilterSection title="Gezelschap" icon={PersonStanding}>
        <div className="flex flex-wrap gap-2">
          {audiences.map((audience) => (
            <FilterChip
              key={audience.id}
              item={audience}
              isSelected={filters.audienceIds.includes(audience.id)}
              onClick={() => toggleAudience(audience.id)}
            />
          ))}
        </div>
      </FilterSection>

      <Separator />

      {/* Seasonal Themes */}
      {themes.length > 0 && (
        <>
          <FilterSection title="Seizoen & thema" icon={Snowflake}>
            <div className="flex flex-wrap gap-2">
              {themes.map((theme) => (
                <FilterChip
                  key={theme.id}
                  item={theme}
                  isSelected={filters.themeIds.includes(theme.id)}
                  onClick={() => toggleTheme(theme.id)}
                />
              ))}
            </div>
          </FilterSection>
          <Separator />
        </>
      )}

      {/* Tag search with smart suggestions */}
      <FilterSection title="Zoeken" icon={Search}>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Bijv. 'muziek', 'theater', 'wandelen'..."
            value={tagSearch}
            onChange={(e) => setTagSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
          />
          {tagSearch && (
            <button
              onClick={() => setTagSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {/* Search results */}
        {tagSearch.trim() && searchResults.length === 0 && (
          <p className="text-sm text-muted-foreground">Geen tags gevonden voor "{tagSearch}"</p>
        )}
        {searchResults.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {searchResults.map((tag) => (
              <button
                key={tag.id}
                onClick={() => { toggleTag(tag.id); setTagSearch(""); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all border ${
                  filters.tagIds.includes(tag.id)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border hover:border-primary/50 hover:bg-muted"
                }`}
              >
                <IconComponent iconName={tag.icon} className="h-3.5 w-3.5" />
                <span>{tag.name}</span>
                <span className="text-xs opacity-60">({tag.group})</span>
                {filters.tagIds.includes(tag.id) && <Check className="h-3 w-3" />}
              </button>
            ))}
          </div>
        )}
        {/* Popular suggestions when focused but empty */}
        {suggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">Populaire tags</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm bg-muted hover:bg-muted/80 transition-all"
                >
                  <IconComponent iconName={tag.icon} className="h-3.5 w-3.5" />
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </FilterSection>

      <Separator />

      {/* Event Tags by Group — group header is clickable to select/deselect all */}
      <FilterSection title="Type evenement" icon={Tag}>
        {Object.entries(groupedTags).map(([group, groupTags]) => {
          const groupIds = groupTags.map((t) => t.id);
          const selectedCount = groupIds.filter((id) => filters.tagIds.includes(id)).length;
          const allSelected = selectedCount === groupIds.length;
          const someSelected = selectedCount > 0 && !allSelected;

          return (
            <div key={group} className="mb-4">
              <button
                onClick={() => toggleGroup(groupTags)}
                className={`flex items-center gap-1.5 mb-2 w-full text-left group ${
                  allSelected
                    ? "text-primary"
                    : someSelected
                    ? "text-primary/70"
                    : "text-muted-foreground"
                }`}
              >
                <span className={`text-sm font-semibold transition-colors ${
                  allSelected || someSelected ? "text-primary" : "text-foreground/70 group-hover:text-foreground"
                }`}>
                  {group}
                </span>
                {someSelected && (
                  <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                    {selectedCount}/{groupIds.length}
                  </span>
                )}
                {allSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                {!allSelected && (
                  <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    alles selecteren
                  </span>
                )}
              </button>
              <div className="flex flex-wrap gap-2">
                {groupTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                      filters.tagIds.includes(tag.id)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    <IconComponent iconName={tag.icon} className="h-3.5 w-3.5" />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </FilterSection>
    </ScrollArea>
  );
}

export function EventFilters({ filters, onFiltersChange, resultCount, isOpen, onOpenChange, userLat, userLng, userRadius }: EventFiltersProps) {
  const isMobile = useIsMobile();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange || setInternalOpen;

  const { data: tags = [] } = useQuery<EventTag[]>({
    queryKey: ["/api/event-tags"],
  });

  const { data: audiences = [] } = useQuery<TargetAudience[]>({
    queryKey: ["/api/target-audiences"],
  });

  const { data: themes = [] } = useQuery<SeasonalTheme[]>({
    queryKey: ["/api/seasonal-themes"],
  });

  const popularTagsKey = userLat && userLng
    ? [`/api/events/popular-tags`, userLat, userLng, userRadius ?? 25]
    : ["/api/events/popular-tags"];

  const { data: popularTags = [] } = useQuery<EventTag[]>({
    queryKey: popularTagsKey,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "8" });
      if (userLat && userLng) {
        params.set("lat", String(userLat));
        params.set("lng", String(userLng));
        params.set("radius", String(userRadius ?? 25));
      }
      const res = await fetch(`/api/events/popular-tags?${params}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeFilterCount = 
    filters.tagIds.length + 
    filters.audienceIds.length + 
    filters.themeIds.length;

  const resetFilters = () => {
    onFiltersChange({
      ...filters,
      tagIds: [],
      audienceIds: [],
      themeIds: [],
    });
  };

  const FilterButton = (
    <Button 
      variant="outline" 
      className="gap-2 relative h-10"
      onClick={() => setOpen(!open)}
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filters</span>
      {activeFilterCount > 0 && (
        <Badge variant="default" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
          {activeFilterCount}
        </Badge>
      )}
    </Button>
  );

  const FooterContent = (
    <div className="flex items-center justify-between w-full gap-4 pt-4 border-t">
      <Button variant="ghost" onClick={resetFilters} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Alles wissen
      </Button>
      {resultCount !== undefined && (
        <span className="text-sm text-muted-foreground">
          {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"}
        </span>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{FilterButton}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh] flex flex-col">
          <DrawerHeader className="border-b pb-4">
            <DrawerTitle className="text-xl">Filters</DrawerTitle>
          </DrawerHeader>
          <FilterContent
            filters={filters}
            onFiltersChange={onFiltersChange}
            tags={tags}
            popularTags={popularTags}
            audiences={audiences}
            themes={themes}
            onReset={resetFilters}
          />
          <DrawerFooter>
            {FooterContent}
            <DrawerClose asChild>
              <Button className="w-full">Toon resultaten</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{FilterButton}</SheetTrigger>
      <SheetContent side="right" className="w-[400px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-xl">Filters</SheetTitle>
        </SheetHeader>
        <FilterContent
          filters={filters}
          onFiltersChange={onFiltersChange}
          tags={tags}
          popularTags={popularTags}
          audiences={audiences}
          themes={themes}
          onReset={resetFilters}
        />
        <SheetFooter className="px-6 py-4">
          {FooterContent}
          <SheetClose asChild>
            <Button className="w-full mt-2">Toon resultaten</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function FilterSidebar({ 
  filters, 
  onFiltersChange, 
  resultCount,
  isOpen,
  onClose,
  userLat,
  userLng,
  userRadius,
}: { 
  filters: EventFilterState; 
  onFiltersChange: (filters: EventFilterState) => void;
  resultCount?: number;
  isOpen: boolean;
  onClose: () => void;
  userLat?: number;
  userLng?: number;
  userRadius?: number;
}) {
  const { data: tags = [] } = useQuery<EventTag[]>({
    queryKey: ["/api/event-tags"],
  });

  const { data: audiences = [] } = useQuery<TargetAudience[]>({
    queryKey: ["/api/target-audiences"],
  });

  const { data: themes = [] } = useQuery<SeasonalTheme[]>({
    queryKey: ["/api/seasonal-themes"],
  });

  const { data: popularTags = [] } = useQuery<EventTag[]>({
    queryKey: ["/api/events/popular-tags"],
    staleTime: 5 * 60 * 1000,
  });

  const resetFilters = () => {
    onFiltersChange({
      ...filters,
      tagIds: [],
      audienceIds: [],
      themeIds: [],
    });
  };

  return (
    <div 
      className={`absolute top-0 right-0 h-full w-[380px] bg-background border-l shadow-lg z-[90] transition-transform duration-300 ease-in-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-semibold">Filters</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <FilterContent
        filters={filters}
        onFiltersChange={onFiltersChange}
        tags={tags}
        popularTags={popularTags}
        audiences={audiences}
        themes={themes}
        onReset={resetFilters}
      />
      
      <div className="p-4 border-t mt-auto">
        <div className="flex items-center justify-between w-full gap-4 mb-3">
          <Button variant="ghost" onClick={resetFilters} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Alles wissen
          </Button>
          {resultCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {resultCount} {resultCount === 1 ? "resultaat" : "resultaten"}
            </span>
          )}
        </div>
        <Button className="w-full" onClick={onClose}>
          Toon resultaten
        </Button>
      </div>
    </div>
  );
}

function IconComponentLocal({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = (LucideIcons as any)[iconName];
  if (!Icon) return <Tag className={className} />;
  return <Icon className={className} />;
}

export function ActiveFilterBadges({ 
  filters, 
  onFiltersChange 
}: { 
  filters: EventFilterState; 
  onFiltersChange: (filters: EventFilterState) => void 
}) {
  const { data: tags = [] } = useQuery<EventTag[]>({
    queryKey: ["/api/event-tags"],
  });

  const { data: audiences = [] } = useQuery<TargetAudience[]>({
    queryKey: ["/api/target-audiences"],
  });

  const { data: themes = [] } = useQuery<SeasonalTheme[]>({
    queryKey: ["/api/seasonal-themes"],
  });

  const selectedTags = tags.filter((t) => filters.tagIds.includes(t.id));
  const selectedAudiences = audiences.filter((a) => filters.audienceIds.includes(a.id));
  const selectedThemes = themes.filter((t) => filters.themeIds.includes(t.id));

  const hasFilters = selectedTags.length > 0 || selectedAudiences.length > 0 || selectedThemes.length > 0;

  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {selectedAudiences.map((audience) => (
        <Badge key={audience.id} variant="secondary" className="gap-1 pr-1">
          <IconComponentLocal iconName={audience.icon} className="h-3 w-3" />
          {audience.name}
          <button 
            onClick={() => onFiltersChange({ 
              ...filters, 
              audienceIds: filters.audienceIds.filter((id) => id !== audience.id) 
            })}
            className="ml-1 hover:bg-muted rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {selectedThemes.map((theme) => (
        <Badge key={theme.id} variant="secondary" className="gap-1 pr-1">
          <IconComponentLocal iconName={theme.icon} className="h-3 w-3" />
          {theme.name}
          <button 
            onClick={() => onFiltersChange({ 
              ...filters, 
              themeIds: filters.themeIds.filter((id) => id !== theme.id) 
            })}
            className="ml-1 hover:bg-muted rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {selectedTags.map((tag) => (
        <Badge key={tag.id} variant="secondary" className="gap-1 pr-1">
          <IconComponentLocal iconName={tag.icon} className="h-3 w-3" />
          {tag.name}
          <button 
            onClick={() => onFiltersChange({ 
              ...filters, 
              tagIds: filters.tagIds.filter((id) => id !== tag.id) 
            })}
            className="ml-1 hover:bg-muted rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
