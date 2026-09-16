export function formatEventTime(date: string | Date | null | undefined): string | null {
  if (!date) return null;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  
  // Check UTC hours - database stores times in UTC
  // 00:00 UTC or 23:59 UTC indicates "date-only" (no explicit time)
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  const utcSeconds = d.getUTCSeconds();
  
  // Date-only indicator: 00:00:00 UTC (start of day) or 23:59:59 UTC (end of day)
  if (utcHours === 0 && utcMinutes === 0 && utcSeconds === 0) {
    return null;
  }
  if (utcHours === 23 && utcMinutes === 59 && utcSeconds === 59) {
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
  const rawStart = startTime ? new Date(startTime) : null;
  const rawEnd = endTime ? new Date(endTime) : null;
  const isAllDayUtcRange = !!rawStart && !!rawEnd
    && !isNaN(rawStart.getTime()) && !isNaN(rawEnd.getTime())
    && rawStart.getUTCHours() === 0 && rawStart.getUTCMinutes() === 0
    && rawEnd.getUTCHours() === 23 && rawEnd.getUTCMinutes() === 59;
  const isAllDayDisplayRange = formattedStart === '00:00' && formattedEnd === '23:59';

  if (isAllDayUtcRange || isAllDayDisplayRange) {
    return 'Zie website';
  }
  
  if (!formattedStart && !formattedEnd) {
    return 'Zie website';
  }
  
  if (formattedStart && formattedEnd) {
    return `${formattedStart} - ${formattedEnd}`;
  }
  
  if (formattedStart) {
    return `vanaf ${formattedStart}`;
  }
  
  return 'Zie website';
}

export function hasValidTime(date: string | Date | null | undefined): boolean {
  if (!date) return false;
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return false;
  
  // Check UTC hours - database stores times in UTC
  const utcHours = d.getUTCHours();
  const utcMinutes = d.getUTCMinutes();
  const utcSeconds = d.getUTCSeconds();
  
  // 00:00:00 UTC or 23:59:59 UTC = no valid time (date-only)
  if (utcHours === 0 && utcMinutes === 0 && utcSeconds === 0) return false;
  if (utcHours === 23 && utcMinutes === 59 && utcSeconds === 59) return false;
  
  return true;
}

const NL_DAYS_SHORT = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const NL_MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatDutchShortDate(date: Date): string {
  const now = new Date();
  if (isSameDay(date, now)) return 'Vandaag';
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (isSameDay(date, tomorrow)) return 'Morgen';
  const day = NL_DAYS_SHORT[date.getDay()];
  const dayNum = String(date.getDate()).padStart(2, '0');
  const month = NL_MONTHS_SHORT[date.getMonth()];
  return `${day} ${dayNum} ${month}`;
}

export function formatSmartEventDate(
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
    const endLabel = formatDutchShortDate(end);
    return `Nu t/m ${endLabel.charAt(0).toLowerCase() + endLabel.slice(1)}`;
  }
  
  return formatDutchShortDate(start);
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
    const endLabel = formatDutchShortDate(end);
    return `Nu t/m ${endLabel.charAt(0).toLowerCase() + endLabel.slice(1)}`;
  }
  
  return formatDutchShortDate(start);
}
