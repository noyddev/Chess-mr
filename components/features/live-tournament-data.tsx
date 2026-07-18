"use client";

import { useState, useEffect, useCallback } from "react";

interface UsePollingOptions<T> {
  fetchFn: () => Promise<T>;
  interval: number; // in milliseconds
  enabled?: boolean;
}

export function usePolling<T>({
  fetchFn,
  interval,
  enabled = true,
}: UsePollingOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    fetchData();

    // Set up polling interval
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchData, interval, enabled]);

  return { data, isLoading, error, lastUpdated, refetch: fetchData };
}

interface LiveIndicatorProps {
  isLive?: boolean;
  lastUpdated: Date | null;
}

export function LiveIndicator({ isLive = true, lastUpdated }: LiveIndicatorProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ar-MR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (!isLive) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-green-600 font-medium">مباشر</span>
      {lastUpdated && (
        <span className="text-muted-foreground text-xs">
          ({formatTime(lastUpdated)})
        </span>
      )}
    </div>
  );
}
