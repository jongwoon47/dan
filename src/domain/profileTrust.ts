import type { Demand, Match, PublicProfile, PublicProfileActivity } from "./types";
import { DEMAND_TYPE_LABEL } from "./types";

function finishedLabel(status: Demand["status"]): string {
  if (status === "MATCHED") return "연결됨";
  if (status === "CLOSED") return "마감";
  return status;
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
  const owned = input.demands.filter((d) => d.userId === input.userId);
  const completed = owned.filter(
    (d) => d.status === "MATCHED" || d.status === "CLOSED",
  );
  const responseConnections = input.matches.filter(
    (m) => m.status === "CONNECTED" && m.sellerId === input.userId,
  );
  const allConnections = input.matches.filter(
    (m) =>
      m.status === "CONNECTED" &&
      (m.buyerId === input.userId || m.sellerId === input.userId),
  );

  const recentSource = [...completed].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const recentActivity: PublicProfileActivity[] = recentSource
    .slice(0, 3)
    .map((d) => ({
      id: d.id,
      label: input.viewerIsSelf
        ? `${d.title} · ${finishedLabel(d.status)}`
        : `${DEMAND_TYPE_LABEL[d.type]} · ${finishedLabel(d.status)}`,
      href: input.viewerIsSelf ? `/demand/item/${d.id}` : undefined,
    }));

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
