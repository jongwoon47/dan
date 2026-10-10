import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { useDanCopy } from "@/copy/useDanCopy";
import { useDanLocale } from "@/i18n/locale";
import { useDan } from "@/domain/danContext";
import type { PublicProfile } from "@/domain/types";
import "./pages.css";

function formatJoined(iso: string, locale: "ko" | "ja"): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString(locale === "ja" ? "ja-JP" : "ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export function ProfilePage() {
  const { userId = "" } = useParams();
  const copy = useDanCopy();
  const locale = useDanLocale();
  const {
    currentUser,
    getPublicProfile,
    updateMyProfile,
    blockUser,
    reportUser,
    busy,
    logout,
    myMatches,
    getProduct,
    getDemand,
  } = useDan();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const [confirm, setConfirm] = useState<"block" | "report" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportReason, setReportReason] = useState<
    "spam" | "fraud" | "abuse" | "other"
  >("spam");
  const [toast, setToast] = useState<string | null>(null);
  const [historyTab, setHistoryTab] = useState<"completed" | "progress" | "cancelled">("completed");
  const isSelf = currentUser?.id === userId;

  const connectedMatch = useMemo(
    () =>
      myMatches.find(
        (m) =>
          m.status === "CONNECTED" &&
          (m.buyerId === userId || m.sellerId === userId) &&
          (m.buyerId === currentUser?.id || m.sellerId === currentUser?.id),
      ),
    [myMatches, userId, currentUser?.id],
  );

  const onMenuOpenChange = useCallback((open: boolean) => {
    setMenuOpen(open);
  }, []);

  useDeepHeader({
    title: profile?.displayName ?? copy.profileTitle,
    rightKey: `${isSelf}-${menuOpen}`,
    right: currentUser && !isSelf ? (
      <OverflowMenu
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        items={[
          {
            label: copy.block,
            danger: true,
            onSelect: () => setConfirm("block"),
          },
          {
            label: copy.report,
            onSelect: () => setConfirm("report"),
          },
        ]}
      />
    ) : undefined,
  });

  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      const p = await getPublicProfile(userId);
      if (!alive) return;
      setProfile(p);
      if (p) {
        setName(p.displayName);
        setArea(p.defaultArea);
        setBio(p.bio);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [currentUser, getPublicProfile, userId]);

  const tradeHistoryRows = useMemo(() => {
    if (!isSelf) return [];
    const fallbackTitle = copy.tradeFallbackShort;
    return myMatches
      .filter((match) => {
        if (historyTab === "completed") return match.status === "COMPLETED";
        if (historyTab === "progress") {
          return match.status === "CONNECTED" || match.status === "BUYER_INTERESTED" || match.status === "SELLER_ACCEPTED";
        }
        return match.status === "CLOSED" || match.status === "DECLINED";
      })
      .map((match) => {
        const product = match.productId ? getProduct(match.productId) : undefined;
        const demand = getDemand(match.demandId);
        return {
          id: match.id,
          title: product?.name ?? demand?.title ?? fallbackTitle,
          href:
            match.status === "COMPLETED"
              ? `/deal/${match.id}/complete`
              : match.status === "CONNECTED"
                ? `/deal/${match.id}/handoff`
                : `/match/${match.id}`,
          meta:
            match.status === "COMPLETED"
              ? copy.matchStatusCompleted
              : match.status === "CLOSED" || match.status === "DECLINED"
                ? copy.tradeCancelAction
                : copy.tradeInProgress,
        };
      });
  }, [copy, getDemand, getProduct, historyTab, isSelf, locale, myMatches]);

  if (!currentUser) {
    return (
      <EmptyState
        title={copy.needLogin}
        body={copy.needLoginBody}
        action={<Button to="/login">{copy.login}</Button>}
      />
    );
  }

  if (loading) {
    return (
      <div className="page-stack page-narrow">
        <div className="skeleton-line skeleton-line--lg" />
        <div className="skeleton-line" />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        title={copy.profileTitle}
        body={copy.genericError}
        action={<Button to="/my" variant="secondary">{copy.navMy}</Button>}
      />
    );
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const next = await updateMyProfile({
      displayName: name,
      defaultArea: area,
      bio,
    });
    if (next) {
      setProfile({
        ...profile!,
        displayName: next.name,
        defaultArea: next.defaultArea,
        bio: next.bio ?? "",
      });
      setEditing(false);
    }
  }

  const initial = (profile.displayName.trim().slice(0, 1) || "?").toUpperCase();
  const areaLine = profile.defaultArea.trim();
  const bioTrim = profile.bio.trim();
  const showStats =
    profile.completedDemandCount > 0 || profile.responseConnectionCount > 0;
  const activityBits: string[] = [];
  if (profile.completedDemandCount > 0) {
    activityBits.push(
      `${copy.profileCompleted} ${profile.completedDemandCount}`,
    );
  }
  if (profile.responseConnectionCount > 0) {
    activityBits.push(
      `${copy.profileResponded} ${profile.responseConnectionCount}`,
    );
  }

  return (
    <div className="page-stack page-narrow profile-page">
      <section className="trust-card">
        <div className="trust-card__identity">
          <span className="avatar-initial avatar-initial--lg" aria-hidden>
            {initial}
          </span>
          <div className="trust-card__meta">
            <h1 className="trust-card__name">{profile.displayName}</h1>
            <p className="trust-card__area">{areaLine || copy.areaUnset}</p>
            {profile.authLabel ? (
              <p className="trust-card__auth">{profile.authLabel}</p>
            ) : null}
          </div>
        </div>

        {editing ? (
          <form className="composer-sheet" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>{copy.displayName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={20}
              />
            </label>
            <label className="field">
              <span>{copy.profileArea}</span>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={copy.defaultAreaHint}
              />
            </label>
            <label className="field">
              <span>{copy.profileBio}</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={copy.profileBioPh}
                rows={3}
                maxLength={80}
              />
            </label>
            <div className="action-row">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                {copy.cancel}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? copy.saving : copy.profileSave}
              </Button>
            </div>
          </form>
        ) : (
          <>
            {bioTrim ? (
              <p className="trust-card__bio">“{bioTrim}”</p>
            ) : isSelf ? (
              <button
                type="button"
                className="trust-card__bio-cta"
                onClick={() => setEditing(true)}
              >
                {copy.emptyBioSelf}
              </button>
            ) : null}

            <p className="trust-card__joined">
              {copy.profileJoined} {formatJoined(profile.createdAt, locale)}
            </p>

            {showStats ? (
              <div className="trust-card__stats">
                <p className="trust-card__stats-label">{copy.profileActivity}</p>
                <p className="trust-card__stats-value">
                  {activityBits.join(" · ")}
                </p>
              </div>
            ) : null}

            <div className="trust-history trust-history--blueprint">
              <div className="trust-history__head">
                <strong>{copy.trustSectionTitle}</strong>
                <div className="trust-history__badges">
                  {profile.identityVerified ? (
                    <span className="trust-verified-badge">
                      {copy.identityVerified}
                    </span>
                  ) : null}
                  <span>{copy.confirmedTradeRecords}</span>
                </div>
              </div>

              <div className="trust-summary-strip">
                <div>
                  <strong>{profile.completedDemandCount}</strong>
                  <span>{copy.profileCompleted}</span>
                </div>
                <div>
                  <strong>{profile.unresolvedDisputeCount}</strong>
                  <span>{copy.unresolvedDisputesLabel}</span>
                </div>
                <div>
                  <strong>
                    {profile.sellerFaultCancellationCount +
                      profile.buyerFaultCancellationCount}
                  </strong>
                  <span>{copy.faultCancelLabel}</span>
                </div>
              </div>

              {profile.confirmedMismatchCount > 0 ? (
                <div className="trust-fact-list">
                  <div>
                    <span>{copy.snapshotMismatchLabel}</span>
                    <strong>{profile.confirmedMismatchCount}</strong>
                  </div>
                </div>
              ) : null}
            </div>

            {isSelf ? (
              <section className="profile-trade-history">
                <div className="profile-trade-history__head">
                  <strong>{copy.myTradeHistoryTitle}</strong>
                  <span>{copy.confirmedOnlyHint}</span>
                </div>
                <div
                  className="profile-trade-tabs"
                  role="tablist"
                  aria-label={copy.tradeHistoryAria}
                >
                  <button
                    type="button"
                    className={historyTab === "completed" ? "is-active" : ""}
                    onClick={() => setHistoryTab("completed")}
                  >
                    {copy.matchStatusCompleted}
                  </button>
                  <button
                    type="button"
                    className={historyTab === "progress" ? "is-active" : ""}
                    onClick={() => setHistoryTab("progress")}
                  >
                    {copy.myRequestsActive}
                  </button>
                  <button
                    type="button"
                    className={historyTab === "cancelled" ? "is-active" : ""}
                    onClick={() => setHistoryTab("cancelled")}
                  >
                    {copy.cancel}
                  </button>
                </div>
                {tradeHistoryRows.length > 0 ? (
                  <div className="profile-trade-list">
                    {tradeHistoryRows.map((row) => (
                      <Link key={row.id} to={row.href} className="profile-trade-row">
                        <div>
                          <strong>{row.title}</strong>
                          <span>{row.meta}</span>
                        </div>
                        <span aria-hidden>›</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="profile-trade-empty">{copy.noTradesYet}</p>
                )}
              </section>
            ) : null}

            {toast ? <p className="section-desc">{toast}</p> : null}

            {isSelf ? (
              <div className="trust-card__actions">
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => setEditing(true)}
                >
                  {copy.profileEdit}
                </Button>
                <div className="action-row action-row--split">
                  <Button fullWidth variant="ghost" to="/my">
                    {copy.profileMyPosts}
                  </Button>
                  <Button fullWidth variant="ghost" to="/chats">
                    {copy.navChats}
                  </Button>
                </div>
                <Button fullWidth variant="ghost" onClick={logout}>
                  {copy.logout}
                </Button>
              </div>
            ) : connectedMatch ? (
              <div className="trust-card__actions">
                <Button to={`/match/${connectedMatch.id}`} fullWidth size="lg">
                  {copy.openChat}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ConfirmSheet
        open={confirm === "block"}
        title={copy.block}
        body={copy.blockConfirm}
        confirmLabel={copy.block}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void blockUser(userId).then((ok) => {
            setConfirm(null);
            if (ok) setToast(copy.blockedOk);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "report"}
        title={copy.report}
        body={copy.reportReason}
        confirmLabel={copy.reportSubmit}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void reportUser({
            targetUserId: userId,
            reason: reportReason,
          }).then((ok) => {
            setConfirm(null);
            if (ok) setToast(copy.reportSent);
          });
        }}
      >
        <div className="confirm-sheet__choices">
          {(
            [
              ["spam", copy.reportSpam],
              ["fraud", copy.reportFraud],
              ["abuse", copy.reportAbuse],
              ["other", copy.reportOther],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={
                reportReason === value
                  ? "confirm-sheet__choice is-selected"
                  : "confirm-sheet__choice"
              }
              onClick={() => setReportReason(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </ConfirmSheet>
    </div>
  );
}
