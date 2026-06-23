import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  MapPin,
  Calendar,
  Trophy,
  TrendingUp,
  Activity,
  ExternalLink,
} from "lucide-react";
import { formatDateShort, getInitials, getDisplayRating } from "@/lib/utils";

interface PlayerPageProps {
  params: Promise<{ id: string }>;
}

async function getPlayer(id: string) {
  return prisma.player.findUnique({
    where: { id },
    include: {
      tournaments: {
        orderBy: {
          tournament: {
            startDate: "desc",
          },
        },
        take: 10,
        include: {
          tournament: true,
        },
      },
    },
  });
}

export default async function PlayerPage({ params }: PlayerPageProps) {
  const { id } = await params;
  const player = await getPlayer(id);

  if (!player) {
    notFound();
  }

  const rating = getDisplayRating(player);
  const stats = player.tournaments.length > 0
    ? {
        totalTournaments: player.tournaments.length,
        wins: player.tournaments.filter((t) => t.rank === 1).length,
        podiums: player.tournaments.filter((t) => t.rank && t.rank <= 3).length,
        averageScore: player.tournaments.reduce((sum, t) => sum + t.points, 0) / player.tournaments.length,
      }
    : null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start gap-6">
            <Link href="/players" className="text-muted-foreground hover:text-foreground mt-2">
              <ArrowRight className="h-5 w-5" />
            </Link>
            <div className="flex items-start gap-6 flex-1">
              <Avatar className="h-24 w-24">
                <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
                  {getInitials(player.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold">{player.name}</h1>
                  {player.lichessTitle && (
                    <Badge variant="outline" className="text-lg px-3 py-1">
                      {player.lichessTitle}
                    </Badge>
                  )}
                  {player.fideTitle && (
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {player.fideTitle}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {player.federation}
                  </span>
                  {player.lichessUsername && (
                    <a
                      href={`https://lichess.org/@/${player.lichessUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 hover:text-primary transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {player.lichessUsername}@
                    </a>
                  )}
                  {player.lichessLastSeen && (
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-4 w-4" />
                      آخر ظهور: {formatDateShort(player.lichessLastSeen)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left Column - Ratings */}
            <div className="space-y-6">
              {/* Ratings Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    التقييمات
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {rating ? (
                    <div className="text-center py-4">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {rating}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        التقييم الأعلى
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>التقييم غير متاح</p>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-3">
                    {player.fideRating && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">FIDE</span>
                        <span className="font-semibold">{player.fideRating}</span>
                      </div>
                    )}
                    {player.lichessRapid && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">سريع (Rapid)</span>
                        <span className="font-semibold">{player.lichessRapid}</span>
                      </div>
                    )}
                    {player.lichessBlitz && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">بلتز (Blitz)</span>
                        <span className="font-semibold">{player.lichessBlitz}</span>
                      </div>
                    )}
                    {player.lichessClassical && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">كلاسيكي</span>
                        <span className="font-semibold">{player.lichessClassical}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Stats Card */}
              {stats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      الإحصائيات
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <div className="text-2xl font-bold">{stats.totalTournaments}</div>
                        <div className="text-xs text-muted-foreground">البطولات</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-amber-500/10">
                        <div className="text-2xl font-bold text-amber-600">{stats.wins}</div>
                        <div className="text-xs text-muted-foreground">انتصارات</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-primary/10">
                        <div className="text-2xl font-bold text-primary">{stats.podiums}</div>
                        <div className="text-xs text-muted-foreground">مراكز متقدمة</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-emerald-500/10">
                        <div className="text-2xl font-bold text-emerald-600">
                          {stats.averageScore.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">متوسط النقاط</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Tournament History */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    سجل البطولات
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {player.tournaments.length > 0 ? (
                    <div className="space-y-4">
                      {player.tournaments.map((entry) => (
                        <Link
                          key={entry.id}
                          href={`/tournaments/${entry.tournament.id}`}
                        >
                          <div className="flex items-center justify-between rounded-lg border p-4 transition-all hover:border-primary/50 hover:bg-muted/50">
                            <div className="flex-1">
                              <div className="font-medium hover:text-primary transition-colors">
                                {entry.tournament.name}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{formatDateShort(entry.tournament.startDate)}</span>
                                <span>•</span>
                                <span>{entry.tournament.location}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-left">
                                <div className="text-sm text-muted-foreground">الترتيب</div>
                                <div className="font-semibold">
                                  {entry.rank ? `#${entry.rank}` : "-"}
                                </div>
                              </div>
                              <div className="text-left">
                                <div className="text-sm text-muted-foreground">النقاط</div>
                                <div className="font-semibold text-primary">
                                  {entry.points.toFixed(1)}
                                </div>
                              </div>
                              <Badge
                                variant={
                                  entry.tournament.status === "ACTIVE"
                                    ? "success"
                                    : entry.tournament.status === "UPCOMING"
                                    ? "warning"
                                    : "secondary"
                                }
                              >
                                {entry.tournament.status === "ACTIVE"
                                  ? "نشط"
                                  : entry.tournament.status === "UPCOMING"
                                  ? "قادمة"
                                  : "منتهية"}
                              </Badge>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا يوجد سجل بطولات</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
