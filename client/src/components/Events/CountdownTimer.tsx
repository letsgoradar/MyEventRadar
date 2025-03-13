import { useState, useEffect } from 'react';
import { formatDistance } from 'date-fns';
import { nl } from 'date-fns/locale';

interface CountdownTimerProps {
  startTime: Date | string;
}

export default function CountdownTimer({ startTime }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [detailedTime, setDetailedTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    function updateTimer() {
      const now = new Date();
      const eventDate = new Date(startTime);
      const timeDiff = eventDate.getTime() - now.getTime();

      if (timeDiff <= 0) {
        setTimeLeft('Event is begonnen');
        return;
      }

      // Calculate detailed time
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

      setDetailedTime({ days, hours, minutes, seconds });
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
      <div className="text-sm font-medium text-blue-600">{timeLeft}</div>
      <div className="grid grid-cols-4 gap-1 text-xs">
        <div className="bg-blue-50 rounded p-1 text-center">
          <span className="font-semibold">{detailedTime.days}</span>
          <div className="text-gray-500">dagen</div>
        </div>
        <div className="bg-blue-50 rounded p-1 text-center">
          <span className="font-semibold">{detailedTime.hours}</span>
          <div className="text-gray-500">uur</div>
        </div>
        <div className="bg-blue-50 rounded p-1 text-center">
          <span className="font-semibold">{detailedTime.minutes}</span>
          <div className="text-gray-500">min</div>
        </div>
        <div className="bg-blue-50 rounded p-1 text-center">
          <span className="font-semibold">{detailedTime.seconds}</span>
          <div className="text-gray-500">sec</div>
        </div>
      </div>
    </div>
  );
}