import { useLanguage, Language } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const flags: Record<Language, { flag: string; name: string }> = {
  nl: { flag: "🇳🇱", name: "Nederlands" },
  en: { flag: "🇬🇧", name: "English" },
  de: { flag: "🇩🇪", name: "Deutsch" },
};

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 gap-1.5"
          data-testid="language-switcher"
        >
          <span className="text-lg">{flags[language].flag}</span>
          <Globe className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {(Object.keys(flags) as Language[]).map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`cursor-pointer ${language === lang ? "bg-accent" : ""}`}
            data-testid={`language-option-${lang}`}
          >
            <span className="text-lg mr-2">{flags[lang].flag}</span>
            <span>{flags[lang].name}</span>
            {language === lang && (
              <span className="ml-auto text-primary">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
