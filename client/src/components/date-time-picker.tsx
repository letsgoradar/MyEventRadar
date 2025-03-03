
import * as React from "react";
import { format } from "date-fns";
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

export function DateTimePicker({
  date,
  setDate,
  mode = "datetime"
}: {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  mode?: "datetime" | "date" | "time"
}) {
  const minuteOptions = [0, 15, 30, 45];
  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  if (mode === "date" || mode === "time") {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "w-[240px] justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : <span>Pick a date</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode={mode === "time" ? "time" : "single"}
            selected={date}
            onSelect={setDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    );
  }

  // For datetime mode (default)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP HH:mm") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            if (newDate) {
              const newDateTime = new Date(newDate);
              newDateTime.setHours(date ? date.getHours() : 0);
              newDateTime.setMinutes(date ? date.getMinutes() : 0);
              setDate(newDateTime);
            }
          }}
          initialFocus
        />
        <div className="border-t p-3 flex justify-between">
          <div className="mr-2">
            <Select
              value={date ? date.getHours().toString() : "0"}
              onValueChange={(value) => {
                if (date) {
                  const newDate = new Date(date);
                  newDate.setHours(parseInt(value));
                  setDate(newDate);
                }
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent>
                {hourOptions.map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {hour.toString().padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Select
              value={date ? date.getMinutes().toString() : "0"}
              onValueChange={(value) => {
                if (date) {
                  const newDate = new Date(date);
                  newDate.setMinutes(parseInt(value));
                  setDate(newDate);
                }
              }}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent>
                {minuteOptions.map((minute) => (
                  <SelectItem key={minute} value={minute.toString()}>
                    {minute.toString().padStart(2, "0")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
