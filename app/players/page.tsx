"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Search, ChevronRight, Trophy } from "lucide-react";
import { getInitials, getDisplayRating } from "@/lib/utils";
import type { PlayerListItem, PaginatedResponse } from "@/lib/api/types";

function PlayersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [players, setPlayers] = useState<PlayerListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 30,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [sort, setSort] = useState(searchParams.get("sort") || "name");

  useEffect(() => {
    const fetchPlayers = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: pagination.limit.toString(),
          search,
          sort,
        });

        const res = await fetch(`/api/players?${params}`);
        if (res.ok) {
          const data: PaginatedResponse<PlayerListItem> = await res.json();
          setPlayers(data.data);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error("Failed to fetch players:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(fetchPlayers, 300);
    return () => clearTimeout(debounce);
  }, [pagination.page, search, sort]);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">اللاعبين</h1>
            <p className="text-muted-foreground">
              قائمة جميع اللاعبين المسجلين في المنصة
            </p>
          </div>
        </div>
      </section>

      {/* Search & Filters */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث عن لاعب..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pr-10"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الترتيب:</span>
              <Select value={sort} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">حسب الاسم</SelectItem>
                  <SelectItem value="rating">حسب التقييم (FIDE)</SelectItem>
                  <SelectItem value="lichessRapid">حسب تقييم سريع</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Players List */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : players.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                عرض {players.length} من {pagination.total} لاعب
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {players.map((player) => {
                  const rating = getDisplayRating(player);
                  return (
                    <Link key={player.id} href={`/players/${player.id}`}>
                      <Card className="group cursor-pointer transition-all hover:border-primary/50 hover:shadow-md h-full">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getInitials(player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">
                                  {player.name}
                                </span>
                                {player.lichessTitle && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {player.lichessTitle}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {player.federation}
                              </div>
                              {rating ? (
                                <div className="flex items-center gap-1 mt-2">
                                  <Trophy className="h-3 w-3 text-amber-500" />
                                  <span className="text-sm font-medium">
                                    {rating}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    تقييم
                                  </span>
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground mt-2">
                                  بدون تقييم
                                </div>
                              )}
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {pagination.page > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPagination((p) => ({ ...p, page: p.page - 1 }))
                      }
                    >
                      السابق
                    </Button>
                  )}

                  <span className="px-4 text-sm text-muted-foreground">
                    صفحة {pagination.page} من {pagination.totalPages}
                  </span>

                  {pagination.page < pagination.totalPages && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPagination((p) => ({ ...p, page: p.page + 1 }))
                      }
                    >
                      التالي
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16">
              <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا يوجد لاعبين</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {search
                  ? `لا توجد نتائج للبحث "${search}"`
                  : "لم يتم العثور على لاعبين. سيتم إضافة اللاعبين عند توفر البيانات."}
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PlayersPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <PlayersContent />
    </Suspense>
  );
}
