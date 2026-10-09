import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/auth/AuthProvider";
import { legalDocumentHref } from "@/auth/consentVersions";
import { useDeepHeader } from "@/components/layout/ShellChrome";
import { setDanLocale, translate, useDanLocale } from "@/i18n/locale";
import { readStoredMarketCountry, writeStoredMarketCountry } from "@/lib/marketPrefs";
import {
  addSavedArea,
  removeSavedArea,
  updateSavedArea,
  useSavedAreas,
  type SavedArea,
} from "@/lib/savedAreas";

export function SettingsPage() {
  const auth = useAuth();
  const locale = useDanLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const savedAreas = useSavedAreas();
  const [areaText, setAreaText] = useState("");
  // Market country is independent of UI language (never infer JP from Japanese locale).
  const [country, setCountry] = useState<SavedArea["country"]>(() => readStoredMarketCountry());
  const [editing, setEditing] = useState<SavedArea | null>(null);
  const [saveMessage, setSaveMessage] = useState("");
  useDeepHeader({ title: t("settings") });

  function selectCountry(next: SavedArea["country"]) {
    setCountry(next);
    writeStoredMarketCountry(next);
  }

  function saveArea(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) {
      const result = updateSavedArea(editing, { label: areaText, country });
      if (result === "saved") {
        setAreaText("");
        setEditing(null);
        setSaveMessage(t("areaUpdated"));
      } else {
        setSaveMessage(
          result === "exists" ? t("areaSaved") :
          result === "missing" ? t("noSavedAreas") :
          t("savedAreaHint"),
        );
      }
      return;
    }
    const result = addSavedArea({ label: areaText, country });
    if (result === "saved") {
      setAreaText("");
      setSaveMessage(t("areaSaved"));
    } else {
      setSaveMessage(result === "full" ? t("savedAreaFull") : result === "exists" ? t("areaSaved") : t("savedAreaHint"));
    }
  }

  return (
    <div className="page-stack page-narrow settings-page">
      <section className="settings-section" aria-labelledby="settings-language-title">
        <div className="settings-section__head">
          <h1 id="settings-language-title">{t("language")}</h1>
          <p>{t("languageHint")}</p>
        </div>
        <div className="settings-list">
          <label className="location-pref-field">
            <span>{t("language")}</span>
            <select
              aria-label={t("language")}
              value={locale}
              onChange={(event) => setDanLocale(event.target.value === "ja" ? "ja" : "ko")}
            >
              <option value="ko">한국어</option>
              <option value="ja">日本語</option>
            </select>
          </label>
          <p className="location-pref-hint">{t("wonNotice")}</p>
          <p className="location-pref-hint">{t("marketTimezoneHint")}</p>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-saved-areas">
        <div className="settings-section__head">
          <h1 id="settings-saved-areas">{t("savedAreas")}</h1>
          <p>{t("savedAreaHint")}</p>
        </div>
        <div className="settings-list">
          {savedAreas.length === 0 ? <p className="location-pref-hint">{t("noSavedAreas")}</p> : null}
          {savedAreas.map((area) => (
            <div className="location-pref-row" key={area.country + ":" + area.label}>
              <Link to={`/feed?area=${encodeURIComponent(area.label)}&country=${area.country}`}>
                {area.country === "JP" ? "JP" : "KR"} · {area.label}
              </Link>
              <button
                type="button"
                onClick={() => {
                  setEditing(area);
                  setCountry(area.country);
                  setAreaText(area.label);
                  setSaveMessage("");
                }}
                aria-label={t("editArea") + " " + area.label}
              >
                {t("editArea")}
              </button>
              <button type="button" onClick={() => removeSavedArea(area)} aria-label={t("remove") + " " + area.label}>
                {t("remove")}
              </button>
            </div>
          ))}
          <form className="location-pref-form" onSubmit={saveArea}>
            <label className="location-pref-field">
              <span>{t("chooseCountry")}</span>
              <select value={country} onChange={(event) => selectCountry(event.target.value === "JP" ? "JP" : "KR")}>
                <option value="KR">{t("countryKr")}</option>
                <option value="JP">{t("countryJp")}</option>
              </select>
            </label>
            <label className="location-pref-field">
              <span>{t("areaName")}</span>
              <input
                maxLength={60}
                value={areaText}
                onChange={(event) => setAreaText(event.target.value)}
                placeholder={t("areaExample")}
              />
            </label>
            <Button
              type="submit"
              variant="secondary"
              disabled={!areaText.trim() || (!editing && savedAreas.length >= 3)}
            >
              {editing ? t("editArea") : t("addArea")}
            </Button>
            {editing ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(null);
                  setAreaText("");
                }}
              >
                {t("cancelEdit")}
              </Button>
            ) : null}
            {saveMessage ? <p role="status" className="location-pref-hint">{saveMessage}</p> : null}
          </form>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="settings-legal-title">
        <div className="settings-section__head">
          <h1 id="settings-legal-title">{t("legal")}</h1>
          <p>{t("legalHint")}</p>
        </div>
        <div className="settings-list">
          <a className="settings-link-row" href={legalDocumentHref("terms")} target="_blank" rel="noopener noreferrer">
            <span>{t("terms")}</span><span aria-hidden>›</span>
          </a>
          <a className="settings-link-row" href={legalDocumentHref("privacy")} target="_blank" rel="noopener noreferrer">
            <span>{t("privacy")}</span><span aria-hidden>›</span>
          </a>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-account-title">
        <div className="settings-section__head">
          <h1 id="settings-account-title">{t("account")}</h1>
          <p>{auth.user ? t("settings") : t("loginRequiredSettings")}</p>
        </div>
        <div className="settings-list">
          {auth.user
            ? <Button to="/settings/delete-account" variant="secondary" fullWidth>{t("deleteAccount")}</Button>
            : <Button to="/login" variant="secondary" fullWidth>{t("login")}</Button>}
        </div>
      </section>
    </div>
  );
}
