export function formatEventTime(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  const hours = d.getHours();
  const minutes = d.getMinutes();
  
  if (hours === 0 && minutes === 0) {
    return null;
  }
  
  return d.toLocaleTimeString('nl-NL', { 
    hour: '2-digit', 
    minute: '2-digit',
    timeZone: 'Europe/Amsterdam'
  });
}

export function formatEventTimeRange(
  startTime: string | Date | null | undefined, 
  endTime: string | Date | null | undefined
): string | null {
  const formattedStart = formatEventTime(startTime);
  const formattedEnd = formatEventTime(endTime);
  
  if (!formattedStart && !formattedEnd) {
    return null;
  }
  
  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`;
  }
  
  if (formattedStart) {
    return `vanaf ${formattedStart}`;
  }
  
  return null;
}

export function hasValidTime(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  
  const hours = d.getHours();
  const minutes = d.getMinutes();
  
  return !(hours === 0 && minutes === 0);
}

/**
 * Slimme datumweergave voor events
 * - Multi-dag events die al begonnen zijn: "Nu t/m [einddatum]"
 * - Toekomstige events: normale startdatum
 */
export function formatSmartEventDate(
  startTime: string | Date,
  endTime: string | Date | null | undefined
): string {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : start;
  
  // Reset naar middernacht voor dag-vergelijking
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const eventEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  // Check of event multi-dag is (eindigt op andere dag dan start)
  const isMultiDay = eventEndDay.getTime() > eventStartDay.getTime();
  
  // Event is al begonnen (startTime < now) en nog bezig (end > now)
  const isAlreadyStarted = start < now;
  const isStillOngoing = end > now;
  
  // Multi-dag event dat al begonnen is en nog bezig
  if (isMultiDay && isAlreadyStarted && isStillOngoing) {
    return `Nu t/m ${end.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short'
    })}`;
  }
  
  // Event dat nog niet begonnen is: toon startdatum
  return start.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short'
  });
}

/**
 * Slimme datumweergave voor app (met weekdag en maand)
 */
export function formatSmartEventDateLong(
  startTime: string | Date,
  endTime: string | Date | null | undefined
): string {
  const now = new Date();
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : start;
  
  const eventStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const eventEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const isMultiDay = eventEndDay.getTime() > eventStartDay.getTime();
  const isAlreadyStarted = start < now;
  const isStillOngoing = end > now;
  
  if (isMultiDay && isAlreadyStarted && isStillOngoing) {
    return `Nu t/m ${end.toLocaleDateString('nl-NL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    })}`;
  }
  
  return start.toLocaleDateString('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });
}
