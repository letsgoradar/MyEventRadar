import * as React from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { X, ChevronUp, ChevronDown } from "lucide-react";
import { 
  format, 
  addDays, 
  startOfDay, 
  isSameDay, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  getDay,
  isBefore,
  isAfter
} from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MonthCalendarProps {
  selectedDays: Date[];
  onDaysChange: (days: Date[]) => void;
  showExpiredEvents: boolean;
  onShowExpiredEventsChange: (show: boolean) => void;
  onClose?: () => void;
}

export function MonthCalendar({ 
  selectedDays, 
  onDaysChange, 
  showExpiredEvents,
  onShowExpiredEventsChange,
  onClose 
}: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const today = startOfDay(new Date());

  // Genereer de dagen voor de huidige maand
  const monthDays = React.useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Bereken offset voor eerste dag van de maand (0 = zondag, 1 = maandag, etc.)
  const monthStartOffset = React.useMemo(() => {
    const firstDay = monthDays[0];
    const dayOfWeek = getDay(firstDay);
    // Converteer naar Monday-first (0 = maandag)
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, [monthDays]);

  // Navigeer naar vorige maand
  const previousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  // Navigeer naar volgende maand
  const nextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const isDaySelected = (day: Date) => {
    return selectedDays.some(selectedDay => isSameDay(selectedDay, day));
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

  // Check of een dag in het verleden ligt
  const isPastDay = (day: Date) => {
    return isBefore(day, today);
  };

  const weekDays = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

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
            data-testid="button-close-calendar"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Maandnavigatie */}
      <div className="flex items-center justify-between border-b pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={previousMonth}
          className="h-8 w-8 p-0"
          data-testid="button-previous-month"
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        
        <span className="font-semibold text-sm">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          className="h-8 w-8 p-0"
          data-testid="button-next-month"
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Weekdag headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Kalender grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells voor offset */}
        {Array.from({ length: monthStartOffset }).map((_, i) => (
          <div key={`empty-${i}`} className="h-10" />
        ))}
        
        {/* Daag cellen */}
        {monthDays.map((day) => {
          const isSelected = isDaySelected(day);
          const isToday = isSameDay(day, today);
          const isPast = isPastDay(day);
          
          return (
            <Button
              key={day.toISOString()}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => toggleDay(day)}
              disabled={isPast && !showExpiredEvents}
              className={cn(
                "h-10 p-1 text-sm font-medium",
                isToday && !isSelected && "border-primary border-2",
                isSelected && "bg-primary text-primary-foreground",
                isPast && !showExpiredEvents && "opacity-30 cursor-not-allowed"
              )}
              data-testid={`button-day-${format(day, 'yyyy-MM-dd')}`}
            >
              {format(day, "d", { locale: nl })}
            </Button>
          );
        })}
      </div>

      {/* Verlopen events toggle */}
      <div className="flex items-center justify-between border-t pt-3">
        <label htmlFor="show-expired" className="text-sm font-medium">
          Verlopen events tonen
        </label>
        <Switch
          id="show-expired"
          checked={showExpiredEvents}
          onCheckedChange={onShowExpiredEventsChange}
          data-testid="switch-show-expired"
        />
      </div>

      {/* Selectie teller */}
      <div className="text-xs text-muted-foreground text-center">
        {selectedDays.length === 0 
          ? "Geen dagen geselecteerd" 
          : `${selectedDays.length} ${selectedDays.length === 1 ? 'dag' : 'dagen'} geselecteerd`}
      </div>
    </div>
  );
}
