"use client";

import { AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";

interface StaleDataAlertProps {
  lastSynced: Date | null;
  status: "ACTIVE" | "UPCOMING" | "FINISHED";
  minutesThreshold?: number;
}

export function StaleDataAlert({
  lastSynced,
  status,
  minutesThreshold = 30,
}: StaleDataAlertProps) {
  if (!lastSynced) {
    return (
      <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 mb-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              لا توجد بيانات حديثة
            </p>
            <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
              البيانات المعروضة قد تكون غير محدثة
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const now = new Date();
  const ageMs = now.getTime() - lastSynced.getTime();
  const ageMinutes = Math.floor(ageMs / (1000 * 60));
  const ageHours = Math.floor(ageMinutes / 60);

  // For active tournaments, check if data is stale
  const maxAge = status === "ACTIVE" ? minutesThreshold : minutesThreshold * 12;
  const isStale = ageMinutes > maxAge;

  if (!isStale) {
    return null;
  }

  const getTimeAgoText = () => {
    if (ageHours > 0) {
      return `منذ ${ageHours} ساعة${ageHours > 1 ? "" : ""}`;
    }
    return `منذ ${ageMinutes} دقيقة`;
  };

  return (
    <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 p-4 mb-4">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            قد تكون البيانات متأخرة
          </p>
          <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
            آخر تحديث: {getTimeAgoText()}
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-amber-700/80 dark:text-amber-300/80">
          <Clock className="h-4 w-4" />
          <span>
            {ageHours > 0
              ? `${ageHours}h ago`
              : `${ageMinutes}m ago`}
          </span>
        </div>
      </div>
    </Card>
  );
}

/**
 * Sync status indicator for tournament pages
 */
export function SyncStatusBadge({
  lastSynced,
  isSyncing,
}: {
  lastSynced: Date | null;
  isSyncing?: boolean;
}) {
  if (isSyncing) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        جاري التحديث...
      </span>
    );
  }

  if (!lastSynced) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
        <AlertTriangle className="h-3.5 w-3.5" />
        غير متصل
      </span>
    );
  }

  const now = new Date();
  const ageMs = now.getTime() - lastSynced.getTime();
  const ageMinutes = Math.floor(ageMs / (1000 * 60));

  if (ageMinutes > 30) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-amber-600">
        <Clock className="h-3.5 w-3.5" />
        آخر تحديث: {ageMinutes}m ago
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
      <span className="h-2 w-2 rounded-full bg-green-500" />
      محدث
    </span>
  );
}
