"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, Trophy, Loader2, X } from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import type { LiveSearchResult } from "@/lib/api/types";

interface LiveSearchProps {
  onClose: () => void;
}

export function LiveSearch({ onClose }: LiveSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LiveSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      search(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, search]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result.type === "player") {
        router.push(`/players/${result.id}`);
      } else {
        router.push(`/tournaments/${result.id}`);
      }
      onClose();
    }
  };

  const groupedResults = {
    players: results.filter((r) => r.type === "player"),
    tournaments: results.filter((r) => r.type === "tournament"),
  };

  return (
    <div className="relative mx-auto max-w-2xl">
      <div className="relative">
        <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="ابحث عن لاعب أو بطولة..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pr-12"
        />
        {isLoading && (
          <Loader2 className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <button
          onClick={onClose}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-auto rounded-xl border bg-popover shadow-lg animate-fade-in">
          {groupedResults.players.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>اللاعبين</span>
              </div>
              {groupedResults.players.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => {
                    router.push(`/players/${result.id}`);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    selectedIndex === index && "bg-accent"
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {getInitials(result.title)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{result.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {result.subtitle}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {groupedResults.tournaments.length > 0 && (
            <div className="border-t p-2">
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground">
                <Trophy className="h-4 w-4" />
                <span>البطولات</span>
              </div>
              {groupedResults.tournaments.map((result, index) => {
                const globalIndex = groupedResults.players.length + index;
                return (
                  <button
                    key={result.id}
                    onClick={() => {
                      router.push(`/tournaments/${result.id}`);
                      onClose();
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      selectedIndex === globalIndex && "bg-accent"
                    )}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                      <Trophy className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{result.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {result.subtitle}
                        </span>
                        {result.status && (
                          <Badge
                            variant={
                              result.status === "ACTIVE"
                                ? "success"
                                : result.status === "UPCOMING"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {result.status === "ACTIVE"
                              ? "نشط"
                              : result.status === "UPCOMING"
                              ? "قادمة"
                              : "منتهية"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {query.length >= 2 && results.length === 0 && !isLoading && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border bg-popover p-8 text-center shadow-lg animate-fade-in">
          <p className="text-muted-foreground">لا توجد نتائج</p>
        </div>
      )}
    </div>
  );
}
