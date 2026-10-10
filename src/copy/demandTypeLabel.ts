import type { DemandType } from "@/domain/types";

export type DemandTypeCopy = {
  typeBuy: string;
  typeBorrow: string;
  typeTask: string;
  typeService: string;
};

export function demandTypeLabel(
  type: DemandType,
  copy: DemandTypeCopy,
): string {
  if (type === "BUY") return copy.typeBuy;
  if (type === "BORROW") return copy.typeBorrow;
  if (type === "TASK") return copy.typeTask;
  return copy.typeService;
}
