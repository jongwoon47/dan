import { CATEGORY_LABEL, type DemandCategory } from "@/domain/types";
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

export function categoryLabel(locale: DanLocale, category: DemandCategory): string {
  return locale === "ja" ? categoriesJa[category] : CATEGORY_LABEL[category];
}
