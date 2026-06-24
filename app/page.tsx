import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SystemStatusBanner, DataEmptyState } from "@/components/features/system-status-banner";

export const dynamic = "force-dynamic";
import {
  Trophy,
  Users,
  TrendingUp,
  Calendar,
  MapPin,
  ArrowLeft,
  Activity,
} from "lucide-react";
import { formatDateShort, getInitials, getDisplayRating } from "@/lib/utils";

interface HomePageData {
  activeTournaments: Array<{
    id: string;
    name: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    playerCount: number;
  }>;
  upcomingTournaments: Array<{
    id: string;
    name: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    playerCount: number;
  }>;
  recentTournaments: Array<{
    id: string;
    name: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    playerCount: number;
  }>;
  topPlayers: Array<{
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideTitle: string | null;
    fideRating: number | null;
    lichessRapid: number | null;
    lichessBlitz: number | null;
    lichessClassical: number | null;
  }>;
  totalTournaments: number;
  totalPlayers: number;
  lastSync: Date | null;
  systemStatus: "ok" | "degraded" | "error";
  databaseConnected: boolean;
}

async function getHomePageData(): Promise<HomePageData> {
  // Check DATABASE_URL first
  if (!process.env.DATABASE_URL) {
    console.error("[HOMEPAGE_ERROR] DATABASE_URL environment variable is not set");
    return {
      activeTournaments: [],
      upcomingTournaments: [],
      recentTournaments: [],
      topPlayers: [],
      totalTournaments: 0,
      totalPlayers: 0,
      lastSync: null,
      systemStatus: "error",
      databaseConnected: false,
    };
  }

  try {
    console.log("[HOMEPAGE] Fetching data from database...");
    
    const [
      activeTournaments,
      upcomingTournaments,
      recentTournaments,
      topPlayers,
      stats,
    ] = await Promise.all([
      prisma.tournament.findMany({
        where: { status: "ACTIVE" },
        orderBy: { startDate: "desc" },
        take: 6,
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          status: true,
          playerCount: true,
        },
      }),
      prisma.tournament.findMany({
        where: { status: "UPCOMING" },
        orderBy: { startDate: "asc" },
        take: 3,
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          status: true,
          playerCount: true,
        },
      }),
      prisma.tournament.findMany({
        where: { status: "FINISHED" },
        orderBy: { endDate: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          location: true,
          startDate: true,
          endDate: true,
          status: true,
          playerCount: true,
        },
      }),
      prisma.player.findMany({
        orderBy: { fideRating: "desc" },
        take: 10,
        select: {
          id: true,
          name: true,
          federation: true,
          lichessTitle: true,
          fideTitle: true,
          fideRating: true,
          lichessRapid: true,
          lichessBlitz: true,
          lichessClassical: true,
        },
      }),
      Promise.all([
        prisma.tournament.count(),
        prisma.player.count(),
        prisma.syncLog.findFirst({
          where: { source: "chess-results", status: "success" },
          orderBy: { completedAt: "desc" },
          select: { completedAt: true },
        }),
      ]),
    ]);

    console.log("[HOMEPAGE] Data fetched successfully:", {
      activeTournaments: activeTournaments.length,
      upcomingTournaments: upcomingTournaments.length,
      recentTournaments: recentTournaments.length,
      topPlayers: topPlayers.length,
      totalTournaments: stats[0],
      totalPlayers: stats[1],
    });

    return {
      activeTournaments,
      upcomingTournaments,
      recentTournaments,
      topPlayers,
      totalTournaments: stats[0],
      totalPlayers: stats[1],
      lastSync: stats[2]?.completedAt ?? null,
      systemStatus: "ok",
      databaseConnected: true,
    };
  } catch (error) {
    console.error("[HOMEPAGE_ERROR] Failed to fetch home page data:", error);
    console.error("[HOMEPAGE_ERROR] Error details:", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      activeTournaments: [],
      upcomingTournaments: [],
      recentTournaments: [],
      topPlayers: [],
      totalTournaments: 0,
      totalPlayers: 0,
      lastSync: null,
      systemStatus: "error",
      databaseConnected: false,
    };
  }
}

function TournamentCard({
  tournament,
}: {
  tournament: {
    id: string;
    name: string;
    location: string;
    startDate: Date;
    endDate: Date;
    status: string;
    playerCount: number;
  };
}) {
  const statusVariant =
    tournament.status === "ACTIVE"
      ? "success"
      : tournament.status === "UPCOMING"
      ? "warning"
      : "secondary";

  const statusLabel =
    tournament.status === "ACTIVE"
      ? "نشط"
      : tournament.status === "UPCOMING"
      ? "قادمة"
      : "منتهية";

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className="group cursor-pointer transition-all duration-300 hover:shadow-lg hover:border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-2 text-lg font-semibold group-hover:text-primary transition-colors">
              {tournament.name}
            </CardTitle>
            <Badge variant={statusVariant as "success" | "warning" | "secondary"}>
              {statusLabel}
            </Badge>
          </div>
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
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              {tournament.playerCount} لاعب
            </span>
            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function PlayerRow({
  player,
  index,
}: {
  player: {
    id: string;
    name: string;
    federation: string;
    lichessTitle: string | null;
    fideTitle: string | null;
    fideRating: number | null;
    lichessRapid: number | null;
    lichessBlitz: number | null;
    lichessClassical: number | null;
  };
  index: number;
}) {
  const rating = getDisplayRating(player);

  return (
    <Link href={`/players/${player.id}`}>
      <div className="flex items-center gap-4 rounded-lg px-3 py-2 transition-colors hover:bg-muted">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
          {index + 1}
        </span>
        <Avatar className="h-9 w-9">
          <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
            {getInitials(player.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{player.name}</span>
            {player.lichessTitle && (
              <Badge variant="outline" className="text-xs">
                {player.lichessTitle}
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {player.federation}
          </span>
        </div>
        {rating ? (
          <div className="text-left">
            <span className="text-sm font-semibold">{rating}</span>
            <span className="text-xs text-muted-foreground mr-1">تقييم</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">بدون تقييم</span>
        )}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const data = await getHomePageData();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/50 to-background">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Activity className="h-4 w-4" />
              <span>المنصة الرسمية للشطرنج الموريتاني</span>
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              <span className="gradient-text">Chess.MR</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              منصة شاملة للمباريات والبطولات والتصنيفات. تتبع أداءك وتفاعل مع مجتمع
              الشطرنج في موريتانيا
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Link href="/tournaments">
                <Button size="lg" className="gap-2">
                  <Trophy className="h-5 w-5" />
                  تصفح البطولات
                </Button>
              </Link>
              <Link href="/players">
                <Button variant="outline" size="lg" className="gap-2">
                  <Users className="h-5 w-5" />
                  قائمة اللاعبين
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* System Status Banner */}
        <SystemStatusBanner
          status={data.systemStatus}
          lastSync={data.lastSync}
          databaseConnected={data.databaseConnected}
        />

        {/* Decorative chess pattern */}
        <div className="absolute inset-0 -z-10 opacity-5">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: `
                linear-gradient(45deg, currentColor 25%, transparent 25%),
                linear-gradient(-45deg, currentColor 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, currentColor 75%),
                linear-gradient(-45deg, transparent 75%, currentColor 75%)
              `,
              backgroundSize: "40px 40px",
              backgroundPosition: "0 0, 0 20px, 20px -20px, -20px 0px",
            }}
          />
        </div>
      </section>

      {/* Statistics Section */}
      <section className="border-b border-border bg-background py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Trophy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalTournaments}</p>
                <p className="text-sm text-muted-foreground">إجمالي البطولات</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.totalPlayers}</p>
                <p className="text-sm text-muted-foreground">عدد اللاعبين</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.activeTournaments.length}</p>
                <p className="text-sm text-muted-foreground">بطولات نشطة</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                {data.lastSync ? (
                  <>
                    <p className="text-sm font-medium">
                      {formatDateShort(data.lastSync)}
                    </p>
                    <p className="text-xs text-muted-foreground">آخر تحديث</p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">غير متصل</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tournaments Section */}
      <section className="py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="active" className="w-full">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">البطولات</h2>
              <TabsList>
                <TabsTrigger value="active">نشطة</TabsTrigger>
                <TabsTrigger value="upcoming">قادمة</TabsTrigger>
                <TabsTrigger value="recent">الأخيرة</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active">
              {data.activeTournaments.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.activeTournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا توجد بطولات نشطة حالياً</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    سيتم عرض البطولات النشطة هنا عند توفرها
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="upcoming">
              {data.upcomingTournaments.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.upcomingTournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا توجد بطولات قادمة</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    سيتم عرض البطولات القادمة هنا عند توفرها
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="recent">
              {data.recentTournaments.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.recentTournaments.map((tournament) => (
                    <TournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا توجد بطولات سابقة</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    سيتم عرض البطولات المنتهية هنا
                  </p>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-8 text-center">
            <Link href="/tournaments">
              <Button variant="outline" className="gap-2">
                عرض جميع البطولات
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Top Players Section */}
      <section className="border-t border-border bg-muted/30 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">أفضل اللاعبين</h2>
            <Link href="/players">
              <Button variant="ghost" className="gap-2">
                عرض الجميع
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {data.topPlayers.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.topPlayers.map((player, index) => (
                <PlayerRow key={player.id} player={player} index={index} />
              ))}
            </div>
          ) : (
            <Card className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">لا يوجد لاعبون مسجلون</p>
              <p className="text-sm text-muted-foreground mt-1">
                سيتم عرض أفضل اللاعبين هنا عند توفر البيانات
              </p>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
