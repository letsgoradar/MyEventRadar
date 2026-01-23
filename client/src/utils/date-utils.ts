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
    minute: '2-digit' 
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
