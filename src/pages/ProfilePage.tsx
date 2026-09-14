import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ConfirmSheet } from "@/components/ui/ConfirmSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { PublicProfile } from "@/domain/types";
import "./pages.css";

function MoreMenu({
  open,
  onToggle,
  onBlock,
  onReport,
}: {
  open: boolean;
  onToggle: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  return (
    <div className="chat-menu">
      <button
        type="button"
        className="chat-menu__trigger"
        aria-label={ko.moreActions}
        aria-expanded={open}
        onClick={onToggle}
      >
        ⋯
      </button>
      {open ? (
        <div className="chat-menu__panel" role="menu">
          <button type="button" role="menuitem" onClick={onBlock}>
            {ko.block}
          </button>
          <button type="button" role="menuitem" onClick={onReport}>
            {ko.report}
          </button>
        </div>
      ) : null}
    </div>
  );
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

  useDeepHeader({
    title: profile?.displayName ?? ko.profileTitle,
    rightKey: `${isSelf}-${menuOpen}`,
    right: !isSelf ? (
      <MoreMenu
        open={menuOpen}
        onToggle={() => setMenuOpen((v) => !v)}
        onBlock={() => {
          setMenuOpen(false);
          setConfirm("block");
        }}
        onReport={() => {
          setMenuOpen(false);
          setConfirm("report");
        }}
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
      <div className="page-stack">
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
  const areaLine = profile.defaultArea.trim()
    ? profile.defaultArea
    : ko.areaUnset;

  return (
    <div className="page-stack page-narrow profile-page">
      <section className="profile-identity">
        <span className="avatar-initial avatar-initial--lg" aria-hidden>
          {initial}
        </span>
        <h2 className="profile-identity__name">{profile.displayName}</h2>
        <p className="section-desc">
          {areaLine}
          {" · "}
          {ko.profileConnections} {profile.connectionCount}
          {ko.timesSuffix}
        </p>
      </section>

      {toast ? <p className="section-desc">{toast}</p> : null}

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
            <input value={area} onChange={(e) => setArea(e.target.value)} />
          </label>
          <label className="field">
            <span>{ko.profileBio}</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={ko.profileBioPh}
              rows={3}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? ko.saving : ko.profileSave}
          </Button>
        </form>
      ) : (
        <>
          <p className="section-desc">{profile.bio || ko.emptyBio}</p>
          <p className="muted profile-joined">
            {ko.profileJoined}{" "}
            {new Date(profile.createdAt).toLocaleDateString("ko-KR")}
          </p>
          {isSelf ? (
            <div className="action-row">
              <Button variant="secondary" onClick={() => setEditing(true)}>
                {ko.profileEdit}
              </Button>
              <Button variant="ghost" onClick={logout}>
                {ko.logout}
              </Button>
            </div>
          ) : null}
        </>
      )}

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
