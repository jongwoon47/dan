import { Link } from "react-router-dom";
import type { Demand } from "@/domain/types";
import { translate, useDanLocale, type MessageKey } from "@/i18n/locale";
import { formatStoredMoney } from "@/lib/format";
import "./NearbyBandMap.css";

const BANDS_KM = [1, 3, 5, 10] as const;

export type NearbyBandItem = {
  demand: Demand;
  approxMeters?: number;
};

function bandForMeters(meters: number | undefined, maxKm: number): number | null {
  if (!Number.isFinite(meters) || meters == null || meters < 0) return null;
  const km = meters / 1000;
  if (km > maxKm) return null;
  for (const band of BANDS_KM) {
    if (km <= band) return band;
  }
  return null;
}

/**
 * Privacy-preserving nearby visualization: distance *bands* only.
 * Never plots lat/lng, home pins, or pickup points.
 */
export function NearbyBandMap({
  items,
  radiusKm,
}: {
  items: NearbyBandItem[];
  radiusKm: number;
}) {
  const locale = useDanLocale();
  const t = (key: MessageKey, vars: Record<string, string | number> = {}) =>
    translate(locale, key, vars);

  const grouped = BANDS_KM.filter((band) => band <= radiusKm).map((band) => ({
    band,
    rows: items.filter((item) => bandForMeters(item.approxMeters, radiusKm) === band),
  }));

  const unknown = items.filter(
    (item) => bandForMeters(item.approxMeters, radiusKm) == null,
  );

  return (
    <section className="nearby-band-map" aria-label={t("mapView")}>
      <p className="nearby-band-map__privacy">{t("mapPrivacy")}</p>
      <div className="nearby-band-map__rings" aria-hidden>
        {BANDS_KM.filter((band) => band <= radiusKm).map((band) => (
          <div
            key={band}
            className="nearby-band-map__ring"
            style={{ ["--band-scale" as string]: String(band / Math.max(radiusKm, 1)) }}
          >
            <span>{t("aroundKm", { km: band })}</span>
          </div>
        ))}
        <div className="nearby-band-map__you">{t("mapYou")}</div>
      </div>
      <div className="nearby-band-map__bands">
        {grouped.map(({ band, rows }) => (
          <div key={band} className="nearby-band-map__band">
            <header>
              <strong>{t("aroundKm", { km: band })}</strong>
              <span>{t("results", { n: rows.length })}</span>
            </header>
            {rows.length === 0 ? (
              <p className="nearby-band-map__empty">{t("bandEmpty")}</p>
            ) : (
              <ul>
                {rows.map(({ demand, approxMeters }) => (
                  <li key={demand.id}>
                    <Link to={`/demand/item/${demand.id}`}>
                      <span className="nearby-band-map__type">
                        {demand.type === "BUY" ? t("buy")
                          : demand.type === "BORROW" ? t("borrow")
                            : demand.type === "TASK" ? t("task")
                              : t("service")}
                      </span>
                      <strong>{demand.title}</strong>
                      <span>
                        {Number.isFinite(approxMeters)
                          ? t("approxDistance", { km: Math.max(1, Math.round((approxMeters as number) / 1000)) })
                          : t("privacyLocation")}
                      </span>
                      {demand.budget > 0 ? (
                        <span>{formatStoredMoney(demand.budget, demand.currencyCode ?? "KRW", locale)}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {unknown.length > 0 ? (
          <div className="nearby-band-map__band">
            <header>
              <strong>{t("distanceUnknown")}</strong>
              <span>{t("results", { n: unknown.length })}</span>
            </header>
            <p className="nearby-band-map__empty">{t("distanceUnknownHint")}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
