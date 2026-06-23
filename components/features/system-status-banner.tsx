"use client";

import { AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react";

interface SystemStatusBannerProps {
  status: "ok" | "degraded" | "error";
  lastSync: Date | null;
  databaseConnected: boolean;
}

export function SystemStatusBanner({
  status,
  lastSync,
  databaseConnected,
}: SystemStatusBannerProps) {
  // Only show banner if there's a problem
  if (status === "ok" && databaseConnected) {
    return null;
  }

  const formatLastSync = (date: Date | null) => {
    if (!date) return "غير متوفر";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (minutes < 1) return "الآن";
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return date.toLocaleDateString("ar-MR");
  };

  if (!databaseConnected) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6">
        <div className="flex items-center gap-2">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">خطأ في قاعدة البيانات</span>
        </div>
        <p className="text-sm mt-1 opacity-80">
          تعذر الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">نظام غير متوفر</span>
        </div>
        <p className="text-sm mt-1 opacity-80">
          حدث خطأ في النظام. البيانات قد لا تكون محدثة. آخر تحديث: {formatLastSync(lastSync)}
        </p>
      </div>
    );
  }

  if (status === "degraded") {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg mb-6">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          <span className="font-medium">تحديث متأخر</span>
        </div>
        <p className="text-sm mt-1 opacity-80">
          آخر تحديث للبيانات: {formatLastSync(lastSync)}. قد لا تعكس البيانات الحالية أحدث النتائج.
        </p>
      </div>
    );
  }

  return null;
}

interface DataStatusBadgeProps {
  lastUpdated: Date | null;
  status: "ok" | "degraded" | "error";
}

export function DataStatusBadge({ lastUpdated, status }: DataStatusBadgeProps) {
  const formatTime = (date: Date | null) => {
    if (!date) return "غير متوفر";
    return date.toLocaleString("ar-MR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === "ok" && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>آخر تحديث: {formatTime(lastUpdated)}</span>
        </span>
      )}
      {status === "degraded" && (
        <span className="flex items-center gap-1 text-yellow-600">
          <RefreshCw className="h-4 w-4" />
          <span>متأخر: {formatTime(lastUpdated)}</span>
        </span>
      )}
      {status === "error" && (
        <span className="flex items-center gap-1 text-red-600">
          <XCircle className="h-4 w-4" />
          <span>خطأ</span>
        </span>
      )}
    </div>
  );
}

interface EmptyStateProps {
  type: "no-data" | "error" | "loading";
  message?: string;
}

export function DataEmptyState({ type, message }: EmptyStateProps) {
  if (type === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive/50 mb-4" />
        <p className="text-muted-foreground font-medium">فشل في تحميل البيانات</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          {message || "يرجى المحاولة لاحقاً"}
        </p>
      </div>
    );
  }

  if (type === "loading") {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <RefreshCw className="h-12 w-12 text-muted-foreground/50 mb-4 animate-spin" />
        <p className="text-muted-foreground">جاري التحميل...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <p className="text-muted-foreground">لا توجد بيانات متاحة</p>
      <p className="text-sm text-muted-foreground/70 mt-1">
        {message || "لم يتم استيراد أي بيانات بعد"}
      </p>
    </div>
  );
}

// Add Trophy import for EmptyState
import { Trophy } from "lucide-react";
