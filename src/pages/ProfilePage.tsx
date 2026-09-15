import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { PublicProfile } from "@/domain/types";
import "./pages.css";

function formatJoined(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

export function ProfilePage() {
  const { userId = "" } = useParams();
  const {
    currentUser,
    getPublicProfile,
    updateMyProfile,
    blockUser,
    reportUser,
    busy,
    logout,
    myMatches,
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
    title: profile?.displayName ?? ko.profileTitle,
    rightKey: `${isSelf}-${menuOpen}`,
    right: !isSelf ? (
      <OverflowMenu
        open={menuOpen}
        onOpenChange={onMenuOpenChange}
        items={[
          {
            label: ko.block,
            danger: true,
            onSelect: () => setConfirm("block"),
          },
          {
            label: ko.report,
            onSelect: () => setConfirm("report"),
          },
        ]}
      />
    ) : undefined,
  });

  useEffect(() => {
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
  }, [getPublicProfile, userId]);

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
        title={ko.profileTitle}
        body={ko.genericError}
        action={<Button to="/my" variant="secondary">{ko.navMy}</Button>}
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
      `${ko.profileCompleted} ${profile.completedDemandCount}`,
    );
  }
  if (profile.responseConnectionCount > 0) {
    activityBits.push(
      `${ko.profileResponded} ${profile.responseConnectionCount}`,
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
            {areaLine ? <p className="trust-card__area">{areaLine}</p> : null}
            {profile.authLabel ? (
              <p className="trust-card__auth">{profile.authLabel}</p>
            ) : null}
          </div>
        </div>

        {editing ? (
          <form className="composer-sheet" onSubmit={(e) => void onSave(e)}>
            <label className="field">
              <span>{ko.displayName}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={20}
              />
            </label>
            <label className="field">
              <span>{ko.profileArea}</span>
              <input
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder={ko.defaultAreaHint}
              />
            </label>
            <label className="field">
              <span>{ko.profileBio}</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={ko.profileBioPh}
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
                {ko.cancel}
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? ko.saving : ko.profileSave}
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
                {ko.emptyBioSelf}
              </button>
            ) : null}

            <p className="trust-card__joined">
              {ko.profileJoined} {formatJoined(profile.createdAt)}
            </p>

            {showStats ? (
              <div className="trust-card__stats">
                <p className="trust-card__stats-label">{ko.profileActivity}</p>
                <p className="trust-card__stats-value">
                  {activityBits.join(" · ")}
                </p>
              </div>
            ) : null}

            {profile.recentActivity.length > 0 ? (
              <div className="trust-card__recent">
                <p className="trust-card__stats-label">{ko.profileRecent}</p>
                <ul className="trust-card__recent-list">
                  {profile.recentActivity.map((row) => (
                    <li key={row.id}>
                      {row.href ? (
                        <Link to={row.href} className="text-link">
                          {row.label}
                        </Link>
                      ) : (
                        <span>{row.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {toast ? <p className="section-desc">{toast}</p> : null}

            {isSelf ? (
              <div className="trust-card__actions">
                <Button
                  fullWidth
                  variant="secondary"
                  onClick={() => setEditing(true)}
                >
                  {ko.profileEdit}
                </Button>
                <div className="action-row action-row--split">
                  <Button fullWidth variant="ghost" to="/my">
                    {ko.profileMyPosts}
                  </Button>
                  <Button fullWidth variant="ghost" to="/my#connections">
                    {ko.profileMyConnections}
                  </Button>
                </div>
                <Button fullWidth variant="ghost" onClick={logout}>
                  {ko.logout}
                </Button>
              </div>
            ) : connectedMatch ? (
              <div className="trust-card__actions">
                <Button to={`/match/${connectedMatch.id}`} fullWidth size="lg">
                  {ko.openChat}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ConfirmSheet
        open={confirm === "block"}
        title={ko.block}
        body={ko.blockConfirm}
        confirmLabel={ko.block}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void blockUser(userId).then((ok) => {
            setConfirm(null);
            if (ok) setToast(ko.blockedOk);
          });
        }}
      />

      <ConfirmSheet
        open={confirm === "report"}
        title={ko.report}
        body={ko.reportReason}
        confirmLabel={ko.reportSubmit}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void reportUser({
            targetUserId: userId,
            reason: reportReason,
          }).then((ok) => {
            setConfirm(null);
            if (ok) setToast(ko.reportSent);
          });
        }}
      >
        <div className="confirm-sheet__choices">
          {(
            [
              ["spam", ko.reportSpam],
              ["fraud", ko.reportFraud],
              ["abuse", ko.reportAbuse],
              ["other", ko.reportOther],
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
