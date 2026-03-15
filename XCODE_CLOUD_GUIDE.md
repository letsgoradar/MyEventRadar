# Xcode Cloud Handleiding — Let's Go Radar iOS

Deze handleiding legt stap voor stap uit hoe je de Let's Go Radar iOS-app publiceert via Xcode Cloud, zonder dat je een Mac nodig hebt.

---

## Vereisten

- **Apple Developer Program** account (€99/jaar) — [developer.apple.com](https://developer.apple.com/programs/)
- **GitHub repository** gekoppeld aan je project
- De `ios/` map staat in je repository (al gedaan ✅)

---

## Stap 1: Apple Developer Account voorbereiden

1. Ga naar [developer.apple.com](https://developer.apple.com) en log in
2. Controleer dat je **Developer Program** lidmaatschap actief is
3. Ga naar **Certificates, Identifiers & Profiles**

---

## Stap 2: Bundle ID registreren

1. Ga naar [developer.apple.com/account/resources/identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Klik op **+** om een nieuwe identifier toe te voegen
3. Selecteer **App IDs** → **App**
4. Vul in:
   - **Description**: Let's Go Radar
   - **Bundle ID**: Kies **Explicit** en vul in: `nl.letsgoradar.app`
5. Onder **Capabilities**, vink aan:
   - ✅ Access WiFi Information (voor netwerkdetectie)
   - ✅ Push Notifications (optioneel, voor toekomstige meldingen)
6. Klik **Continue** → **Register**

---

## Stap 3: App aanmaken in App Store Connect

1. Ga naar [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Klik op **Apps** → **+** → **Nieuwe app**
3. Vul in:
   - **Platforms**: iOS
   - **Naam**: Let's Go Radar
   - **Primaire taal**: Nederlands
   - **Bundle ID**: Selecteer `nl.letsgoradar.app`
   - **SKU**: `letsgoradar` (unieke interne identifier)
   - **Toegang**: Volledige toegang
4. Klik **Maak aan**

---

## Stap 4: App Store-vermelding invullen

In App Store Connect onder je app:

### Algemene informatie
- **Ondertitel**: Ontdek lokale evenementen bij jou in de buurt
- **Categorie**: Lifestyle (of Entertainment)
- **Subcategorie**: Evenementen
- **Privacybeleid-URL**: `https://letsgoradar.nl/privacy`

### Screenshots
Je hebt screenshots nodig voor:
- **iPhone 6.7"** (1290 × 2796 px) — iPhone 15 Pro Max formaat
- **iPhone 6.5"** (1284 × 2778 px) — iPhone 14 Plus formaat
- Optioneel: iPad screenshots

**Tip:** Maak screenshots via een simulator of TestFlight op je eigen iPhone.

### Beschrijving (voorbeeld)
```
Ontdek wat er vandaag en morgen te doen is bij jou in de buurt!

Let's Go Radar toont je lokale evenementen op een interactieve kaart. Van festivals en markten tot sportactiviteiten en culturele events — je vindt het allemaal op één plek.

Functies:
• Radar-weergave met evenementen bij jou in de buurt
• Filter op categorie, datum en afstand
• Bewaar je favoriete evenementen
• Bekijk details, locatie en tickets
• Volledig in het Nederlands

Gratis te gebruiken. Geen account vereist om te browsen.
```

### Zoekwoorden
```
evenementen,lokaal,radar,uitgaan,festivals,markten,sport,cultuur,Nederland
```

---

## Stap 5: GitHub koppelen aan Xcode Cloud

1. Ga in **App Store Connect** naar je app
2. Klik op het tabblad **Xcode Cloud**
3. Klik op **Aan de slag met Xcode Cloud**
4. Je wordt gevraagd om je **broncodeprovider** te koppelen:
   - Selecteer **GitHub**
   - Autoriseer Apple om toegang te krijgen tot je repository
   - Selecteer je **letsgoradar** repository
5. Apple detecteert automatisch het Xcode-project in `ios/App/`

---

## Stap 6: Xcode Cloud Workflow instellen

Na het koppelen van GitHub:

1. **Workflow aanmaken**:
   - Klik op **Maak workflow aan**
   - Geef de workflow een naam: `Build & Deploy`

2. **Omgeving**:
   - **Xcode-versie**: Nieuwste release (16.x)
   - **macOS-versie**: Nieuwste

3. **Startvoorwaarde (trigger)**:
   - **Branch wijzigingen**: `main`
   - Dit zorgt ervoor dat elke push naar `main` automatisch een build start

4. **Acties**:
   - **Archiveer**: Selecteer het scheme `App`
   - **Platform**: iOS

5. **Post-acties**:
   - **TestFlight (interne testing)**: Schakel in
   - Hierdoor wordt elke succesvolle build automatisch naar TestFlight gestuurd

6. Klik op **Bewaar**

### Belangrijk: CI-script
Het project bevat al een `ci_post_clone.sh` script in `ios/App/ci_scripts/`. Dit script:
- Installeert Node.js op de Apple build-server
- Draait `npm ci` om dependencies te installeren
- Bouwt de web-app met `npm run build`
- Synchroniseert de web-assets naar het iOS-project met `npx cap sync ios`

Dit script draait automatisch — je hoeft hier niets voor te doen.

---

## Stap 7: Omgevingsvariabelen in Xcode Cloud

Als je app omgevingsvariabelen nodig heeft (zoals `VITE_API_URL`):

1. Ga naar je workflow in Xcode Cloud
2. Klik op **Omgeving**
3. Voeg toe onder **Omgevingsvariabelen**:
   - `VITE_API_URL` = `https://letsgoradar.nl` (je productie-URL)
   - `VITE_GA_MEASUREMENT_ID` = `G-2MG3LB59TT`

---

## Stap 8: Eerste build starten

1. Push een commit naar de `main` branch op GitHub
2. Xcode Cloud pikt dit automatisch op en start een build
3. Volg de voortgang in **App Store Connect** → **Xcode Cloud**
4. De eerste build duurt meestal 15-25 minuten (inclusief dependency-installatie)
5. Na een succesvolle build verschijnt de app in **TestFlight**

---

## Stap 9: TestFlight testen

1. Installeer de **TestFlight** app op je iPhone vanuit de App Store
2. In App Store Connect → **TestFlight**:
   - Voeg jezelf toe als **interne tester** (met je Apple ID e-mail)
3. Je ontvangt een e-mail met een uitnodiging
4. Open TestFlight op je iPhone → installeer de app
5. Test de app grondig voordat je naar de App Store gaat

---

## Stap 10: Indienen bij de App Store

Wanneer je tevreden bent met de TestFlight-versie:

1. Ga naar **App Store Connect** → je app → **App Store** tab
2. Onder **Build**, selecteer de TestFlight-build die je wilt publiceren
3. Zorg dat alle velden zijn ingevuld:
   - ✅ Screenshots
   - ✅ Beschrijving
   - ✅ Zoekwoorden
   - ✅ Privacybeleid-URL
   - ✅ Leeftijdsclassificatie (vul de vragenlijst in)
   - ✅ Contactgegevens voor review
4. Klik op **Dien in voor beoordeling**
5. Apple reviewt de app (duurt meestal 24-48 uur)

---

## Kosten overzicht

| Onderdeel | Kosten |
|-----------|--------|
| Apple Developer Program | €99/jaar |
| Xcode Cloud (25 uur/maand) | Gratis (inbegrepen) |
| TestFlight | Gratis |
| App Store publicatie | Gratis (inbegrepen in Developer Program) |

---

## Veelgestelde vragen

### Hoeveel Xcode Cloud uren gebruik ik per build?
Een typische Capacitor-build duurt 10-20 minuten (~0.15-0.33 uur). Met 25 gratis uren per maand kun je ~75-150 builds per maand doen.

### Heb ik een Mac nodig?
Nee. Alles wordt beheerd via App Store Connect (web) en GitHub. Xcode Cloud bouwt de app op Apple's servers.

### Wat als de build faalt?
Controleer de buildlogs in App Store Connect → Xcode Cloud. Veelvoorkomende problemen:
- Node.js installatie mislukt → controleer het `ci_post_clone.sh` script
- CocoaPods problemen → Capacitor 8 gebruikt Swift Package Manager, geen CocoaPods
- Signing fouten → controleer je Bundle ID en provisioningprofielen

### Hoe update ik de app?
1. Pas de code aan in Replit
2. Push naar GitHub
3. Xcode Cloud bouwt automatisch een nieuwe versie
4. Test via TestFlight
5. Dien de nieuwe versie in via App Store Connect

### Hoe verhoog ik het versienummer?
Pas de versie aan in `ios/App/App.xcodeproj/project.pbxproj`:
- `MARKETING_VERSION` = het versienummer dat gebruikers zien (bijv. `1.1.0`)
- `CURRENT_PROJECT_VERSION` = het build-nummer (verhoog bij elke upload, bijv. `2`)

---

## Projectstructuur iOS

```
ios/
├── App/
│   ├── App/
│   │   ├── AppDelegate.swift      (app lifecycle)
│   │   ├── Info.plist              (app configuratie + permissies)
│   │   ├── Assets.xcassets/        (app icoon)
│   │   ├── Base.lproj/            (storyboards)
│   │   └── public/                (web assets — NIET handmatig bewerken)
│   ├── App.xcodeproj/             (Xcode project bestand)
│   ├── CapApp-SPM/                (Swift Package Manager dependencies)
│   └── ci_scripts/
│       └── ci_post_clone.sh       (Xcode Cloud build script)
└── capacitor-cordova-ios-plugins/
```

---

## Checklist vóór publicatie

- [ ] Apple Developer Program account actief
- [ ] Bundle ID `nl.letsgoradar.app` geregistreerd
- [ ] App aangemaakt in App Store Connect
- [ ] GitHub gekoppeld aan Xcode Cloud
- [ ] Workflow ingesteld (trigger: push naar main)
- [ ] `VITE_API_URL` ingesteld in Xcode Cloud omgevingsvariabelen
- [ ] Eerste build succesvol
- [ ] App getest via TestFlight
- [ ] Screenshots geüpload
- [ ] Beschrijving en zoekwoorden ingevuld
- [ ] Privacybeleid-URL ingesteld
- [ ] Leeftijdsclassificatie ingevuld
- [ ] Ingediend voor beoordeling
