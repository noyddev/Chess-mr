import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Clock,
  Trophy,
  Activity,
  RefreshCw,
} from "lucide-react";
import { formatDate, formatDateShort, getInitials, getResultColor } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface TournamentPageProps {
  params: Promise<{ id: string }>;
}

async function getTournament(id: string) {
  return prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        orderBy: { rank: "asc" },
        include: {
          player: {
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
          },
        },
      },
      rounds: {
        orderBy: { number: "asc" },
        include: {
          pairings: {
            orderBy: { board: "asc" },
            include: {
              whitePlayer: {
                select: {
                  id: true,
                  name: true,
                  federation: true,
                  lichessTitle: true,
                  fideRating: true,
                  lichessRapid: true,
                },
              },
              blackPlayer: {
                select: {
                  id: true,
                  name: true,
                  federation: true,
                  lichessTitle: true,
                  fideRating: true,
                  lichessRapid: true,
                },
              },
            },
          },
        },
      },
    },
  });
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
    <Badge variant={variants[status] || "secondary"}>
      {labels[status] || status}
    </Badge>
  );
}

export default async function TournamentPage({ params }: TournamentPageProps) {
  const { id } = await params;
  const tournament = await getTournament(id);

  if (!tournament) {
    notFound();
  }

  const latestRound = tournament.rounds[tournament.rounds.length - 1];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <section className="border-b border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href="/tournaments"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Badge variant="outline" className="text-xs">
                  #{tournament.externalId}
                </Badge>
                {getStatusBadge(tournament.status)}
              </div>
              <h1 className="text-3xl font-bold mb-4">{tournament.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {tournament.location}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  {tournament.playerCount} لاعب
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-4 w-4" />
                  آخر تحديث: {formatDateShort(tournament.lastSynced)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="standings" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="standings">الترتيب</TabsTrigger>
              <TabsTrigger value="pairings">المواجهات</TabsTrigger>
              <TabsTrigger value="results">النتائج</TabsTrigger>
              <TabsTrigger value="players">اللاعبين</TabsTrigger>
              <TabsTrigger value="info">المعلومات</TabsTrigger>
            </TabsList>

            {/* Standings Tab */}
            <TabsContent value="standings">
              {tournament.players.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      الترتيب الحالي
                      {tournament.status === "ACTIVE" && (
                        <Badge variant="success" className="gap-1 mr-2">
                          <Activity className="h-3 w-3" />
                          مباشر
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">الترتيب</TableHead>
                          <TableHead>اللاعب</TableHead>
                          <TableHead className="text-center">النقاط</TableHead>
                          <TableHead className="text-center">Buchholz</TableHead>
                          <TableHead className="text-center">SB</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tournament.players.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-medium">
                              {entry.rank || "-"}
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/players/${entry.player.id}`}
                                className="flex items-center gap-3 hover:text-primary transition-colors"
                              >
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-xs">
                                    {getInitials(entry.player.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium flex items-center gap-2">
                                    {entry.player.name}
                                    {entry.player.lichessTitle && (
                                      <Badge variant="outline" className="text-xs">
                                        {entry.player.lichessTitle}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {entry.player.federation}
                                  </div>
                                </div>
                              </Link>
                            </TableCell>
                            <TableCell className="text-center font-semibold">
                              {entry.points.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {entry.tiebreak1?.toFixed(1) || "-"}
                            </TableCell>
                            <TableCell className="text-center text-muted-foreground">
                              {entry.tiebreak2?.toFixed(1) || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا يوجد ترتيب متاح</p>
                </Card>
              )}
            </TabsContent>

            {/* Pairings Tab */}
            <TabsContent value="pairings">
              {latestRound ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      الجولة {latestRound.number}
                      {latestRound.name && (
                        <span className="text-sm font-normal text-muted-foreground">
                          - {latestRound.name}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {latestRound.pairings.length > 0 ? (
                      <div className="space-y-3">
                        {latestRound.pairings.map((pairing) => (
                          <div
                            key={pairing.id}
                            className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-4 flex-1">
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                                {pairing.board || "-"}
                              </span>
                              <div className="flex items-center gap-2 flex-1">
                                {pairing.whitePlayer ? (
                                  <Link
                                    href={`/players/${pairing.whitePlayer.id}`}
                                    className="flex items-center gap-2 hover:text-primary"
                                  >
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-primary/10 text-xs">
                                        {getInitials(pairing.whitePlayer.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">
                                      {pairing.whitePlayer.name}
                                    </span>
                                    {pairing.whitePlayer.lichessTitle && (
                                      <Badge variant="outline" className="text-xs">
                                        {pairing.whitePlayer.lichessTitle}
                                      </Badge>
                                    )}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <span
                                className={`text-lg font-bold ${getResultColor(pairing.result)}`}
                              >
                                {pairing.result || "vs"}
                              </span>
                              <div className="flex items-center gap-2 flex-1">
                                {pairing.blackPlayer ? (
                                  <Link
                                    href={`/players/${pairing.blackPlayer.id}`}
                                    className="flex items-center gap-2 hover:text-primary"
                                  >
                                    <span className="font-medium">
                                      {pairing.blackPlayer.name}
                                    </span>
                                    {pairing.blackPlayer.lichessTitle && (
                                      <Badge variant="outline" className="text-xs">
                                        {pairing.blackPlayer.lichessTitle}
                                      </Badge>
                                    )}
                                    <Avatar className="h-8 w-8">
                                      <AvatarFallback className="bg-primary/10 text-xs">
                                        {getInitials(pairing.blackPlayer.name)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        لا توجد مواجهات في هذه الجولة
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا توجد جولات متاحة</p>
                </Card>
              )}
            </TabsContent>

            {/* Results Tab */}
            <TabsContent value="results">
              {tournament.rounds.length > 0 ? (
                <div className="space-y-6">
                  {tournament.rounds.map((round) => (
                    <Card key={round.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">الجولة {round.number}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {round.pairings.filter((p) => p.result && p.result !== "*").length > 0 ? (
                          <div className="space-y-2">
                            {round.pairings
                              .filter((p) => p.result && p.result !== "*")
                              .map((pairing) => (
                                <div
                                  key={pairing.id}
                                  className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground w-8">
                                      {pairing.board || "-"}
                                    </span>
                                    <span className="font-medium">
                                      {pairing.whitePlayer?.name || "-"}
                                    </span>
                                  </div>
                                  <span
                                    className={`font-bold ${getResultColor(pairing.result)}`}
                                  >
                                    {pairing.result}
                                  </span>
                                  <span className="font-medium">
                                    {pairing.blackPlayer?.name || "-"}
                                  </span>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-4">
                            لا توجد نتائج لهذه الجولة
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا توجد نتائج متاحة</p>
                </Card>
              )}
            </TabsContent>

            {/* Players Tab */}
            <TabsContent value="players">
              {tournament.players.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {tournament.players.map((entry) => (
                    <Link key={entry.id} href={`/players/${entry.player.id}`}>
                      <Card className="transition-all hover:border-primary/50 hover:shadow-md">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                {getInitials(entry.player.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold truncate">
                                  {entry.player.name}
                                </span>
                                {entry.player.lichessTitle && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    {entry.player.lichessTitle}
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {entry.player.federation}
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-sm">
                                <span className="text-muted-foreground">
                                  الترتيب: {entry.rank || "-"}
                                </span>
                                <span className="font-semibold text-primary">
                                  {entry.points} نقطة
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">لا يوجد لاعبين</p>
                </Card>
              )}
            </TabsContent>

            {/* Info Tab */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle>معلومات البطولة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-muted-foreground">الاسم</label>
                      <p className="font-medium">{tournament.name}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">الموقع</label>
                      <p className="font-medium">{tournament.location}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">تاريخ البدء</label>
                      <p className="font-medium">{formatDate(tournament.startDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">تاريخ الانتهاء</label>
                      <p className="font-medium">{formatDate(tournament.endDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">عدد اللاعبين</label>
                      <p className="font-medium">{tournament.playerCount}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">الجولة الحالية</label>
                      <p className="font-medium">
                        {latestRound ? `الجولة ${latestRound.number}` : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">المعرف (Chess-Results)</label>
                      <p className="font-medium">#{tournament.externalId}</p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">آخر تحديث</label>
                      <p className="font-medium">{formatDateShort(tournament.lastSynced)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}
