import { useState, useEffect } from 'react';
import { formatDistance } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Clock } from 'lucide-react';

interface CountdownTimerProps {
  startTime: Date | string;
  compact?: boolean;
  showPulse?: boolean;
}

export default function CountdownTimer({ startTime, compact = false, showPulse = true }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isSoon, setIsSoon] = useState(false);
  const [isVeryClose, setIsVeryClose] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    function updateTimer() {
      const now = new Date();
      const eventDate = new Date(startTime);
      const timeDiff = eventDate.getTime() - now.getTime();
      
      const ONE_HOUR_MS = 60 * 60 * 1000;
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;
      const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

      if (timeDiff <= 0) {
        setTimeLeft('Event is begonnen');
        setIsSoon(true);
        setIsVeryClose(true);
        setHours(0);
        setMinutes(0);
        setSeconds(0);
        return;
      }

      // Bereken uren, minuten en seconden voor precieze countdown
      const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const secondsLeft = Math.floor((timeDiff % (1000 * 60)) / 1000);
      
      setHours(hoursLeft);
      setMinutes(minutesLeft);
      setSeconds(secondsLeft);

      // Check of het event binnen 1 uur begint (voor precieze countdown)
      setIsVeryClose(timeDiff < ONE_HOUR_MS);
      
      // Check of het event binnen 24 uur begint (voor groene markering)
      setIsSoon(timeDiff < TWENTY_FOUR_HOURS_MS);
      
      // Standaard formattering voor langere periodes
      setTimeLeft(formatDistance(eventDate, now, { addSuffix: true, locale: nl }));
    }

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  // Voor zeer korte periodes (< 1 uur), toon een precieze countdown
  if (isVeryClose) {
    return (
      <div className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-green-600 flex items-center gap-1`}>
        {showPulse && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
        <Clock className="h-3.5 w-3.5 mr-0.5" />
        <span>
          {hours > 0 && `${hours} uur `}
          {minutes > 0 && `${minutes} min `}
          {seconds} sec
        </span>
      </div>
    );
  }

  // Voor compacte weergave (gebruikt in kaarten)
  if (compact) {
    return (
      <div className={`text-xs font-medium ${isSoon ? 'text-green-600' : 'text-blue-600'} flex items-center gap-1`}>
        {isSoon && showPulse && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
        <span>{timeLeft}</span>
      </div>
    );
  }

  // Standaard volledige weergave
  return (
    <div className="space-y-1">
      <div className="text-sm text-gray-600">
        {new Date(startTime).toLocaleDateString('nl-NL', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>
      <div className={`text-sm font-medium flex items-center gap-1 ${isSoon ? 'text-green-600' : 'text-blue-600'}`}>
        {isSoon && showPulse && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>}
        <span>{timeLeft}</span>
      </div>
    </div>
  );
}
}