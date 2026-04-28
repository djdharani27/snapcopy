import type { Order, Shop } from "@/types";
import { SNAPCOPY_PLATFORM_FEE_PAISE } from "@/lib/utils/constants";

export function getPrintOrderUnitPrice(
  shop: Pick<Shop, "pricing">,
  printType: Order["printType"],
  sideType: Order["sideType"],
) {
  if (printType === "color") {
    return sideType === "double_side" ? shop.pricing.colorDouble : shop.pricing.colorSingle;
  }

  return sideType === "double_side"
    ? shop.pricing.blackWhiteDouble
    : shop.pricing.blackWhiteSingle;
}

export function calculatePrintOrderPricing(params: {
  shop: Pick<Shop, "pricing">;
  printType: Order["printType"];
  sideType: Order["sideType"];
  pageCount: number;
  copies: number;
}) {
  const perSheetPriceRupees = getPrintOrderUnitPrice(
    params.shop,
    params.printType,
    params.sideType,
  );
  const printCostPaise = Math.round(perSheetPriceRupees * 100 * params.pageCount * params.copies);
  const platformFeePaise = SNAPCOPY_PLATFORM_FEE_PAISE;
  const totalAmountPaise = printCostPaise + platformFeePaise;

  return {
    printCostPaise,
    platformFeePaise,
    totalAmountPaise,
    shopEarningPaise: printCostPaise,
    platformEarningPaise: platformFeePaise,
  };
}

export function calculateQuotedOrderPricing(printCostPaise: number) {
  const normalizedPrintCostPaise = Math.round(printCostPaise);
  const platformFeePaise = SNAPCOPY_PLATFORM_FEE_PAISE;
  const totalAmountPaise = normalizedPrintCostPaise + platformFeePaise;

  return {
    printCostPaise: normalizedPrintCostPaise,
    platformFeePaise,
    totalAmountPaise,
    shopEarningPaise: normalizedPrintCostPaise,
    platformEarningPaise: platformFeePaise,
  };
}
