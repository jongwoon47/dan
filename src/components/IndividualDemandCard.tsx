import { Link } from "react-router-dom";
import { ko } from "@/copy/ko";
import { primaryPublicPlace } from "@/domain/fulfillment";
import type { Demand } from "@/domain/types";
import { DEMAND_TYPE_LABEL } from "@/domain/types";
import { formatDemandWhen, formatKRWForLanguage } from "@/lib/format";
import { translate, useDanLocale } from "@/i18n/locale";
import {
  formatPublicPlaceLine,
  loadViewerGeo,
} from "@/lib/geoDistance";
import "./feedCards.css";

function feedPlaceLine(demand: Demand, approxMeters?: number): string {
  const place = primaryPublicPlace(demand.fulfillmentOptions);
  if (place) {
    return formatPublicPlaceLine(place, loadViewerGeo(), { approxMeters });
  }
  const remote = demand.fulfillmentOptions.some((o) => o.mode === "REMOTE");
  const shipping = demand.fulfillmentOptions.some((o) => o.mode === "SHIPPING");
  if (remote) return ko.fulfillRemote;
  if (shipping) return ko.fulfillShippingShort;
  return "";
}

export function IndividualDemandCard({ demand, approxMeters }: { demand: Demand; approxMeters?: number }) {
  const locale = useDanLocale();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const placeLine = feedPlaceLine(demand, approxMeters);
  const when = formatDemandWhen(demand);
  const meta = [placeLine, when].filter(Boolean).join(" · ");
  const showPrice = demand.budget > 0;
  const priceLabel =
    demand.type === "TASK" || demand.type === "SERVICE"
      ? t("reward")
      : demand.type === "BORROW"
        ? t("borrowBudget")
        : t("budget");

  return (
    <Link to={`/demand/item/${demand.id}`} className="feed-row feed-row--ind">
      <div className="feed-row__meta">
        <span className="feed-row__type">{locale === "ja" ? (demand.type === "BUY" ? t("buy") : demand.type === "BORROW" ? t("borrow") : demand.type === "TASK" ? t("task") : t("service")) : DEMAND_TYPE_LABEL[demand.type]}</span>
        <h3 className="feed-row__title">{demand.title}</h3>
        {meta ? <p className="feed-row__place">{meta}</p> : null}
      </div>
      {showPrice ? (
        <div className="feed-row__stats">
          <div>
            <span>{priceLabel}</span>
            <strong>{formatKRWForLanguage(demand.budget, locale)}</strong>
          </div>
        </div>
      ) : null}
    </Link>
  );
}
