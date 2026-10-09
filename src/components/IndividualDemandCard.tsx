import { Link } from "react-router-dom";
import { useDanCopy } from "@/copy/useDanCopy";
import { primaryPublicPlace } from "@/domain/fulfillment";
import type { Demand } from "@/domain/types";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatDemandWhen, formatStoredMoney } from "@/lib/format";
import { translate, useDanLocale } from "@/i18n/locale";
import {
  formatPublicPlaceLine,
  loadViewerGeo,
} from "@/lib/geoDistance";
import "./feedCards.css";

function feedPlaceLine(
  demand: Demand,
  copy: ReturnType<typeof useDanCopy>,
  approxMeters?: number,
  locale: "ko" | "ja" = "ko",
): string {
  const place = primaryPublicPlace(demand.fulfillmentOptions);
  if (place) {
    return formatPublicPlaceLine(place, loadViewerGeo(), { approxMeters, locale });
  }
  const remote = demand.fulfillmentOptions.some((o) => o.mode === "REMOTE");
  const shipping = demand.fulfillmentOptions.some((o) => o.mode === "SHIPPING");
  if (remote) return copy.fulfillRemote;
  if (shipping) return copy.fulfillShippingShort;
  return "";
}

export function IndividualDemandCard({ demand, approxMeters }: { demand: Demand; approxMeters?: number }) {
  const locale = useDanLocale();
  const copy = useDanCopy();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const placeLine = feedPlaceLine(demand, copy, approxMeters, locale);
  const when = formatDemandWhen(demand, locale);
  const meta = [placeLine, when].filter(Boolean).join(" · ");
  const showPrice = demand.budget > 0;
  const priceLabel =
    demand.type === "TASK" || demand.type === "SERVICE"
      ? t("reward")
      : demand.type === "BORROW"
        ? t("borrowBudget")
        : t("budget");
  const typeLabel =
    locale === "ja"
      ? demand.type === "BUY"
        ? t("buy")
        : demand.type === "BORROW"
          ? t("borrow")
          : demand.type === "TASK"
            ? t("task")
            : t("service")
      : DEMAND_TYPE_LABEL[demand.type];

  return (
    <Link to={`/demand/item/${demand.id}`} className="feed-row feed-row--ind">
      <div className="feed-row__meta">
        <span className="feed-row__type">{typeLabel}</span>
        <h3 className="feed-row__title">{demand.title}</h3>
        {meta ? <p className="feed-row__place">{meta}</p> : null}
      </div>
      {showPrice ? (
        <div className="feed-row__stats">
          <div>
            <span>{priceLabel}</span>
            <strong>{formatStoredMoney(demand.budget, demand.currencyCode ?? "KRW", locale)}</strong>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
