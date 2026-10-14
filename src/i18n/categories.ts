import {
  CATEGORY_LABEL,
  CONDITION_LABEL,
  TRADE_LABEL,
  type ConditionPreference,
  type DemandCategory,
  type TradeMethod,
} from "@/domain/types";
import type { DanLocale } from "./locale";

const categoriesJa: Record<DemandCategory, string> = {
  electronics: "スマートフォン・電子機器",
  computer: "パソコン",
  gaming: "ゲーム",
  audio: "オーディオ",
  camera: "カメラ",
  lens: "レンズ",
  home_appliance: "生活家電",
  furniture: "家具",
  fashion: "ファッション",
  shoes: "靴",
  watches_accessories: "時計・アクセサリー",
  sports: "スポーツ",
  outdoor: "アウトドア",
  camping: "キャンプ",
  hobby_collectible: "趣味・コレクション",
  baby_kids: "ベビー・キッズ",
  books_media: "本・メディア",
  musical_instrument: "楽器",
  beauty: "美容",
  pet: "ペット",
  tools: "工具",
  auto: "カー用品",
  other: "その他",
  errand: "おつかい",
  service: "お手伝い",
  rental: "レンタル",
};

const conditionsJa: Record<ConditionPreference, string> = {
  sealed: "未開封",
  like_new: "ほぼ新品",
  lightly_used: "使用感少なめ",
  any: "こだわらない",
};

const tradeJa: Record<TradeMethod, string> = {
  meetup: "手渡し",
  shipping: "配送",
  any: "こだわらない",
};

export function categoryLabel(locale: DanLocale, category: DemandCategory): string {
  return locale === "ja" ? categoriesJa[category] : CATEGORY_LABEL[category];
}

export function conditionLabel(
  locale: DanLocale,
  condition: ConditionPreference,
): string {
  return locale === "ja" ? conditionsJa[condition] : CONDITION_LABEL[condition];
}

export function tradeLabel(locale: DanLocale, method: TradeMethod): string {
  return locale === "ja" ? tradeJa[method] : TRADE_LABEL[method];
}
