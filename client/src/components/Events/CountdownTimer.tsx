import { useState, useEffect } from 'react';
import { formatDistance } from 'date-fns';
import { nl } from 'date-fns/locale';

interface CountdownTimerProps {
  startTime: Date | string;
}

export default function CountdownTimer({ startTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isSoon, setIsSoon] = useState(false);

  useEffect(() => {
    function updateTimer() {
      const now = new Date();
      const eventDate = new Date(startTime);
      const timeDiff = eventDate.getTime() - now.getTime();
      const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

      if (timeDiff <= 0) {
        setTimeLeft('Event is begonnen');
        setIsSoon(true);
        return;
      }

      // Check of het event binnen 12 uur begint
      setIsSoon(timeDiff < TWELVE_HOURS_MS);
      setTimeLeft(formatDistance(eventDate, now, { addSuffix: true, locale: nl }));
    }

    updateTimer();
    const timer = setInterval(updateTimer, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

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
      <div className={`text-sm font-medium ${isSoon ? 'text-red-600' : 'text-blue-600'}`}>
        {timeLeft}
      </div>
    </div>
  );
}