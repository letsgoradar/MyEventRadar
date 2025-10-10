import * as React from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Een aparte date picker component die alleen de datum component behandelt
// Dit voorkomt problemen met flikkeren in de combi datetime picker
export function DatePickerOnly({
  date,
  setDate,
  className,
  minDate,
}: {
  date?: Date;
  setDate: (date: Date | undefined) => void;
  className?: string;
  minDate?: Date;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? (
              format(date, "PPP", { locale: nl })
            ) : (
              <span>Kies datum</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            initialFocus
            locale={nl}
            disabled={(date) => {
              if (!minDate) return false;
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              return date < today;
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Een aparte time picker component die alleen de tijd component behandelt
export function TimePickerOnly({
  date,
  setTime,
  className,
  disabled = false,
}: {
  date?: Date;
  setTime: (hours: number, minutes: number) => void;
  className?: string;
  disabled?: boolean;
}) {
  // Standaardwaarden instellen
  const selectedDate = date || new Date();
  const selectedHour = selectedDate.getHours().toString().padStart(2, "0");
  const selectedMinute = Math.floor(selectedDate.getMinutes() / 5) * 5;
  const selectedMinuteStr = selectedMinute.toString().padStart(2, "0");

  const handleHourChange = (hour: string) => {
    setTime(parseInt(hour), selectedDate.getMinutes());
  };

  const handleMinuteChange = (minute: string) => {
    setTime(selectedDate.getHours(), parseInt(minute));
  };

  return (
    <div className={cn("flex gap-2", className)}>
      <Select
        disabled={disabled}
        value={selectedHour}
        onValueChange={handleHourChange}
      >
        <SelectTrigger className="w-[80px]">
          <SelectValue placeholder="Uur" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 24 }).map((_, i) => {
            const hour = i.toString().padStart(2, "0");
            return (
              <SelectItem key={hour} value={hour}>
                {hour}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <span className="flex items-center text-base">:</span>
      <Select
        disabled={disabled}
        value={selectedMinuteStr}
        onValueChange={handleMinuteChange}
      >
        <SelectTrigger className="w-[100px]">
          <SelectValue placeholder="Min" />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 12 }).map((_, i) => {
            const minute = (i * 5).toString().padStart(2, "0");
            return (
              <SelectItem key={minute} value={minute}>
                {minute}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}

// Gecombineerde component die zowel de DatePicker als TimePicker gebruikt
export function DateTimePickerSeparate({
  date,
  setDate,
  className,
  minDate,
}: {
  date?: Date;
  setDate: (date: Date | undefined) => void;
  className?: string;
  minDate?: Date;
}) {
  // Functie om alleen de tijd bij te werken, terwijl de datum behouden blijft
  const setTime = (hours: number, minutes: number) => {
    if (!date) {
      const newDate = new Date();
      newDate.setHours(hours, minutes, 0, 0);
      setDate(newDate);
      return;
    }

    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    setDate(newDate);
  };

  return (
    <div className={cn("grid gap-4", className)}>
      <DatePickerOnly date={date} setDate={setDate} minDate={minDate} />
      <TimePickerOnly date={date} setTime={setTime} disabled={!date} />
    </div>
  );
}