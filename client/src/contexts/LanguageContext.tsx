import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "nl" | "en" | "de";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  nl: {
    "nav.home": "Home",
    "nav.events": "Evenementen",
    "nav.saved": "Opgeslagen",
    "nav.profile": "Profiel",
    "nav.myEvents": "Mijn Evenementen",
    "nav.create": "Nieuw Evenement",
    "nav.search": "Zoeken",
    "nav.login": "Inloggen",
    "nav.register": "Registreren",
    "nav.logout": "Uitloggen",
    "event.startingSoon": "Begint binnenkort",
    "event.participants": "deelnemers",
    "event.free": "Gratis",
    "event.paid": "Betaald",
    "event.join": "Deelnemen",
    "event.leave": "Verlaten",
    "event.save": "Opslaan",
    "event.saved": "Opgeslagen",
    "event.share": "Delen",
    "event.location": "Locatie",
    "event.date": "Datum",
    "event.time": "Tijd",
    "event.description": "Beschrijving",
    "event.organizer": "Organisator",
    "event.category": "Categorie",
    "filter.all": "Alle",
    "filter.today": "Vandaag",
    "filter.thisWeek": "Deze week",
    "filter.thisMonth": "Deze maand",
    "filter.radius": "Straal",
    "map.view": "Kaart",
    "list.view": "Lijst",
    "search.placeholder": "Zoek evenementen...",
    "search.noResults": "Geen evenementen gevonden",
    "categories.tentoonstelling": "Tentoonstelling",
    "categories.voorstelling": "Theater, Dans & Film",
    "categories.activiteit": "Rondleiding & Uitstap",
    "categories.stappenborrel": "Feest & Nachtleven",
    "categories.marktbeurs": "Markt & Beurs",
    "categories.quizspelletjes": "Quiz & Spelletjes",
    "categories.lerenontdekken": "Cursus & Workshop",
    "categories.etendrinken": "Eten & Drinken",
  },
  en: {
    "nav.home": "Home",
    "nav.events": "Events",
    "nav.saved": "Saved",
    "nav.profile": "Profile",
    "nav.myEvents": "My Events",
    "nav.create": "New Event",
    "nav.search": "Search",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.logout": "Logout",
    "event.startingSoon": "Starting soon",
    "event.participants": "participants",
    "event.free": "Free",
    "event.paid": "Paid",
    "event.join": "Join",
    "event.leave": "Leave",
    "event.save": "Save",
    "event.saved": "Saved",
    "event.share": "Share",
    "event.location": "Location",
    "event.date": "Date",
    "event.time": "Time",
    "event.description": "Description",
    "event.organizer": "Organizer",
    "event.category": "Category",
    "filter.all": "All",
    "filter.today": "Today",
    "filter.thisWeek": "This week",
    "filter.thisMonth": "This month",
    "filter.radius": "Radius",
    "map.view": "Map",
    "list.view": "List",
    "search.placeholder": "Search events...",
    "search.noResults": "No events found",
    "categories.tentoonstelling": "Exhibition",
    "categories.voorstelling": "Performance",
    "categories.activiteit": "Activity",
    "categories.stappenborrel": "Going Out",
    "categories.marktbeurs": "Market & Fair",
    "categories.quizspelletjes": "Quiz & Games",
    "categories.lerenontdekken": "Learn & Discover",
    "categories.etendrinken": "Food & Drinks",
  },
  de: {
    "nav.home": "Startseite",
    "nav.events": "Veranstaltungen",
    "nav.saved": "Gespeichert",
    "nav.profile": "Profil",
    "nav.myEvents": "Meine Events",
    "nav.create": "Neues Event",
    "nav.search": "Suchen",
    "nav.login": "Anmelden",
    "nav.register": "Registrieren",
    "nav.logout": "Abmelden",
    "event.startingSoon": "Beginnt bald",
    "event.participants": "Teilnehmer",
    "event.free": "Kostenlos",
    "event.paid": "Kostenpflichtig",
    "event.join": "Teilnehmen",
    "event.leave": "Verlassen",
    "event.save": "Speichern",
    "event.saved": "Gespeichert",
    "event.share": "Teilen",
    "event.location": "Ort",
    "event.date": "Datum",
    "event.time": "Zeit",
    "event.description": "Beschreibung",
    "event.organizer": "Veranstalter",
    "event.category": "Kategorie",
    "filter.all": "Alle",
    "filter.today": "Heute",
    "filter.thisWeek": "Diese Woche",
    "filter.thisMonth": "Diesen Monat",
    "filter.radius": "Umkreis",
    "map.view": "Karte",
    "list.view": "Liste",
    "search.placeholder": "Events suchen...",
    "search.noResults": "Keine Veranstaltungen gefunden",
    "categories.tentoonstelling": "Ausstellung",
    "categories.voorstelling": "Vorstellung",
    "categories.activiteit": "Aktivität",
    "categories.stappenborrel": "Ausgehen",
    "categories.marktbeurs": "Markt & Messe",
    "categories.quizspelletjes": "Quiz & Spiele",
    "categories.lerenontdekken": "Lernen & Entdecken",
    "categories.etendrinken": "Essen & Trinken",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("language") as Language;
      if (saved && ["nl", "en", "de"].includes(saved)) {
        return saved;
      }
    }
    return "nl";
  });

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
