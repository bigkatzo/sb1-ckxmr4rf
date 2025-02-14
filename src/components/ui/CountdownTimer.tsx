import React from 'react';

interface CountdownTimerProps {
  targetDate: Date;
  className?: string;
}

export function CountdownTimer({ targetDate, className = '' }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = React.useState(calculateTimeLeft());

  function calculateTimeLeft() {
    const difference = targetDate.getTime() - new Date().getTime();
    
    if (difference <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    }

    return {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60)
    };
  }

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft.days === 0 && timeLeft.hours === 0 && 
      timeLeft.minutes === 0 && timeLeft.seconds === 0) {
    return null;
  }

  return (
    <div className={`text-sm font-mono ${className}`}>
      {timeLeft.days > 0 && (
        <span className="mr-2">{timeLeft.days}d</span>
      )}
      <span className="mr-2">
        {String(timeLeft.hours).padStart(2, '0')}h
      </span>
      <span className="mr-2">
        {String(timeLeft.minutes).padStart(2, '0')}m
      </span>
      <span>
        {String(timeLeft.seconds).padStart(2, '0')}s
      </span>
    </div>
  );
}