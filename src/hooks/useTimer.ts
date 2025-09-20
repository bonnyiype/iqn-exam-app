import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTimerOptions {
  duration: number; // in seconds
  onTimeUp?: () => void;
  onWarning?: (timeLeft: number) => void;
  warningTime?: number; // in seconds
}

export function useTimer({ duration, onTimeUp, onWarning, warningTime = 300 }: UseTimerOptions) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningTriggeredRef = useRef(false);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          const newTime = Math.max(0, prev - 1);
          
          // Check for warning
          if (warningTime && newTime <= warningTime && !warningTriggeredRef.current && onWarning) {
            warningTriggeredRef.current = true;
            onWarning(newTime);
          }
          
          // Check for time up
          if (newTime === 0) {
            setIsRunning(false);
            if (onTimeUp) onTimeUp();
          }
          
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused, onTimeUp, onWarning, warningTime]);

  const start = useCallback(() => {
    setIsRunning(true);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    setIsPaused(false);
    setTimeLeft(duration);
    warningTriggeredRef.current = false;
  }, [duration]);

  const reset = useCallback(() => {
    setTimeLeft(duration);
    warningTriggeredRef.current = false;
  }, [duration]);

  const addTime = useCallback((seconds: number) => {
    setTimeLeft((prev) => prev + seconds);
  }, []);

  return {
    timeLeft,
    isRunning,
    isPaused,
    start,
    pause,
    resume,
    stop,
    reset,
    addTime,
    minutes: Math.floor(timeLeft / 60),
    seconds: timeLeft % 60
  };
}
