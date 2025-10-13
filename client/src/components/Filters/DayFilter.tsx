import * as React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { format, addDays, startOfDay, isSameDay, isWithinInterval } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DayFilterProps {
  selectedDays: Date[];
  onDaysChange: (days: Date[]) => void;
  onClose?: () => void;
}

export function DayFilter({ selectedDays, onDaysChange, onClose }: DayFilterProps) {
  const today = startOfDay(new Date());
  
  // Genereer 14 dagen vooruit (2 weken)
  const days = React.useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => addDays(today, i));
  }, [today]);

  // Groepeer dagen per week
  const weeks = React.useMemo(() => {
    const result: Date[][] = [];
    let currentWeek: Date[] = [];
    
    days.forEach((day, index) => {
      currentWeek.push(day);
      // Na 7 dagen of aan het einde, start nieuwe week
      if ((index + 1) % 7 === 0 || index === days.length - 1) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return result;
  }, [days]);

  const isDaySelected = (day: Date) => {
    return selectedDays.some(selectedDay => isSameDay(selectedDay, day));
  };

  const isWeekFullySelected = (week: Date[]) => {
    return week.every(day => isDaySelected(day));
  };

  const toggleDay = (day: Date) => {
    if (isDaySelected(day)) {
      // Verwijder dag
      onDaysChange(selectedDays.filter(d => !isSameDay(d, day)));
    } else {
      // Voeg dag toe
      onDaysChange([...selectedDays, day]);
    }
  };

  const toggleWeek = (week: Date[]) => {
    if (isWeekFullySelected(week)) {
      // Deselecteer hele week
      onDaysChange(selectedDays.filter(d => !week.some(weekDay => isSameDay(d, weekDay))));
    } else {
      // Selecteer hele week
      const newDays = [...selectedDays];
      week.forEach(day => {
        if (!isDaySelected(day)) {
          newDays.push(day);
        }
      });
      onDaysChange(newDays);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Selecteer dagen</h3>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Week {weekIndex + 1}
              </span>
              <Button
                variant={isWeekFullySelected(week) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleWeek(week)}
                className="h-6 text-xs"
              >
                {isWeekFullySelected(week) ? "Deselecteer week" : "Selecteer week"}
              </Button>
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {week.map((day) => {
                const isSelected = isDaySelected(day);
                const isToday = isSameDay(day, today);
                
                return (
                  <Button
                    key={day.toISOString()}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleDay(day)}
                    className={cn(
                      "flex flex-col items-center justify-center h-12 p-1",
                      isToday && !isSelected && "border-primary border-2",
                      isSelected && "bg-primary text-primary-foreground"
                    )}
                  >
                    <span className="text-[10px] font-medium">
                      {format(day, "EEE", { locale: nl })}
                    </span>
                    <span className="text-xs font-bold">
                      {format(day, "d", { locale: nl })}
                    </span>
                    <span className="text-[9px]">
                      {format(day, "MMM", { locale: nl })}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-muted-foreground text-center">
        {selectedDays.length === 0 
          ? "Geen dagen geselecteerd" 
          : `${selectedDays.length} ${selectedDays.length === 1 ? 'dag' : 'dagen'} geselecteerd`}
      </div>
    </div>
  );
}
