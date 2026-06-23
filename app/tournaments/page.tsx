import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trophy,
  Users,
  Calendar,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { formatDateShort } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TournamentsPageProps {
  searchParams: Promise<{
    page?: string;
    status?: string;
    sort?: string;
  }>;
}

async function getTournaments(params: {
  page: number;
  status?: string;
  sort?: string;
}) {
  const { page, status, sort } = params;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (status && status !== "all") {
    where.status = status.toUpperCase();
  }

  const orderBy: Record<string, string> = {};
  switch (sort) {
    case "name":
      orderBy.name = "asc";
      break;
    case "playerCount":
      orderBy.playerCount = "desc";
      break;
    default:
      orderBy.startDate = "desc";
  }

  const [tournaments, total] = await Promise.all([
    prisma.tournament.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        location: true,
        startDate: true,
        endDate: true,
        status: true,
        playerCount: true,
        federation: true,
      },
    }),
    prisma.tournament.count({ where }),
  ]);

  return {
    tournaments,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function getStatusBadge(status: string) {
  const variants: Record<string, "success" | "warning" | "secondary"> = {
    ACTIVE: "success",
    UPCOMING: "warning",
    FINISHED: "secondary",
  };
  const labels: Record<string, string> = {
    ACTIVE: "نشط",
    UPCOMING: "قادمة",
    FINISHED: "منتهية",
  };
  return (
    <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>
  );
}

export default async function TournamentsPage({
  searchParams,
}: TournamentsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const { tournaments, pagination } = await getTournaments({
    page,
    status: params.status,
    sort: params.sort,
  });

  const currentStatus = params.status || "all";
  const currentSort = params.sort || "startDate";

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">البطولات</h1>
            <p className="text-muted-foreground">
              تصفح جميع بطولات الشطرنج في موريتانيا
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الحالة:</span>
              <Select defaultValue={currentStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="الكل" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="active">نشطة</SelectItem>
                  <SelectItem value="upcoming">قادمة</SelectItem>
                  <SelectItem value="finished">منتهية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">الترتيب:</span>
              <Select defaultValue={currentSort}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="startDate">حسب التاريخ</SelectItem>
                  <SelectItem value="name">حسب الاسم</SelectItem>
                  <SelectItem value="playerCount">حسب عدد اللاعبين</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament List */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {tournaments.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-muted-foreground">
                عرض {tournaments.length} من {pagination.total} بطولة
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tournaments.map((tournament) => (
                  <Link
                    key={tournament.id}
                    href={`/tournaments/${tournament.id}`}
                  >
                    <Card className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50 h-full">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="line-clamp-2 text-lg font-semibold group-hover:text-primary transition-colors">
                            {tournament.name}
                          </CardTitle>
                          {getStatusBadge(tournament.status)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateShort(tournament.startDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {tournament.location}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Users className="h-4 w-4" />
                            {tournament.playerCount} لاعب
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link href={`/tournaments?page=${page - 1}&status=${currentStatus}&sort=${currentSort}`}>
                      <Button variant="outline" size="sm">
                        السابق
                      </Button>
                    </Link>
                  )}

                  <span className="px-4 text-sm text-muted-foreground">
                    صفحة {page} من {pagination.totalPages}
                  </span>

                  {page < pagination.totalPages && (
                    <Link href={`/tournaments?page=${page + 1}&status=${currentStatus}&sort=${currentSort}`}>
                      <Button variant="outline" size="sm">
                        التالي
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center py-16">
              <Trophy className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد بطولات</h3>
              <p className="text-muted-foreground text-center max-w-md">
                {currentStatus !== "all"
                  ? `لا توجد بطولات ${currentStatus === "active" ? "نشطة" : currentStatus === "upcoming" ? "قادمة" : "منتهية"} حالياً`
                  : "لم يتم العثور على بطولات. سيتم إضافة البطولات عند توفرها."}
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
