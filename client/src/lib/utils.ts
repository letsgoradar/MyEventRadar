import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"
import { nl } from "date-fns/locale"
import { setMilliseconds, setSeconds, setMinutes } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, formatStr: string): string {
  if (!date) return "Onbekend";

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return format(dateObj, formatStr, { locale: nl });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Ongeldige datum";
  }
}

export function formatCurrency(amount: number | string): string {
  if (!amount) return "€0,00";

  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;

  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(numAmount);
}

export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export function addHours(date: Date, hours: number) {
  const newDate = new Date(date);
  newDate.setHours(date.getHours() + hours);
  return newDate;
}

export function getNextHour() {
  const now = new Date();
  return setMilliseconds(setSeconds(setMinutes(addHours(now, 1), 0), 0), 0);
}