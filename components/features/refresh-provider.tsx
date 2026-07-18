"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [lastUpdated, setLastUpdated] = useState(lastSynced);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(30);

  const isActive = tournamentStatus === "ACTIVE";

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setTimeUntilRefresh((prev) => {
        if (prev <= 1) {
          // Time to refresh
          setIsRefreshing(true);
          router.refresh();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, router]);

  useEffect(() => {
    if (isRefreshing) {
      // Wait for router.refresh to complete
      const timeout = setTimeout(() => {
        setIsRefreshing(false);
        setLastUpdated(new Date());
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [isRefreshing]);

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
          <span>التحديث التالي خلال {timeUntilRefresh} ثانية</span>
        )}
      </div>
    </div>
  );
}
