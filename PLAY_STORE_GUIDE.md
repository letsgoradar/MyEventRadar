# let's go Radar — Play Store Publicatie Handleiding

## Vereisten

- **Google Play Developer account** (eenmalig €25) — https://play.google.com/console
- **Android Studio** geïnstalleerd op je computer
- **Java JDK 17+** geïnstalleerd
- **Node.js 18+** geïnstalleerd

## Stap 1: Web app bouwen en synchroniseren

```bash
# Bouw de web app
npm run build

# Synchroniseer met Android project
npx cap sync android
```

## Stap 2: Upload Keystore aanmaken

De keystore is je digitale handtekening. **Bewaar deze veilig — zonder keystore kun je geen updates publiceren!**

```bash
keytool -genkey -v \
  -keystore letsgoradar-upload.keystore \
  -alias letsgoradar \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storepass KIES_EEN_STERK_WACHTWOORD \
  -keypass KIES_EEN_STERK_WACHTWOORD \
  -dname "CN=let's go Radar, O=letsgo radar, L=Amsterdam, C=NL"
```

Bewaar het wachtwoord op een veilige plek (bijv. wachtwoordmanager).

## Stap 3: Signing configureren

Maak het bestand `android/keystore.properties` aan (NIET in Git opnemen):

```properties
RELEASE_STORE_FILE=../letsgoradar-upload.keystore
RELEASE_STORE_PASSWORD=jouw_wachtwoord
RELEASE_KEY_ALIAS=letsgoradar
RELEASE_KEY_PASSWORD=jouw_wachtwoord
```

Of bouw met command line parameters (zie Stap 4).

## Stap 4: Release AAB bouwen

### Optie A: Via Android Studio
1. Open de `android/` map in Android Studio
2. Ga naar **Build > Generate Signed Bundle / APK**
3. Kies **Android App Bundle**
4. Selecteer je keystore en vul de wachtwoorden in
5. Kies **release** als build variant
6. Klik op **Finish**

Het AAB-bestand verschijnt in `android/app/build/outputs/bundle/release/`

### Optie B: Via command line
```bash
cd android

# Met gradle properties
./gradlew bundleRelease \
  -PRELEASE_STORE_FILE=../letsgoradar-upload.keystore \
  -PRELEASE_STORE_PASSWORD=jouw_wachtwoord \
  -PRELEASE_KEY_ALIAS=letsgoradar \
  -PRELEASE_KEY_PASSWORD=jouw_wachtwoord
```

## Stap 5: Testen voor publicatie

```bash
cd android

# Debug APK bouwen en op telefoon testen
./gradlew assembleDebug

# APK staat in: android/app/build/outputs/apk/debug/app-debug.apk
# Kopieer naar telefoon en installeer
```

## Stap 6: Play Store Console instellen

### Account aanmaken
1. Ga naar https://play.google.com/console
2. Registreer als ontwikkelaar (€25 eenmalig)
3. Voltooi de identiteitsverificatie

### App aanmaken
1. Klik op **App maken**
2. Vul in:
   - **App naam**: let's go Radar
   - **Standaardtaal**: Nederlands
   - **App of game**: App
   - **Gratis of betaald**: Gratis

### Verplichte informatie invullen

#### App-inhoud
- **Privacybeleid**: URL naar je privacybeleid (verplicht)
- **App-toegang**: Alle functionaliteit beschikbaar zonder speciale toegang
- **Advertenties**: Bevat geen advertenties (of wel, als dat zo is)
- **Inhoudsbeoordeling**: Vul de IARC vragenlijst in
- **Doelgroep**: 18+ (community events)
- **Nieuws-app**: Nee

#### Winkelvermelding
- **Korte beschrijving** (max 80 tekens):
  `Ontdek lokale evenementen bij jou in de buurt op de radar`

- **Volledige beschrijving** (max 4000 tekens):
  ```
  let's go Radar is dé app om lokale evenementen in Nederland te ontdekken! 
  
  Bekijk wat er bij jou in de buurt te doen is via de interactieve kaart. 
  Van festivals en markten tot sportactiviteiten en culturele events — 
  alles op één plek.

  Functies:
  • Radar-kaart met evenementen bij jou in de buurt
  • Filter op categorie, datum en afstand
  • Bewaar je favoriete evenementen
  • Meld je aan voor evenementen
  • Maak zelf evenementen aan
  • Ontvang notificaties voor wijzigingen
  • Navigeer direct naar de locatie
  
  Ontdek wat er te doen is. Let's go!
  ```

- **App-icoon**: 512x512 px, PNG, 32-bit (al aanwezig als `letsgo-radar-icon-512.png`)
- **Feature graphic**: 1024x500 px, PNG of JPG (moet je nog maken)
- **Screenshots**: Minimaal 2 screenshots per apparaattype
  - Telefoon: 16:9 of 9:16, min 320px, max 3840px
  - Tablet (optioneel): zelfde vereisten

## Stap 7: AAB uploaden en publiceren

1. Ga naar **Productie** > **Nieuwe release maken**
2. Gebruik **Google Play App Signing** (aanbevolen) — upload je signing key
3. Upload het AAB-bestand
4. Vul release notes in
5. Klik op **Release beoordelen**
6. De review duurt meestal 1-3 werkdagen

## Checklist voor publicatie

- [ ] Google Play Developer account aangemaakt en geverifieerd
- [ ] Upload keystore aangemaakt en veilig bewaard
- [ ] Web app gebouwd (`npm run build`)
- [ ] Android project gesynchroniseerd (`npx cap sync android`)
- [ ] Release AAB gebouwd en getest
- [ ] Privacybeleid URL aangemaakt
- [ ] App-icoon (512x512) klaargezet
- [ ] Feature graphic (1024x500) gemaakt
- [ ] Minimaal 2 screenshots gemaakt
- [ ] Korte en volledige beschrijving ingevuld
- [ ] Inhoudsbeoordeling (IARC) ingevuld
- [ ] AAB geüpload naar Play Store Console
- [ ] Release ter beoordeling ingediend

## Veelgestelde vragen

**Moet ik de API URL instellen voor de native app?**
Ja! Zorg dat `VITE_API_URL` is ingesteld in je `.env` bestand voordat je bouwt. Dit moet de productie-URL van je backend zijn (bijv. `https://jouw-app.replit.app`).

**Kan ik Google Play App Signing gebruiken?**
Ja, dit wordt aanbevolen. Google beheert dan de release-sleutel en jij gebruikt alleen een upload-sleutel.

**Hoe update ik de app?**
1. Verhoog `versionCode` (met 1) en `versionName` in `android/app/build.gradle`
2. Bouw opnieuw (`npm run build && npx cap sync android`)
3. Maak een nieuwe release AAB
4. Upload naar Play Store Console

**Mijn keystore kwijt?**
Met Google Play App Signing kun je een nieuwe upload-sleutel aanvragen. Zonder App Signing is je app verloren — maak altijd een backup!
