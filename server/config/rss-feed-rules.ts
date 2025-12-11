/**
 * RSS Feed Import Principes / Rules
 * 
 * Dit bestand documenteert de standaard regels waaraan alle RSS feeds moeten voldoen.
 * Deze regels zorgen voor consistente, kwalitatieve event imports.
 */

export interface FeedImportRules {
  requireVerifiedLocation: boolean;
  requireDateBound: boolean;
  preferSourceImage: boolean;
  consolidateMultiDayEvents: boolean;
  skipDuplicates: boolean;
  useUnknownForMissingTime: boolean;
}

export const DEFAULT_FEED_RULES: FeedImportRules = {
  requireVerifiedLocation: true,
  requireDateBound: true,
  preferSourceImage: true,
  consolidateMultiDayEvents: true,
  skipDuplicates: true,
  useUnknownForMissingTime: true,
};

export const FEED_IMPORT_PRINCIPLES = `
================================================================================
                     LETSGO RADAR - RSS FEED IMPORT PRINCIPES
================================================================================

1. LOCATIE VERIFICATIE (requireVerifiedLocation: true)
   ─────────────────────────────────────────────────────
   • Alleen events importeren met geverifieerde locatie
   • Accepteer: GPS coördinaten uit de bron
   • Accepteer: Bekend venue met bekende coördinaten  
   • Accepteer: Adres dat succesvol ge-geocoded kan worden
   • Weiger: Events zonder locatie of met algemene regio-aanduiding

2. DATUM GEBONDEN EVENTS (requireDateBound: true)
   ─────────────────────────────────────────────────────
   • Alleen events met specifieke datum of datumperiode
   • Weiger: Algemene activiteiten zonder specifieke datum
   • Weiger: Permanente tentoonstellingen zonder einddatum

3. BRON AFBEELDINGEN (preferSourceImage: true)
   ─────────────────────────────────────────────────────
   • Altijd de afbeelding uit de bron gebruiken als beschikbaar
   • Alleen fallback naar Unsplash als geen bron-afbeelding
   • Nooit AI-gegenereerde placeholder afbeeldingen

4. MULTIDAG EVENTS (consolidateMultiDayEvents: true)
   ─────────────────────────────────────────────────────
   • Events die op meerdere dagen plaatsvinden als 1 event importeren
   • Sla startdatum en einddatum op als bereik
   • Niet: Aparte events voor elke dag aanmaken

5. DUPLICATE DETECTIE (skipDuplicates: true)
   ─────────────────────────────────────────────────────
   • Check op bestaande events voordat je importeert
   • Detectie op: externalId (sourceUrl), titel + locatie + startdatum
   • Sla events over die al in het systeem staan
   • Log overgeslagen duplicaten voor monitoring

6. TIJD HANTERING (useUnknownForMissingTime: true)
   ─────────────────────────────────────────────────────
   • Gebruik tijden als ze in de bron staan
   • Als tijd onbekend: markeer als "onbekend" 
   • NOOIT: Willekeurige tijden invullen
   • Standaard: 00:00 als starttijd, 23:59 als eindtijd als alleen datum bekend

================================================================================
`;

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  skipped: boolean;
}

export function validateEventForImport(event: {
  title: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  startTime?: Date;
  endTime?: Date;
}, rules: FeedImportRules = DEFAULT_FEED_RULES): ValidationResult {
  
  if (rules.requireVerifiedLocation) {
    if (!event.latitude || !event.longitude) {
      return {
        isValid: false,
        reason: `Geen geverifieerde locatie voor: ${event.title}`,
        skipped: true
      };
    }
  }
  
  if (rules.requireDateBound) {
    if (!event.startTime) {
      return {
        isValid: false,
        reason: `Geen startdatum voor: ${event.title}`,
        skipped: true
      };
    }
  }
  
  return {
    isValid: true,
    skipped: false
  };
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingEventId?: number;
  matchedOn?: 'externalId' | 'titleLocationDate';
}

export function createDuplicateKey(event: {
  title: string;
  latitude?: number;
  longitude?: number;
  startTime?: Date;
}): string {
  const normalizedTitle = event.title.toLowerCase().trim().replace(/\s+/g, ' ');
  const latKey = event.latitude ? Math.round(event.latitude * 1000) : 0;
  const lngKey = event.longitude ? Math.round(event.longitude * 1000) : 0;
  const dateKey = event.startTime ? event.startTime.toISOString().split('T')[0] : '';
  
  return `${normalizedTitle}|${latKey}|${lngKey}|${dateKey}`;
}
