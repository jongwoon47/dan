import { demandTypeLabel, type DemandTypeCopy } from "@/copy/demandTypeLabel";
import { ko } from "@/copy/ko";
import { jaPilotCopy } from "@/copy/useDanCopy";
import type { DealDispute, Demand, Match, PublicProfile, PublicProfileActivity } from "./types";

function isLiveConnection(status: Match["status"]) {
  return status === "CONNECTED" || status === "COMPLETED";
}

const KO_TYPE_COPY: DemandTypeCopy = {
  typeBuy: ko.typeBuy,
  typeBorrow: ko.typeBorrow,
  typeTask: ko.typeTask,
  typeService: ko.typeService,
};

const JA_TYPE_COPY: DemandTypeCopy = {
  typeBuy: jaPilotCopy.typeBuy ?? ko.typeBuy,
  typeBorrow: jaPilotCopy.typeBorrow ?? ko.typeBorrow,
  typeTask: jaPilotCopy.typeTask ?? ko.typeTask,
  typeService: jaPilotCopy.typeService ?? ko.typeService,
};

export function buildPublicProfileStats(input: {
  userId: string;
  displayName: string;
  defaultArea: string;
  bio: string;
  createdAt: string;
  demands: Demand[];
  matches: Match[];
  disputes?: DealDispute[];
  viewerIsSelf: boolean;
  identityVerified?: boolean;
  authLabel?: string | null;
  /** Locale for recent-activity labels (demo store). Default Korean. */
  locale?: "ko" | "ja";
}): PublicProfile {
  const myMatches = input.matches.filter(
    (m) => m.buyerId === input.userId || m.sellerId === input.userId,
  );
  const completed = myMatches.filter((m) => m.status === "COMPLETED");
  const responseConnections = myMatches.filter(
    (m) => isLiveConnection(m.status) && m.sellerId === input.userId,
  );
  const allConnections = myMatches.filter((m) => isLiveConnection(m.status));
  const buyerFaultCancellationCount = myMatches.filter(
    (m) => m.buyerId === input.userId && m.cancelFaultParty === "BUYER",
  ).length;
  const sellerFaultCancellationCount = myMatches.filter(
    (m) => m.sellerId === input.userId && m.cancelFaultParty === "SELLER",
  ).length;
  const disputes = input.disputes ?? [];
  const myDisputes = disputes.filter((d) =>
    myMatches.some((m) => m.id === d.matchId),
  );
  const unresolvedDisputeCount = myDisputes.filter(
    (d) => d.status === "OPEN" || d.status === "REVIEWING",
  ).length;
  const confirmedMismatchCount = myDisputes.filter((d) => {
    const m = myMatches.find((x) => x.id === d.matchId);
    return (
      d.reason === "SNAPSHOT_MISMATCH" &&
      d.attributedFault === "SELLER" &&
      m?.sellerId === input.userId
    );
  }).length;

  const demandById = new Map(input.demands.map((d) => [d.id, d]));
  const recentSource = [...completed].sort((a, b) => {
    const at = a.completedAt ?? a.createdAt;
    const bt = b.completedAt ?? b.createdAt;
    return bt.localeCompare(at);
  });
  const typeCopy = input.locale === "ja" ? JA_TYPE_COPY : KO_TYPE_COPY;
  const tradeDone =
    input.locale === "ja"
      ? (jaPilotCopy.profileCompleted ?? "取引完了")
      : ko.profileCompleted;
  const tradeFallback = input.locale === "ja" ? "取引" : "거래";
  const recentActivity: PublicProfileActivity[] = recentSource
    .slice(0, 3)
    .map((m) => {
      const d = demandById.get(m.demandId);
      const typeLabel = d ? demandTypeLabel(d.type, typeCopy) : tradeFallback;
      return {
        id: m.id,
        label: input.viewerIsSelf
          ? `${d?.title ?? typeLabel} · ${tradeDone}`
          : `${typeLabel} · ${tradeDone}`,
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
    buyerFaultCancellationCount,
    sellerFaultCancellationCount,
    unresolvedDisputeCount,
    confirmedMismatchCount,
    identityVerified: input.identityVerified ?? false,
    authLabel: input.authLabel ?? null,
    recentActivity,
  };
}
