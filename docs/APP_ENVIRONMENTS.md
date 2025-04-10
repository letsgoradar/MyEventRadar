# App Omgevingen Documentatie

## 1. Huidige Omgevingen

### 1.1 Web Omgeving (Bestaand)

De huidige web-omgeving biedt gebruikers een traditionele mobiel-vriendelijke interface met:

- **Navigatie**: Onderste navigatiebalk (BottomNav) met de volgende opties:
  - Home: Toegang tot kaart- of lijstweergave van evenementen
  - Events: Overzicht van gebruikers evenementen
  - Aanmaken: Nieuw evenement creëren
  - Favorieten: Opgeslagen favoriete evenementen
  - Profiel: Gebruikersprofiel en instellingen

- **Weergavemodi**:
  - Kaartweergave (MapView): Interactieve kaart met evenementlocaties als markers
  - Lijstweergave (EventList): Verticale scrollbare lijst met evenementkaarten
  - Gebruiker kan schakelen tussen kaart en lijst, maar kan ze niet tegelijk zien

- **Zoek- en Filter-functionaliteit**:
  - Zoeken op query
  - Filteren op afstand/straal
  - Filteren op categorie
  - Datum filters

- **Backend Integratie**:
  - API routes voor evenementdata
  - Gebruikersauthenticatie
  - Admin dashboard functies

### 1.2 Android App (Beschrijving)

De Android app-omgeving biedt dezelfde kernfunctionaliteit als de web-omgeving, met platform-specifieke aanpassingen:

- **Native Navigatie**: Gebruikt Android bottom navigation bar
- **Kaartintegratie**: Maakt gebruik van native Google Maps integratie in plaats van Leaflet
- **Offline Functionaliteit**: Beperkte caching van evenementdata
- **Push Notificaties**: Voor nabije evenementen en updates
- **Apparaat Integratie**: Toegang tot contacten, camera en andere apparaatfuncties

### 1.3 iOS App (Beschrijving)

De iOS app-omgeving biedt dezelfde kernfunctionaliteit als de web-omgeving, met platform-specifieke aanpassingen:

- **Native Navigatie**: Gebruikt iOS TabBar met eigen stijl
- **Kaartintegratie**: Maakt gebruik van Apple Maps in plaats van Leaflet
- **Offline Functionaliteit**: Beperkte caching van evenementdata
- **Push Notificaties**: Voor nabije evenementen en updates
- **Apparaat Integratie**: Toegang tot contacten, camera en andere apparaatfuncties
- **Apple Design Guidelines**: Volgt iOS specifieke design patterns en interacties

## 2. Nieuwe Webomgeving (Planning)

De geplande nieuwe webomgeving zal een moderne Airbnb-stijl interface bieden met:

- **Zijbalk Navigatie**: Vervangt de huidige onderste navigatiebalk
  - Zichtbaarheid op desktop en tablet
  - Inklapbaar op mobiel

- **Gecombineerde Weergave**: Lijst- en kaartweergave tegelijk zichtbaar
  - Resizable componenten (gebruiker kan grootte aanpassen)
  - Kaart/lijst verhouding instelbaar
  - Responsive design voor alle schermformaten

- **Verbeterde Interactie**: 
  - Synchronisatie tussen lijst en kaart
  - Hover/selectie in lijst highlight marker op kaart
  - Filteren en zoeken beïnvloedt beide weergaven tegelijk

- **Performance Optimalisaties**:
  - Lazy loading van evenementgegevens
  - Geoptimaliseerde kaart rendering
  - Efficiëntere dataverwerking

## 3. Technische Componentenstructuur

### 3.1 Huidige Structuur

```
App
├── TopNav (Filtering, zoeken)
├── Inhoud (Conditioneel)
│   ├── MapView (Als isMapView=true)
│   │   └── EventMarker (Voor elk evenement)
│   └── EventList (Als isMapView=false)
│       └── EventCard (Voor elk evenement)
└── BottomNav (Navigatie)
```

### 3.2 Nieuwe Structuur (Planning)

```
App
├── TopNav (Filtering, zoeken)
├── SideNav (Vervangt BottomNav)
├── SplitView
│   ├── ResizablePanel (Links)
│   │   └── EventList
│   │       └── EventCard (Voor elk evenement)
│   └── ResizablePanel (Rechts)
│       └── MapView
│           └── EventMarker (Voor elk evenement)
└── MobileNav (Conditioneel voor kleine schermen)
```

## 4. Gedeelde Componenten Tussen Omgevingen

Alle omgevingen (Web, Android, iOS) delen de volgende concepten:

- **Data Modellen**: Event, User, etc.
- **Authenticatie Logica**: Login, registratie, rechten
- **Core Business Logic**: Zoeken, filteren, sorteren
- **Styling Principes**: Kleuren, iconografie, typografie 
- **API Integratie**: Backend communicatie

De nieuwe web-omgeving zal al deze gedeelde concepten behouden, maar een verbeterde gebruikersinterface bieden die beter past bij desktop/tablet gebruik, terwijl mobile ondersteuning behouden blijft.