import type { LocalizedCopy } from "@/copy/useDanCopy";

/** Map Korean store keys for evidence components to locale-facing labels. */
export function localizeStoredComponent(
  value: string,
  copy: LocalizedCopy,
): string {
  const map: Record<string, string> = {
    제품: copy.evidenceCompProduct,
    "박스/더스트백": copy.evidenceCompBoxDust,
    택: copy.evidenceCompTag,
    "보증서/영수증": copy.evidenceCompWarranty,
    "추가 구성품": copy.evidenceCompExtra,
    "제품/본체": copy.evidenceCompBody,
    "조립 부품": copy.evidenceCompParts,
    설명서: copy.evidenceCompManual,
    "추가 부품": copy.evidenceCompExtraParts,
    본품: copy.evidenceCompMain,
    케이스: copy.evidenceCompCase,
    부록: copy.evidenceCompBonus,
    "포토카드/특전": copy.evidenceCompPhotocard,
    영수증: copy.evidenceCompReceipt,
    원박스: copy.evidenceCompOrigBox,
    "한정 구성품": copy.evidenceCompLimited,
    박스: copy.evidenceCompBox,
    "충전기/어댑터": copy.evidenceCompCharger,
    케이블: copy.evidenceCompCable,
  };
  return map[value] ?? value;
}

export function formatStoredComponents(
  components: string[] | string,
  copy: LocalizedCopy,
): string {
  const list = Array.isArray(components)
    ? components
    : components
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
  if (!list.length) return "";
  return list.map((c) => localizeStoredComponent(c, copy)).join(", ");
}
