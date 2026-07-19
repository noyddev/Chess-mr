"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw } from "lucide-react";

interface RefreshProviderProps {
  tournamentId: string;
  tournamentStatus: string;
  lastSynced: Date;
}

export function RefreshProvider({
  tournamentId,
  tournamentStatus,
  lastSynced,
}: RefreshProviderProps) {
  const queryClient = useQueryClient();
  const isActive = tournamentStatus === "ACTIVE";
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeSinceUpdate, setTimeSinceUpdate] = useState(0);

  // Track time since last update
  useEffect(() => {
    const updateTime = () => {
      const seconds = Math.floor((Date.now() - lastSynced.getTime()) / 1000);
      setTimeSinceUpdate(seconds);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  // Force a refresh periodically for active tournaments
  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setIsRefreshing(true);
      // Invalidate tournament-related queries to trigger a refetch
      queryClient.invalidateQueries({ queryKey: ["tournament", tournamentId] });
      setTimeout(() => {
        setIsRefreshing(false);
        setTimeSinceUpdate(0);
      }, 2000);
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isActive, tournamentId, queryClient]);

  if (!isActive) return null;

  return (
    <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/50 rounded-lg px-4 py-2 mb-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <Activity className="h-4 w-4 text-green-600" />
        <span className="text-sm font-medium text-green-700 dark:text-green-300">
          تحديث مباشر
        </span>
      </div>
      <div className="flex items-center gap-3 text-sm text-green-600 dark:text-green-400">
        {isRefreshing ? (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            جاري التحديث...
          </span>
        ) : (
          <span>آخر تحديث: منذ {timeSinceUpdate} ثانية</span>
        )}
      </div>
    </div>
  );
}
