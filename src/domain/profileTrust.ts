import type { Demand, Match, PublicProfile, PublicProfileActivity } from "./types";
import { DEMAND_TYPE_LABEL } from "./types";

function isLiveConnection(status: Match["status"]) {
  return status === "CONNECTED" || status === "COMPLETED";
}

export function buildPublicProfileStats(input: {
  userId: string;
  displayName: string;
  defaultArea: string;
  bio: string;
  createdAt: string;
  demands: Demand[];
  matches: Match[];
  viewerIsSelf: boolean;
  authLabel?: string | null;
}): PublicProfile {
  const myMatches = input.matches.filter(
    (m) => m.buyerId === input.userId || m.sellerId === input.userId,
  );
  const completed = myMatches.filter((m) => m.status === "COMPLETED");
  const responseConnections = myMatches.filter(
    (m) => isLiveConnection(m.status) && m.sellerId === input.userId,
  );
  const allConnections = myMatches.filter((m) => isLiveConnection(m.status));

  const demandById = new Map(input.demands.map((d) => [d.id, d]));
  const recentSource = [...completed].sort((a, b) => {
    const at = a.completedAt ?? a.createdAt;
    const bt = b.completedAt ?? b.createdAt;
    return bt.localeCompare(at);
  });
  const recentActivity: PublicProfileActivity[] = recentSource
    .slice(0, 3)
    .map((m) => {
      const d = demandById.get(m.demandId);
      const typeLabel = d ? DEMAND_TYPE_LABEL[d.type] : "거래";
      return {
        id: m.id,
        label: input.viewerIsSelf
          ? `${d?.title ?? typeLabel} · 거래 완료`
          : `${typeLabel} · 거래 완료`,
        href: `/match/${m.id}`,
      };
    });

  return {
    id: input.userId,
    displayName: input.displayName,
    defaultArea: input.defaultArea,
    bio: input.bio,
    createdAt: input.createdAt,
    connectionCount: allConnections.length,
    completedDemandCount: completed.length,
    responseConnectionCount: responseConnections.length,
    authLabel: input.authLabel ?? null,
    recentActivity,
  };
}
