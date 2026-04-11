# let's go Radar — Play Store Publicatie Handleiding

**App ID**: `nl.letsgoradar.app`  
**App naam**: let's go Radar  
**Productie-URL**: `https://letsgoradar.replit.app`

---

## Vereisten

- **Google Play Developer account** (eenmalig €25) — https://play.google.com/console
- **Android Studio** geïnstalleerd op je computer
- **Java JDK 17+** geïnstalleerd
- **Node.js 18+** geïnstalleerd

---

## Stap 1: Web app bouwen en synchroniseren

Voer deze commando's uit in de root van het project (de `letsgoradar/` map die je via GitHub hebt gecloned):

```bash
# Bouw de web app (frontend naar dist/public)
VITE_API_URL=https://letsgoradar.replit.app npm run build

# Synchroniseer web assets met het Android project
# PRODUCTION_URL zorgt dat de app de productie-server laadt (Google login werkt dan automatisch)
PRODUCTION_URL=https://letsgoradar.replit.app npx cap sync android
```

> **Tip**: Voer deze commando's altijd samen uit voordat je een nieuwe build maakt.
>
> - `VITE_API_URL` — backend URL voor API-calls vanuit de lokaal gebundelde app
> - `PRODUCTION_URL` — laadt de volledige app van de productie-server (Google login werkt dan zonder extra configuratie)

### Windows PowerShell?

Op Windows PowerShell werken omgevingsvariabelen anders. Gebruik dan:

```powershell
$env:VITE_API_URL="https://letsgoradar.replit.app"; npm run build
$env:PRODUCTION_URL="https://letsgoradar.replit.app"; npx cap sync android
```

---

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

Sla het wachtwoord op in een wachtwoordmanager. Maak een backup van het `.keystore` bestand op een externe schijf of veilige cloudstorage.

---

## Stap 3: Signing configureren

Maak het bestand `android/keystore.properties` aan (staat al in `.gitignore`, wordt **niet** meegecommit naar GitHub):

```properties
RELEASE_STORE_FILE=../letsgoradar-upload.keystore
RELEASE_STORE_PASSWORD=jouw_wachtwoord
RELEASE_KEY_ALIAS=letsgoradar
RELEASE_KEY_PASSWORD=jouw_wachtwoord
```

Het `android/app/build.gradle` bestand laadt dit bestand automatisch. Zodra `keystore.properties` bestaat, wordt de release build automatisch gesigned.

---

## Stap 4: Release AAB bouwen

### Optie A: Via Android Studio (aanbevolen)

1. Open de `android/` map in Android Studio
2. Wacht tot Gradle klaar is met synchroniseren (kan een paar minuten duren)
3. Ga naar **Build > Generate Signed Bundle / APK**
4. Kies **Android App Bundle**
5. Selecteer je keystore (`letsgoradar-upload.keystore`) en vul de wachtwoorden in
6. Kies **release** als build variant
7. Klik op **Finish**

Het AAB-bestand verschijnt in:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### Optie B: Via command line

```bash
cd android

# Zorg dat keystore.properties is aangemaakt (zie Stap 3)
./gradlew bundleRelease
```

Op Windows: gebruik `gradlew.bat bundleRelease` in plaats van `./gradlew bundleRelease`.

---

## Stap 5: App testen voor publicatie

Voordat je naar de Play Store uploadt, test je de release build op een echte telefoon:

```bash
cd android
./gradlew assembleRelease
```

Het APK-bestand verschijnt in:
```
android/app/build/outputs/apk/release/app-release.apk
```

Kopieer dit naar je telefoon (via USB of e-mail) en installeer het. Controleer:
- Kan je inloggen met Google?
- Laden evenementen correct?
- Werkt de kaart?
- Werkt de navigatie naar evenementen?

---

## Stap 6: Google OAuth instellen voor de live app

Google login vereist dat de callback URL is toegevoegd aan Google Cloud Console:

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com)
2. Navigeer naar **APIs & Services > Credentials**
3. Open je OAuth 2.0 Client ID
4. Voeg toe onder **"Authorized redirect URIs"**:
   ```
   https://letsgoradar.replit.app/api/auth/google/callback
   ```
5. Klik op **Save**

> Dit is al gedaan voor de web-versie. De Android app gebruikt dezelfde server, dus als de web-versie werkt, werkt de app automatisch ook.

---

## Stap 7: Play Store Console instellen

### Account aanmaken (als je dat nog niet hebt gedaan)

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
3. Accepteer de beleidsregels en klik op **App maken**

### Verplichte informatie invullen

#### App-inhoud
- **Privacybeleid**: `https://letsgoradar.replit.app/privacy`
- **App-toegang**: Alle functionaliteit beschikbaar zonder speciale toegang
- **Advertenties**: Bevat geen advertenties
- **Inhoudsbeoordeling**: Vul de IARC vragenlijst in (kies: utility/productiviteit app, geen geweld, geen 18+)
- **Doelgroep**: 13+ (community events, voor iedereen)
- **Nieuws-app**: Nee

#### Winkelvermelding
- **Korte beschrijving** (max 80 tekens):
  ```
  Ontdek lokale evenementen bij jou in de buurt op de radar
  ```

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

- **App-icoon**: 512×512 px, PNG (32-bit, geen transparantie)
  - Bestand: `letsgo-radar-icon-512.png` (controleer of dit aanwezig is)
- **Feature graphic**: 1024×500 px, PNG of JPG
  - Dit moet je zelf maken (bijv. in Canva)
- **Screenshots**: Minimaal 2 per apparaattype
  - Telefoon: maak screenshots op een Android-telefoon of via Android Studio emulator
  - Minimale afmeting: 320px, maximale afmeting: 3840px

---

## Stap 8: AAB uploaden en publiceren

1. Ga in Play Console naar **Productie > Nieuwe release maken**
2. Kies **Google Play App Signing** (sterk aanbevolen) — upload je upload-keystore zodat Google de release-sleutel beheert
3. Upload het AAB-bestand: `android/app/build/outputs/bundle/release/app-release.aab`
4. Vul release notes in (Nederlands):
   ```
   Eerste release van let's go Radar — ontdek lokale evenementen bij jou in de buurt!
   ```
5. Klik op **Release beoordelen**
6. De review duurt meestal 1–3 werkdagen

---

## Checklist voor publicatie

### Technische voorbereiding
- [ ] Code gecloned van GitHub naar lokale computer
- [ ] `npm install` uitgevoerd
- [ ] Web app gebouwd: `VITE_API_URL=https://letsgoradar.replit.app npm run build`
- [ ] Android gesynchroniseerd: `PRODUCTION_URL=https://letsgoradar.replit.app npx cap sync android`
- [ ] Upload keystore aangemaakt (`letsgoradar-upload.keystore`)
- [ ] `android/keystore.properties` aangemaakt met wachtwoorden
- [ ] Keystore-bestand veilig opgeslagen als backup
- [ ] Release AAB gebouwd (via Android Studio of `./gradlew bundleRelease`)
- [ ] AAB getest op echte telefoon (release APK)

### Google Cloud Console
- [ ] `https://letsgoradar.replit.app/api/auth/google/callback` toegevoegd als Authorized Redirect URI

### Play Console
- [ ] Google Play Developer account aangemaakt en geverifieerd (€25)
- [ ] App aangemaakt in Play Console (`nl.letsgoradar.app`)
- [ ] Privacybeleid ingevuld: `https://letsgoradar.replit.app/privacy`
- [ ] IARC inhoudsbeoordeling ingevuld
- [ ] Doelgroep ingesteld
- [ ] App-icoon (512×512) geüpload
- [ ] Feature graphic (1024×500) gemaakt en geüpload
- [ ] Minimaal 2 screenshots geüpload
- [ ] Korte en volledige beschrijving ingevuld
- [ ] AAB geüpload naar Productie release
- [ ] Release notes ingevuld
- [ ] Release ter beoordeling ingediend

---

## Updates publiceren (toekomstige versies)

1. Verhoog `versionCode` (met 1) en `versionName` in `android/app/build.gradle`:
   ```gradle
   versionCode 2          # was 1, verhoog met 1 bij elke upload
   versionName "1.1.0"   # semantisch versienummer
   ```
2. Bouw en synchroniseer opnieuw:
   ```bash
   VITE_API_URL=https://letsgoradar.replit.app npm run build
   PRODUCTION_URL=https://letsgoradar.replit.app npx cap sync android
   ```
3. Bouw een nieuwe release AAB
4. Upload naar Play Console > Productie > Nieuwe release maken

---

## Veelgestelde vragen

**Moet ik altijd opnieuw bouwen als er iets op de server verandert?**

Nee! Omdat de app `PRODUCTION_URL` gebruikt, laadt hij altijd de live versie van de server. Server-wijzigingen (nieuwe events, bugfixes in de backend) zijn direct zichtbaar zonder nieuwe app-release. Je hoeft alleen een nieuwe AAB te bouwen en uploaden als er iets verandert in de native Android-code (rechten, Capacitor-plugins, app-icoon, etc.).

**Kan ik Google Play App Signing gebruiken?**

Ja, dit wordt sterk aanbevolen. Google beheert dan de release-sleutel en jij gebruikt alleen een upload-sleutel. Als je upload-sleutel kwijtraakt kun je een nieuwe aanvragen.

**Mijn keystore kwijt?**

Met Google Play App Signing kun je een nieuwe upload-sleutel aanvragen bij Google. Zonder App Signing is je app onherstelbaar verloren — maak altijd een backup!

**Hoe weet ik welke `versionCode` ik moet gebruiken?**

Start met `versionCode 1` voor de eerste Play Store upload. Als je een foutmelding krijgt dat de versie al bestaat, verhoog je `versionCode` met 1 en probeer opnieuw.
