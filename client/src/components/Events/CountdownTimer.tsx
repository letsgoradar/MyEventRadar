import * as React from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
  showHours?: boolean; // Voor events binnen 24 uur
  showMinutesSeconds?: boolean; // Voor events binnen 1 uur
  pulsate?: boolean;
}

export function CountdownTimer({
  targetDate,
  className,
  showHours = true,
  showMinutesSeconds = false,
  pulsate = false,
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = React.useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  
  const [isExpired, setIsExpired] = React.useState(false);
  
  // De interval ID om de countdown te updaten
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);
  
  // Update de countdown elke seconde
  React.useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const targetTime = new Date(targetDate).getTime();
      const difference = targetTime - now.getTime();
      
      if (difference <= 0) {
        // Event is verlopen
        setIsExpired(true);
        clearInterval(intervalRef.current!);
        return;
      }
      
      // Bereken de resterende tijd
      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);
      
      setTimeLeft({ days, hours, minutes, seconds });
    };
    
    // Initiële update
    updateCountdown();
    
    // Update elke seconde
    intervalRef.current = setInterval(updateCountdown, 1000);
    
    // Cleanup interval bij unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [targetDate]);
  
  // Render niets als de datum al is geweest
  if (isExpired) {
    return null;
  }
  
  // Verschillende weergave voor events binnen 24 uur en binnen 1 uur
  if (timeLeft.days === 0 && showHours) {
    if (timeLeft.hours === 0 && showMinutesSeconds) {
      // Binnen 1 uur: toon minuten en seconden
      return (
        <div 
          className={cn(
            "inline-flex items-center rounded-full py-1 px-2 text-xs font-medium",
            pulsate ? "animate-pulse bg-red-500 text-white" : "bg-amber-100 text-amber-800",
            className
          )}
        >
          <span className="whitespace-nowrap">
            {timeLeft.minutes < 10 ? `0${timeLeft.minutes}` : timeLeft.minutes}:
            {timeLeft.seconds < 10 ? `0${timeLeft.seconds}` : timeLeft.seconds}
          </span>
        </div>
      );
    }
    
    // Binnen 24 uur: toon uren en minuten
    return (
      <div 
        className={cn(
          "inline-flex items-center rounded-full py-1 px-2 text-xs font-medium bg-green-100 text-green-800",
          className
        )}
      >
        <span className="whitespace-nowrap">
          Nog {timeLeft.hours}u {timeLeft.minutes}m
        </span>
      </div>
    );
  }
  
  // Default weergave voor events die verder in de toekomst zijn
  return null;
}

export default CountdownTimer;