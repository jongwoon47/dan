import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ko } from "@/copy/ko";
import { useDan } from "@/domain/danContext";
import type { PublicProfile } from "@/domain/types";
import "./pages.css";

export function ProfilePage() {
  const { userId = "" } = useParams();
  const {
    currentUser,
    getPublicProfile,
    updateMyProfile,
    blockUser,
    reportUser,
    busy,
  } = useDan();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [bio, setBio] = useState("");
  const isSelf = currentUser?.id === userId;

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

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">{profile.displayName}</h1>
        <p className="section-desc">
          {profile.defaultArea || "—"}
          {" · "}
          {ko.profileConnections} {profile.connectionCount}
          {ko.timesSuffix}
        </p>
      </header>

      {editing ? (
        <form className="composer-sheet" onSubmit={(e) => void onSave(e)}>
          <label className="field">
            <span>{ko.login}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="field">
            <span>{ko.defaultAreaHint}</span>
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
            {busy ? ko.saving : ko.saveDemand}
          </Button>
        </form>
      ) : (
        <>
          <p className="section-desc">{profile.bio || ko.profileBioPh}</p>
          <p className="muted">
            {ko.profileJoined}{" "}
            {new Date(profile.createdAt).toLocaleDateString("ko-KR")}
          </p>
          {isSelf ? (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              {ko.profileEdit}
            </Button>
          ) : (
            <div className="action-row">
              <Button
                variant="secondary"
                onClick={() => {
                  if (!window.confirm(ko.blockConfirm)) return;
                  void blockUser(userId).then(() => window.alert(ko.blockedOk));
                }}
              >
                {ko.block}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  void reportUser({ targetUserId: userId, reason: "other" }).then(
                    () => window.alert(ko.reportSent),
                  );
                }}
              >
                {ko.report}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
