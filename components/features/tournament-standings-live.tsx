"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Activity } from "lucide-react";
import { getInitials, getDisplayRating } from "@/lib/utils";

interface Player {
  id: string;
  name: string;
  federation: string;
  lichessTitle: string | null;
  fideRating: number | null;
  lichessRapid: number | null;
  lichessBlitz: number | null;
  lichessClassical: number | null;
}

interface TournamentPlayer {
  id: string;
  rank: number | null;
  points: number;
  tiebreak1: number | null;
  tiebreak2: number | null;
  player: Player;
}

interface TournamentStandingsLiveProps {
  tournamentId: string;
  initialData: TournamentPlayer[];
  isActive: boolean;
}

export function TournamentStandingsLive({
  tournamentId,
  initialData,
  isActive,
}: TournamentStandingsLiveProps) {
  const [players, setPlayers] = useState<TournamentPlayer[]>(initialData);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isPolling, setIsPolling] = useState(false);

  const fetchStandings = useCallback(async () => {
    if (!isActive) return;
    
    setIsPolling(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/standings`);
      if (response.ok) {
        const data = await response.json();
        if (data.data?.players) {
          setPlayers(data.data.players);
          setLastUpdated(new Date());
        }
      }
    } catch (error) {
      console.error("[POLLING_ERROR] Failed to fetch standings:", error);
    } finally {
      setIsPolling(false);
    }
  }, [tournamentId, isActive]);

  useEffect(() => {
    if (!isActive) return;

    // Poll every 30 seconds for active tournaments
    const intervalId = setInterval(fetchStandings, 30000);

    return () => clearInterval(intervalId);
  }, [fetchStandings, isActive]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            الترتيب الحالي
          </div>
          {isActive && (
            <div className="flex items-center gap-2">
              {isPolling && (
                <span className="text-xs text-muted-foreground">جاري التحديث...</span>
              )}
              <Badge variant="success" className="gap-1">
                <Activity className="h-3 w-3" />
                مباشر
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">الترتيب</TableHead>
              <TableHead>اللاعب</TableHead>
              <TableHead className="text-center">التقييم</TableHead>
              <TableHead className="text-center">النقاط</TableHead>
              <TableHead className="text-center">Buchholz</TableHead>
              <TableHead className="text-center">SB</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((entry) => {
              const rating = getDisplayRating(entry.player);
              return (
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
                  <TableCell className="text-center">
                    {rating ? (
                      <span className="font-semibold text-primary">{rating}</span>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
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
              );
            })}
          </TableBody>
        </Table>
        {lastUpdated && (
          <div className="mt-4 text-xs text-muted-foreground text-center">
            آخر تحديث: {lastUpdated.toLocaleTimeString("ar-MR")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
