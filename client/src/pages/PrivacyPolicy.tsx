import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function PrivacyPolicy() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug
        </button>

        <h1 className="text-3xl font-bold mb-2">Privacybeleid</h1>
        <p className="text-muted-foreground mb-8">Laatst bijgewerkt: 9 maart 2026</p>

        <div className="prose prose-sm max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold mb-3">1. Wie zijn wij?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Evenementenradar.nl is een platform voor het ontdekken van lokale evenementen in Nederland.
              Wij respecteren je privacy en gaan zorgvuldig om met je persoonsgegevens. 
              Dit privacybeleid legt uit welke gegevens wij verzamelen, waarom, en hoe wij deze beschermen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Welke gegevens verzamelen wij?</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium">Accountgegevens</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Bij registratie verzamelen wij je naam, e-mailadres en een optionele profielfoto. 
                  Je wachtwoord wordt versleuteld opgeslagen en is niet zichtbaar voor ons.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Locatiegegevens</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Met jouw toestemming gebruiken wij je locatie om evenementen in jouw buurt te tonen. 
                  Je locatie wordt niet permanent opgeslagen en wordt alleen gebruikt tijdens het gebruik van de app.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Gebruiksgegevens</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Wij registreren welke evenementen je opslaat als favoriet en aan welke evenementen je deelneemt, 
                  zodat wij je een persoonlijke ervaring kunnen bieden.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. Waarvoor gebruiken wij je gegevens?</h2>
            <ul className="list-disc pl-5 text-muted-foreground space-y-2">
              <li>Het tonen van evenementen in jouw buurt op basis van je locatie</li>
              <li>Het beheren van je account en voorkeuren</li>
              <li>Het versturen van meldingen over evenementen die je hebt opgeslagen</li>
              <li>Het verbeteren van onze dienstverlening</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Delen met derden</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wij verkopen je persoonsgegevens niet aan derden. Wij gebruiken de volgende diensten:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-2 mt-2">
              <li><strong>OpenAI</strong> — voor het categoriseren en verrijken van evenementinformatie</li>
              <li><strong>RSS-feeds</strong> — voor het verzamelen van publiek beschikbare evenementgegevens</li>
              <li><strong>Hosting provider</strong> — voor het hosten van de applicatie en database</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Beveiliging</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wij nemen passende technische en organisatorische maatregelen om je gegevens te beschermen tegen 
              ongeautoriseerde toegang, verlies of wijziging. Alle communicatie verloopt via een versleutelde verbinding (HTTPS).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Bewaartermijn</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wij bewaren je gegevens zolang je een actief account hebt. 
              Wanneer je je account verwijdert, worden al je persoonsgegevens binnen 30 dagen verwijderd.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Jouw rechten</h2>
            <p className="text-muted-foreground leading-relaxed">
              Op grond van de AVG (Algemene Verordening Gegevensbescherming) heb je de volgende rechten:
            </p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-2 mt-2">
              <li><strong>Inzage</strong> — je kunt opvragen welke gegevens wij van je hebben</li>
              <li><strong>Correctie</strong> — je kunt onjuiste gegevens laten aanpassen</li>
              <li><strong>Verwijdering</strong> — je kunt verzoeken om je gegevens te verwijderen</li>
              <li><strong>Overdracht</strong> — je kunt je gegevens opvragen in een bruikbaar formaat</li>
              <li><strong>Bezwaar</strong> — je kunt bezwaar maken tegen de verwerking van je gegevens</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Cookies</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wij gebruiken functionele cookies die nodig zijn voor het functioneren van de app, 
              zoals het onthouden van je inlogsessie. Wij gebruiken geen tracking cookies of cookies van derden voor advertentiedoeleinden.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Heb je vragen over dit privacybeleid of wil je gebruik maken van je rechten? 
              Neem dan contact met ons op via:
            </p>
            <p className="text-muted-foreground mt-2">
              <strong>E-mail:</strong> privacy@letsgoradar.nl
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. Wijzigingen</h2>
            <p className="text-muted-foreground leading-relaxed">
              Wij kunnen dit privacybeleid van tijd tot tijd aanpassen. 
              De meest recente versie is altijd beschikbaar in de app en op onze website. 
              Bij belangrijke wijzigingen informeren wij je via de app.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
