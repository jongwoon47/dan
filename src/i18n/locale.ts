import { useSyncExternalStore } from "react";

export type DanLocale = "ko" | "ja";
const STORAGE_KEY = "dan-locale-v1";
const EVENT_NAME = "dan-locale-change";

const messages = {
  ko: {
    home: "홈", explore: "탐색", request: "요청", chat: "채팅", myTrades: "내 거래",
    profile: "내 프로필", activity: "알림", login: "로그인", logout: "로그아웃",
    whatNeed: "무엇이 필요하세요?", homeLead: "구매·빌리기·심부름·서비스를 요청해 보세요.",
    searchPlaceholder: "무엇을 찾고 있나요?", requestSearch: "요청 검색",
    buy: "구매", borrow: "빌리기", task: "심부름", service: "서비스",
    all: "전체", openRequests: "지금 올라온 요청", browseLead: "물건, 빌리기, 심부름, 서비스 요청을 찾아보세요.",
    popularThings: "많이 찾는 물건", recentRequests: "최근 올라온 요청", more: "더보기",
    createRequest: "요청 올리기", browseAll: "전체 탐색", noProducts: "아직 요청이 없어요",
    noProductsDetail: "첫 요청을 직접 올려보세요.", noRequests: "조건에 맞는 요청이 없어요",
    noRequestsDetail: "다른 조건으로 검색하거나 직접 요청을 올려보세요.",
    selectArea: "어디서 찾을까요?", privacyLocation: "정확한 현재 위치는 공개하지 않아요",
    allAreas: "전체 지역", nearby: "내 주변", byArea: "지역명", online: "온라인·택배", route: "동선 심부름", routeFrom: "출발 지역", routeTo: "도착 지역", routeHint: "명시된 픽업·전달 경로가 일치하는 요청을 찾습니다. 실제 이동 경로나 우회 시간은 계산하지 않아요.", routeMissing: "출발 지역과 도착 지역을 모두 입력해 주세요.",
    searchRadius: "탐색 반경", aroundKm: "약 {km}km 이내", currentLocation: "현재 위치 사용",
    refreshLocation: "현재 위치 새로 확인", locating: "위치 확인 중…",
    areaName: "지역 이름", areaExample: "예: 성동구, 博多区", areaHint: "게시물의 지역명을 비교하는 대략적인 검색이에요. 국가 코드나 km 거리로 구분하지는 않아요.",
    nearestHint: "거리 확인이 가능한 현장 요청만 보여줘요. 구매 집계는 제외돼요.",
    onlineHint: "온라인 또는 택배 가능한 개별 요청만 보여줘요.",
    radiusEmpty: "해당 반경에서 거리 확인이 가능한 요청이 없어요. 지역명 검색도 이용해 보세요.",
    areaEmpty: "지역 이름을 입력해 주세요.", results: "{n}개 요청", products: "{n}개 제품",
    locatingResults: "주변 요청 확인 중…", loading: "요청 불러오는 중…",
    loadMore: "더 보기", locationDenied: "위치 권한이 거부됐어요. 지역명 검색을 이용해 주세요.",
    locationFailed: "위치를 확인하지 못했어요. 지역명으로 검색할 수 있어요.",
    locationLogin: "GPS 거리 검색은 로그인 후 사용할 수 있어요. 지역명 검색은 로그인 없이 가능해요.",
    saveArea: "활동 지역 저장", savedAreas: "저장된 지역", noSavedAreas: "저장된 지역이 없어요.",
    savedAreaHint: "시·구·동 정도만 저장하세요. 집 주소는 입력하지 마세요.",
    remove: "삭제", addArea: "지역 저장", savedAreaFull: "최대 3개 지역까지 저장할 수 있어요.",
    areaSaved: "활동 지역을 저장했어요.", searchArea: "이 지역에서 찾기",
    settings: "설정", language: "표시 언어", languageHint: "먼저 홈·탐색·설정에서 언어 선택을 지원해요.",
    korean: "한국어", japanese: "日本語", legal: "법적 정보", legalHint: "이용약관 및 개인정보 처리방침",
    terms: "이용약관", privacy: "개인정보처리방침", account: "계정", deleteAccount: "회원탈퇴",
    loginRequired: "로그인이 필요해요", loginRequiredSettings: "계정 설정은 로그인 후 이용할 수 있어요.",
    chooseCountry: "거래 국가/지역", marketHint: "언어 설정과 거래 국가는 별개입니다. 기존 요청은 한국·원화 기준이에요.", marketPilot: "일본으로 등록된 요청만 보여줘요. 원화 요청을 엔화로 변환하지 않아요.", countryKr: "한국", countryJp: "일본",
    wonNotice: "현재 거래 금액은 원화(KRW) 기준입니다. 엔화 결제는 아직 지원하지 않습니다.",
    popular: "인기", growing: "급상승", price: "가격",
    reward: "보상", borrowBudget: "대여 예산", budget: "희망 금액",
    noMatchingSearch: "‘{q}’ 요청이 아직 없어요",
  },
  ja: {
    home: "ホーム", explore: "探す", request: "依頼", chat: "チャット", myTrades: "取引",
    profile: "プロフィール", activity: "お知らせ", login: "ログイン", logout: "ログアウト",
    whatNeed: "何をお探しですか？", homeLead: "購入・貸し借り・おつかい・お手伝いの依頼を投稿できます。",
    searchPlaceholder: "商品・おつかい・サービスを検索", requestSearch: "依頼を検索",
    buy: "買いたい", borrow: "借りたい", task: "おつかい", service: "お手伝い",
    all: "すべて", openRequests: "募集中の依頼", browseLead: "買い物・貸し借り・おつかい・お手伝いの依頼を探しましょう。",
    popularThings: "探している人が多い商品", recentRequests: "新着の依頼", more: "もっと見る",
    createRequest: "依頼を投稿", browseAll: "すべて見る", noProducts: "まだ依頼がありません",
    noProductsDetail: "最初の依頼を投稿しましょう。", noRequests: "条件に合う依頼はありません",
    noRequestsDetail: "条件を変更するか、依頼を投稿してみましょう。",
    selectArea: "どこで探しますか？", privacyLocation: "正確な現在地は公開されません",
    allAreas: "すべての地域", nearby: "近く", byArea: "地域名", online: "オンライン・配送", route: "移動途中のおつかい", routeFrom: "出発地", routeTo: "目的地", routeHint: "集荷・配達の出発地と目的地が一致する依頼を検索します。実際の経路や所要時間の計算はまだ行いません。", routeMissing: "出発地と目的地を入力してください。",
    searchRadius: "検索範囲", aroundKm: "約{km}km以内", currentLocation: "現在地を使用",
    refreshLocation: "現在地を更新", locating: "現在地を確認中…",
    areaName: "地域名", areaExample: "例：博多区、城東区", areaHint: "投稿の地名に一致するおおよその検索です。国コードや距離による厳密な絞り込みではありません。",
    nearestHint: "距離を確認できた現地対応の依頼だけ表示します。商品単位の集計は対象外です。",
    onlineHint: "オンライン対応または配送可能な個別の依頼を表示します。",
    radiusEmpty: "この範囲には、距離を確認できる依頼がありません。地域名検索もお試しください。",
    areaEmpty: "地域名を入力してください。", results: "依頼 {n}件", products: "商品 {n}件",
    locatingResults: "近くの依頼を確認中…", loading: "読み込み中…",
    loadMore: "さらに表示", locationDenied: "位置情報の許可がありません。地域名で検索できます。",
    locationFailed: "位置情報を取得できませんでした。地域名で検索できます。",
    locationLogin: "GPS検索にはログインが必要です。地域名検索はログインなしで使えます。",
    saveArea: "活動エリアを保存", savedAreas: "保存した地域", noSavedAreas: "保存した地域はありません。",
    savedAreaHint: "市区町村程度の地名にしてください。自宅の住所は入力しないでください。",
    remove: "削除", addArea: "地域を保存", savedAreaFull: "地域は3件まで保存できます。",
    areaSaved: "地域を保存しました。", searchArea: "この地域で探す",
    settings: "設定", language: "表示言語", languageHint: "まずホーム・検索・設定で日本語に対応しています。",
    korean: "한국어", japanese: "日本語", legal: "法的情報", legalHint: "利用規約とプライバシーポリシー",
    terms: "利用規約", privacy: "プライバシーポリシー", account: "アカウント", deleteAccount: "退会手続き",
    loginRequired: "ログインが必要です", loginRequiredSettings: "アカウント設定はログイン後に利用できます。",
    chooseCountry: "取引する国・地域", marketHint: "表示言語と取引する国は別です。既存の依頼は韓国・KRWです。", marketPilot: "日本の依頼のみを表示します。韓国ウォンの価格を円には変換しません。", countryKr: "韓国", countryJp: "日本",
    wonNotice: "現在、表示される取引金額は韓国ウォン（KRW）です。円決済には未対応です。",
    popular: "人気", growing: "急上昇", price: "価格",
    reward: "謝礼", borrowBudget: "レンタル予算", budget: "希望金額",
    noMatchingSearch: "「{q}」の依頼はありません",
  },
} as const;

export type MessageKey = keyof typeof messages.ko;

export function translate(locale: DanLocale, key: MessageKey, vars: Record<string, string | number> = {}): string {
  const dictionary = messages[locale] as Record<MessageKey, string>;
  return dictionary[key].replace(/\{(\w+)\}/g, (_match, name: string) => String(vars[name] ?? ""));
}

function getStoredLocale(): DanLocale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "ja" || value === "ko" ? value : null;
  } catch { return null; }
}

export function getLocale(): DanLocale {
  const saved = getStoredLocale();
  if (saved) return saved;
  return typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("ja") ? "ja" : "ko";
}

function subscribeLocale(listener: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("storage", listener);
  };
}

export function useDanLocale(): DanLocale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => "ko");
}

export function setDanLocale(locale: DanLocale): void {
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* session only */ }
  if (typeof document !== "undefined") document.documentElement.lang = locale;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT_NAME));
}
