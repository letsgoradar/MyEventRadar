import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X, Check, Users, Snowflake, Tag, RotateCcw } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface EventTag {
  id: number;
  name: string;
  slug: string;
  icon: string;
  group: string;
  isActive: boolean;
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
  audiences,
  themes,
  onReset,
}: {
  filters: EventFilterState;
  onFiltersChange: (filters: EventFilterState) => void;
  tags: EventTag[];
  audiences: TargetAudience[];
  themes: SeasonalTheme[];
  onReset: () => void;
}) {
  const toggleTag = (id: number) => {
    const newTagIds = filters.tagIds.includes(id)
      ? filters.tagIds.filter((t) => t !== id)
      : [...filters.tagIds, id];
    onFiltersChange({ ...filters, tagIds: newTagIds });
  };

  const toggleAudience = (id: number) => {
    if (filters.audienceIds.includes(id)) {
      const newAudienceIds = filters.audienceIds.filter((a) => a !== id);
      onFiltersChange({ ...filters, audienceIds: newAudienceIds });
    } else if (filters.audienceIds.length < 3) {
      const newAudienceIds = [...filters.audienceIds, id];
      onFiltersChange({ ...filters, audienceIds: newAudienceIds });
    }
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

  const activeFilterCount = 
    filters.tagIds.length + 
    filters.audienceIds.length + 
    filters.themeIds.length;

  return (
    <ScrollArea className="flex-1 px-4 max-h-[60vh] overflow-y-auto">

      {/* Target Audiences */}
      <FilterSection title="Voor wie" icon={Users}>
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

      {/* Event Tags by Group */}
      <FilterSection title="Type evenement" icon={Tag}>
        {Object.entries(groupedTags).map(([group, groupTags]) => (
          <div key={group} className="mb-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">{group}</h4>
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
        ))}
      </FilterSection>
    </ScrollArea>
  );
}

export function EventFilters({ filters, onFiltersChange, resultCount, isOpen, onOpenChange }: EventFiltersProps) {
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
      className="gap-2 relative"
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
    <>
      {FilterButton}
    </>
  );
}

export function FilterSidebar({ 
  filters, 
  onFiltersChange, 
  resultCount,
  isOpen,
  onClose
}: { 
  filters: EventFilterState; 
  onFiltersChange: (filters: EventFilterState) => void;
  resultCount?: number;
  isOpen: boolean;
  onClose: () => void;
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
          <IconComponent iconName={audience.icon} className="h-3 w-3" />
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
          <IconComponent iconName={theme.icon} className="h-3 w-3" />
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
          <IconComponent iconName={tag.icon} className="h-3 w-3" />
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
