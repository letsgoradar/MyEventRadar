import * as React from "react"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { format, setHours, setMinutes } from "date-fns"
import { nl } from "date-fns/locale"

export function DateTimePicker({
  date,
  setDate,
  mode = "datetime",
  label = "",
  placement = "bottom",
  className = ""
}: {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  mode?: "datetime" | "date" | "time"
  label?: string
  placement?: "top" | "bottom"
  className?: string
}) {
  // Splits time handling
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "12:00"
  );

  // Update the main date when time changes
  React.useEffect(() => {
    if (date && timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        const newDate = setMinutes(setHours(date, hours), minutes);
        
        // Voorkom oneindige updates door te controleren of de tijden daadwerkelijk verschillen
        const currentHours = date.getHours();
        const currentMinutes = date.getMinutes();
        
        if (currentHours !== hours || currentMinutes !== minutes) {
          setDate(newDate);
        }
      }
    }
  }, [timeValue, date]);

  // Update time input when date changes - maar alleen als de datum verschilt (niet de tijd)
  React.useEffect(() => {
    if (date) {
      const formattedTime = format(date, "HH:mm");
      // Voorkom oneindige lus door alleen te updaten als de tijd anders is
      if (formattedTime !== timeValue) {
        setTimeValue(formattedTime);
      }
    }
  }, [date, timeValue]);

  // Format voor knop
  const buttonFormat = React.useMemo(() => {
    if (!date) return null;
    
    if (mode === "datetime") {
      return `${format(date, "d MMMM yyyy", { locale: nl })} om ${format(date, "HH:mm")}`;
    } else if (mode === "date") {
      return format(date, "d MMMM yyyy", { locale: nl });
    } else {
      return format(date, "HH:mm");
    }
  }, [date, mode]);

  return (
    <div className={className}>
      {label && <Label className="mb-2 block">{label}</Label>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            {mode !== "time" ? (
              <CalendarIcon className="mr-2 h-4 w-4" />
            ) : (
              <Clock className="mr-2 h-4 w-4" />
            )}
            {buttonFormat ? buttonFormat : <span>Selecteer {mode === "time" ? "tijd" : "datum"}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-[9999]" align="start" side={placement}>
          {mode !== "time" && (
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              locale={nl}
            />
          )}
          
          {(mode === "datetime" || mode === "time") && (
            <div className="p-3 border-t">
              <Label className="text-xs text-muted-foreground mb-2 block">Tijd</Label>
              <Input
                type="time"
                value={timeValue}
                onChange={(e) => setTimeValue(e.target.value)}
                className="w-full"
              />
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}