"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center p-8 max-w-md">
        <h1 className="text-2xl font-bold mb-4">حدث خطأ</h1>
        <p className="text-muted-foreground mb-6">
          عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
        </p>
        <button
          onClick={reset}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  );
}
