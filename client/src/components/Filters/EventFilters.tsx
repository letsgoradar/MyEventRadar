import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter, SheetClose } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { SlidersHorizontal, X, Check, Calendar, Users, Snowflake, Tag, RotateCcw } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DateRangeFilter } from "./DateRangeFilter";

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
  const [showDateFilter, setShowDateFilter] = useState(false);

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

  const activeFilterCount = 
    filters.tagIds.length + 
    filters.audienceIds.length + 
    filters.themeIds.length + 
    (filters.startDate ? 1 : 0);

  return (
    <ScrollArea className="flex-1 px-4">
      {/* Quick Date Buttons */}
      <FilterSection title="Datum" icon={Calendar}>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button
            variant={!filters.startDate && !filters.endDate ? "default" : "outline"}
            size="sm"
            onClick={() => onFiltersChange({ ...filters, startDate: null, endDate: null })}
          >
            Alle data
          </Button>
          <Button
            variant={filters.startDate && !filters.endDate ? "default" : "outline"}
            size="sm"
            onClick={() => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              onFiltersChange({ ...filters, startDate: today, endDate: today });
            }}
          >
            Vandaag
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const today = new Date();
              const nextWeek = new Date(today);
              nextWeek.setDate(today.getDate() + 7);
              onFiltersChange({ ...filters, startDate: today, endDate: nextWeek });
            }}
          >
            Deze week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDateFilter(!showDateFilter)}
          >
            Kies data...
          </Button>
        </div>
        {showDateFilter && (
          <div className="mt-2 border rounded-lg p-2 bg-background">
            <DateRangeFilter
              startDate={filters.startDate}
              endDate={filters.endDate}
              onRangeChange={(start, end) => onFiltersChange({ ...filters, startDate: start, endDate: end })}
              onReset={() => onFiltersChange({ ...filters, startDate: null, endDate: null })}
              onClose={() => setShowDateFilter(false)}
            />
          </div>
        )}
      </FilterSection>

      <Separator />

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

export function EventFilters({ filters, onFiltersChange, resultCount }: EventFiltersProps) {
  const isMobile = useIsMobile();

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
    filters.themeIds.length + 
    (filters.startDate ? 1 : 0);

  const resetFilters = () => {
    onFiltersChange({
      tagIds: [],
      audienceIds: [],
      themeIds: [],
      startDate: null,
      endDate: null,
    });
  };

  const FilterButton = (
    <Button variant="outline" className="gap-2 relative">
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
      <Drawer>
        <DrawerTrigger asChild>{FilterButton}</DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
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
    <Sheet>
      <SheetTrigger asChild>{FilterButton}</SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[540px] flex flex-col">
        <SheetHeader className="border-b pb-4">
          <SheetTitle className="text-xl">Filters</SheetTitle>
        </SheetHeader>
        <FilterContent
          filters={filters}
          onFiltersChange={onFiltersChange}
          tags={tags}
          audiences={audiences}
          themes={themes}
          onReset={resetFilters}
        />
        <SheetFooter className="mt-auto">
          {FooterContent}
          <SheetClose asChild>
            <Button className="w-full">Toon resultaten</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

  const hasFilters = selectedTags.length > 0 || selectedAudiences.length > 0 || selectedThemes.length > 0 || filters.startDate;

  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap gap-1.5 py-2">
      {filters.startDate && (
        <Badge variant="secondary" className="gap-1 pr-1">
          {filters.endDate 
            ? `${filters.startDate.toLocaleDateString("nl-NL")} - ${filters.endDate.toLocaleDateString("nl-NL")}`
            : filters.startDate.toLocaleDateString("nl-NL")
          }
          <button 
            onClick={() => onFiltersChange({ ...filters, startDate: null, endDate: null })}
            className="ml-1 hover:bg-muted rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
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
