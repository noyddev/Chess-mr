"use client";

import { useQuery } from "@tanstack/react-query";

interface UsePollingOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  interval: number; // in milliseconds
  enabled?: boolean;
}

/**
 * Hook for polling data with automatic stop for finished tournaments
 * Uses React Query under the hood for proper caching and state management
 */
export function useTournamentData<T>({
  queryKey,
  queryFn,
  interval,
  enabled = true,
}: UsePollingOptions<T>) {
  return useQuery({
    queryKey,
    queryFn,
    refetchInterval: enabled ? interval : false, // Stop polling when disabled
    refetchIntervalInBackground: false, // Don't refetch when window loses focus
    staleTime: 1000, // Consider data stale after 1 second for active tournaments
    gcTime: 5 * 60 * 1000, // Keep unused data for 5 minutes
    retry: 1,
  });
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
