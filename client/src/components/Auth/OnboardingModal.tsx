import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ChevronRight, Check, Tag, AlertCircle } from "lucide-react";
import type { LucideProps } from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { ComponentType } from "react";
import { useToast } from "@/hooks/use-toast";

interface EventTag {
  id: number;
  name: string;
  icon: string;
  group: string;
}

interface PopularTag {
  tagId: number;
  tagName: string;
  count: number;
}

interface TargetAudience {
  id: number;
  name: string;
  icon: string;
}

const lucideIconMap = LucideIcons as Record<string, ComponentType<LucideProps>>;

function IconComponent({ iconName, className }: { iconName: string; className?: string }) {
  const Icon = lucideIconMap[iconName];
  if (!Icon) return <Tag className={className} />;
  return <Icon className={className} />;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (tagIds: number[], audienceIds: number[]) => void;
}

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(1);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedAudienceIds, setSelectedAudienceIds] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const { toast } = useToast();

  const { data: popularTagsData = [] } = useQuery<PopularTag[]>({
    queryKey: ["/api/events/popular-tags"],
    enabled: isOpen,
  });

  const { data: allTags = [] } = useQuery<EventTag[]>({
    queryKey: ["/api/event-tags"],
    enabled: isOpen,
  });

  const { data: audiences = [] } = useQuery<TargetAudience[]>({
    queryKey: ["/api/target-audiences"],
    enabled: isOpen,
  });

  const popularTagIds = popularTagsData.map(p => p.tagId);
  const tagMap = new Map(allTags.map(t => [t.id, t]));
  const tagsForStep1: EventTag[] = popularTagIds.length > 0
    ? popularTagIds
        .map(id => tagMap.get(id))
        .filter((t): t is EventTag => t !== undefined)
        .slice(0, 12)
    : allTags.slice(0, 12);

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleAudience = (id: number) => {
    setSelectedAudienceIds(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const savePreferences = async (tagIds: number[], audienceIds: number[]) => {
    await apiRequest("/api/user/preferences", {
      method: "PATCH",
      data: {
        preferredTagIds: tagIds,
        preferredAudienceIds: audienceIds,
        onboardingCompleted: true,
      },
    });
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  const handleComplete = async () => {
    setIsSaving(true);
    setSaveError(false);
    try {
      await savePreferences(selectedTagIds, selectedAudienceIds);
      onComplete?.(selectedTagIds, selectedAudienceIds);
      onClose();
    } catch {
      setSaveError(true);
      toast({
        title: "Opslaan mislukt",
        description: "We konden je voorkeuren niet opslaan. Probeer het opnieuw.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaveError(false);
    try {
      await savePreferences([], []);
    } catch {
    }
    onComplete?.([], []);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-sm bg-background rounded-2xl shadow-xl border border-border p-6 animate-in fade-in zoom-in-95 duration-200">

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-5">
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
        </div>

        {/* Step 1: Tags */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Wat vind jij leuk?</h2>
              <p className="text-sm text-muted-foreground">Selecteer je favoriete type evenementen (optioneel)</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {tagsForStep1.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted hover:border-primary/50"
                    }`}
                  >
                    <IconComponent iconName={tag.icon} className="h-3.5 w-3.5" />
                    {tag.name}
                    {selected && <Check className="h-3 w-3 ml-0.5" />}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSkip}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Sla over
              </button>
              <Button onClick={() => setStep(2)} className="gap-2">
                Volgende
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Audiences */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold">Voor wie zoek jij events?</h2>
              <p className="text-sm text-muted-foreground">Kies je doelgroep (optioneel, overslaan mag)</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {audiences.map((audience) => {
                const selected = selectedAudienceIds.includes(audience.id);
                return (
                  <button
                    key={audience.id}
                    onClick={() => toggleAudience(audience.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50 hover:bg-muted"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      selected ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      <IconComponent iconName={audience.icon} className="h-4 w-4" />
                    </div>
                    {audience.name}
                  </button>
                );
              })}
            </div>

            {saveError && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Opslaan mislukt. Controleer je verbinding en probeer opnieuw.
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Terug
              </button>
              <Button onClick={handleComplete} disabled={isSaving} className="gap-2">
                {isSaving ? "Opslaan..." : "Klaar!"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
