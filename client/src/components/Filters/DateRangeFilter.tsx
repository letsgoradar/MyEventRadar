import * as React from "react";
import { Button } from "@/components/ui/button";
import { X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
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
  isAfter,
  isWithinInterval,
  differenceInDays
} from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DateRangeFilterProps {
  startDate: Date | null;
  endDate: Date | null;
  onRangeChange: (start: Date | null, end: Date | null) => void;
  onReset?: () => void;
  onClose?: () => void;
  showExpiredEvents?: boolean;
  onShowExpiredEventsChange?: (show: boolean) => void;
}

export function DateRangeFilter({ 
  startDate,
  endDate,
  onRangeChange,
  onReset,
  onClose,
  showExpiredEvents = false,
  onShowExpiredEventsChange
}: DateRangeFilterProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => startDate || new Date());
  const [selectingEnd, setSelectingEnd] = React.useState(false);
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);
  const today = startOfDay(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  
  const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
  const nextMonthStart = startOfMonth(addMonths(currentMonth, 1));

  const monthStartOffset = React.useMemo(() => {
    const dayOfWeek = getDay(monthStart);
    return dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  }, [monthStart]);

  const daysInCurrentMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const prevMonthDays = React.useMemo(() => {
    if (monthStartOffset === 0) return [];
    const startDay = addDays(prevMonthEnd, -monthStartOffset + 1);
    return eachDayOfInterval({ start: startDay, end: prevMonthEnd });
  }, [prevMonthEnd, monthStartOffset]);

  const totalDaysShown = prevMonthDays.length + daysInCurrentMonth.length;
  const nextMonthDaysCount = totalDaysShown <= 35 ? (35 - totalDaysShown) : (42 - totalDaysShown);
  
  const nextMonthDays = React.useMemo(() => {
    if (nextMonthDaysCount <= 0) return [];
    const endDay = addDays(nextMonthStart, nextMonthDaysCount - 1);
    return eachDayOfInterval({ start: nextMonthStart, end: endDay });
  }, [nextMonthStart, nextMonthDaysCount]);

  const allDays = [...prevMonthDays, ...daysInCurrentMonth, ...nextMonthDays];

  const previousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const isInCurrentMonth = (day: Date) => {
    return isSameDay(startOfMonth(day), monthStart);
  };

  const handleDayClick = (day: Date) => {
    if (!isInCurrentMonth(day)) {
      setCurrentMonth(startOfMonth(day));
    }

    if (!startDate || (startDate && endDate) || selectingEnd === false) {
      onRangeChange(day, null);
      setSelectingEnd(true);
    } else {
      if (isBefore(day, startDate)) {
        onRangeChange(day, startDate);
      } else {
        onRangeChange(startDate, day);
      }
      setSelectingEnd(false);
    }
  };

  const isInRange = (day: Date) => {
    if (!startDate) return false;
    
    const effectiveEndDate = endDate || (selectingEnd && hoverDate ? hoverDate : null);
    if (!effectiveEndDate) return isSameDay(day, startDate);
    
    const rangeStart = isBefore(startDate, effectiveEndDate) ? startDate : effectiveEndDate;
    const rangeEnd = isBefore(startDate, effectiveEndDate) ? effectiveEndDate : startDate;
    
    return isWithinInterval(day, { start: rangeStart, end: rangeEnd });
  };

  const isRangeStart = (day: Date) => {
    if (!startDate) return false;
    if (!endDate && !hoverDate) return isSameDay(day, startDate);
    
    const effectiveEnd = endDate || hoverDate;
    if (!effectiveEnd) return isSameDay(day, startDate);
    
    const rangeStart = isBefore(startDate, effectiveEnd) ? startDate : effectiveEnd;
    return isSameDay(day, rangeStart);
  };

  const isRangeEnd = (day: Date) => {
    const effectiveEnd = endDate || (selectingEnd ? hoverDate : null);
    if (!effectiveEnd || !startDate) return false;
    
    const rangeEnd = isBefore(startDate, effectiveEnd) ? effectiveEnd : startDate;
    return isSameDay(day, rangeEnd);
  };

  const isPastDay = (day: Date) => {
    return isBefore(day, today);
  };

  const handleReset = () => {
    onRangeChange(null, null);
    setSelectingEnd(false);
    onReset?.();
  };

  const getRangeDays = () => {
    if (!startDate || !endDate) return 0;
    return differenceInDays(endDate, startDate) + 1;
  };

  const weekDays = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">Periode selecteren</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
            title="Reset filter"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pb-2 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={previousMonth}
          className="h-7 w-7 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        <span className="font-semibold text-sm">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={nextMonth}
          className="h-7 w-7 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {weekDays.map(day => (
          <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {allDays.map((day) => {
          const inCurrentMonth = isInCurrentMonth(day);
          const inRange = isInRange(day);
          const isStart = isRangeStart(day);
          const isEnd = isRangeEnd(day);
          const isToday = isSameDay(day, today);
          const isPast = isPastDay(day);
          const isDisabled = isPast && !showExpiredEvents;
          
          return (
            <Button
              key={day.toISOString()}
              variant="ghost"
              size="sm"
              onClick={() => !isDisabled && handleDayClick(day)}
              onMouseEnter={() => selectingEnd && setHoverDate(day)}
              onMouseLeave={() => setHoverDate(null)}
              disabled={isDisabled}
              className={cn(
                "h-8 w-full p-0 text-sm font-medium rounded-none relative",
                !inCurrentMonth && "text-muted-foreground/50",
                inCurrentMonth && "text-foreground",
                isToday && !inRange && "font-bold underline",
                inRange && !isStart && !isEnd && "bg-primary/20 text-primary-foreground/90",
                isStart && "bg-primary text-primary-foreground rounded-l-md",
                isEnd && "bg-primary text-primary-foreground rounded-r-md",
                isStart && isEnd && "rounded-md",
                isDisabled && "opacity-30 cursor-not-allowed"
              )}
            >
              {format(day, "d")}
            </Button>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs pt-2 border-t">
        <div className="text-muted-foreground">
          {!startDate && !endDate && (
            <span>Klik op een startdatum</span>
          )}
          {startDate && !endDate && selectingEnd && (
            <span>Klik op een einddatum</span>
          )}
          {startDate && endDate && (
            <span>
              {format(startDate, 'd MMM', { locale: nl })} - {format(endDate, 'd MMM', { locale: nl })}
              {' '}({getRangeDays()} {getRangeDays() === 1 ? 'dag' : 'dagen'})
            </span>
          )}
          {startDate && !endDate && !selectingEnd && (
            <span>{format(startDate, 'd MMMM yyyy', { locale: nl })}</span>
          )}
        </div>
      </div>

      {onShowExpiredEventsChange && (
        <div className="flex items-center justify-between pt-2 border-t">
          <label htmlFor="show-expired-range" className="text-xs font-medium text-muted-foreground">
            Verlopen events tonen
          </label>
          <Button
            variant={showExpiredEvents ? "default" : "outline"}
            size="sm"
            onClick={() => onShowExpiredEventsChange(!showExpiredEvents)}
            className="h-6 text-xs px-2"
          >
            {showExpiredEvents ? "Aan" : "Uit"}
          </Button>
        </div>
      )}
    </div>
  );
}
