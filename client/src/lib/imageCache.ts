const failedImageUrls = new Set<string>();
const failedEventIds = new Set<number>();
let reportTimer: ReturnType<typeof setTimeout> | null = null;

export function isImageFailed(url: string | null | undefined): boolean {
  if (!url) return false;
  return failedImageUrls.has(url);
}

export function markImageFailed(url: string | null | undefined, eventId?: number): void {
  if (url) failedImageUrls.add(url);
  if (eventId) {
    failedEventIds.add(eventId);
    scheduleReport();
  }
}

function scheduleReport() {
  if (reportTimer) return;
  reportTimer = setTimeout(async () => {
    reportTimer = null;
    if (failedEventIds.size === 0) return;

    const ids = Array.from(failedEventIds);
    failedEventIds.clear();

    try {
      await fetch('/api/report-broken-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventIds: ids }),
      });
    } catch {
    }
  }, 30000);
}
