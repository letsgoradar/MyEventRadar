import type { RssFeed } from "@shared/schema";
import { storage } from "../storage";

const MIN_BASELINE_RUNS = 5;
const BASELINE_WINDOW = 12;
const MIN_EXPECTED_ITEMS = 10;
const MIN_VOLUME_RATIO = 0.35;
const MIN_PAGE_RATIO = 0.25;

export interface FeedGateResult {
  blocked: boolean;
  reason: string;
  evidence: {
    currentFound: number;
    currentPages: number;
    baselineRuns: number;
    medianFound: number;
    medianPages: number;
    volumeRatio: number | null;
    pageRatio: number | null;
  };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

export async function evaluateFeedRun(
  feed: RssFeed,
  currentFound: number,
  currentPages = 0,
): Promise<FeedGateResult> {
  const history = await storage.getSyncHistoryForFeed(feed.id, BASELINE_WINDOW + 1);
  const successful = history
    .filter((run) => run.success !== false && (run.totalFound ?? 0) > 0)
    .slice(0, BASELINE_WINDOW);

  const medianFound = median(successful.map((run) => run.totalFound ?? 0));
  const runsWithPages = successful.filter((run) => (run.pagesProcessed ?? 0) > 0);
  const medianPages = median(runsWithPages.map((run) => run.pagesProcessed ?? 0));
  const volumeRatio = medianFound > 0 ? currentFound / medianFound : null;
  const pageRatio = medianPages > 0 && currentPages > 0 ? currentPages / medianPages : null;

  const evidence = {
    currentFound,
    currentPages,
    baselineRuns: successful.length,
    medianFound,
    medianPages,
    volumeRatio,
    pageRatio,
  };

  if (successful.length < MIN_BASELINE_RUNS || medianFound < MIN_EXPECTED_ITEMS) {
    return {
      blocked: false,
      reason: `Nog onvoldoende betrouwbare historie (${successful.length}/${MIN_BASELINE_RUNS} runs) voor quarantaine.`,
      evidence,
    };
  }

  const volumeCollapsed = currentFound < Math.max(3, Math.floor(medianFound * MIN_VOLUME_RATIO));
  const paginationCollapsed =
    volumeCollapsed &&
    medianPages >= 4 &&
    currentPages > 0 &&
    currentPages < Math.max(1, Math.floor(medianPages * MIN_PAGE_RATIO));

  if (!volumeCollapsed && !paginationCollapsed) {
    return {
      blocked: false,
      reason: "Output ligt binnen de historische bandbreedte.",
      evidence,
    };
  }

  const reasons = [];
  if (volumeCollapsed) {
    reasons.push(
      `${currentFound} items gevonden; normaal mediaan ${Math.round(medianFound)} (${Math.round((volumeRatio ?? 0) * 100)}%)`,
    );
  }
  if (paginationCollapsed) {
    reasons.push(
      `${currentPages} pagina's verwerkt; normaal mediaan ${Math.round(medianPages)} (${Math.round((pageRatio ?? 0) * 100)}%)`,
    );
  }
  const reason = `Run in quarantaine: ${reasons.join("; ")}. Bestaande goede events zijn behouden.`;

  const existingCase = await storage.getOpenRepairCaseForFeed(feed.id, "dossier");
  if (!existingCase) {
    await storage.createFeedRepairCase({
      feedId: feed.id,
      feedName: feed.name,
      kind: "dossier",
      cause: "structure",
      severity: "error",
      title: `Afwijkende output tegengehouden: ${feed.name}`,
      summary: reason,
      diagnosis: {
        cause: "quality_gate",
        url: feed.url,
        feedType: feed.feedType,
        isMaatwerk: feed.feedType === "scraper" && !feed.aiExtractionProfileId,
        health: { status: "suspect", reason },
        qualityGate: evidence,
        attemptsAlreadyMade: [
          "Nieuwe output vergeleken met eerdere geslaagde synchronisaties",
          "Volume en paginering gecontroleerd op structurele terugval",
          "Publicatie gestopt; bestaande catalogus ongewijzigd behouden",
        ],
      },
      status: "open",
    });
  }

  await storage.createFeedRepairLog({
    feedId: feed.id,
    feedName: feed.name,
    cause: "structure",
    track: "dossier",
    outcome: "escalated",
    message: reason,
    detail: { qualityGate: evidence },
    aiCallsUsed: 0,
  });

  return { blocked: true, reason, evidence };
}