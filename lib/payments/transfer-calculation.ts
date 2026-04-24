import { DEFAULT_BILLING_CONFIG } from "@/lib/platform/billing";

export interface TransferCalculation {
  platformTransactionFeePaise: number;
  estimatedFeePaise: number;
  estimatedTaxPaise: number;
  gatewayFeeSource: "actual" | "estimated";
  transferableAmountPaise: number;
}

function getNumberFromEnv(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue) || parsedValue < 0) {
    throw new Error(`Invalid numeric env var: ${name}`);
  }

  return parsedValue;
}

export function calculateTransferBreakdown(params: {
  amountPaise: number;
  transactionFeePaise?: number;
  estimatedRazorpayFeePercent?: number;
  estimatedGstPercent?: number;
  transactionFeeEnabled?: boolean;
  actualFeePaise?: number | null;
  actualTaxPaise?: number | null;
}) {
  if (!Number.isInteger(params.amountPaise) || params.amountPaise <= 0) {
    throw new Error("Amount must be a positive integer in paise.");
  }

  const estimatedRazorpayFeePercent =
    params.estimatedRazorpayFeePercent ??
    getNumberFromEnv(
      "RAZORPAY_ESTIMATED_FEE_PERCENT",
      DEFAULT_BILLING_CONFIG.estimatedRazorpayFeePercent,
    );
  const estimatedGstPercent =
    params.estimatedGstPercent ??
    getNumberFromEnv(
      "RAZORPAY_ESTIMATED_GST_PERCENT",
      DEFAULT_BILLING_CONFIG.estimatedGstPercent,
    );
  const configuredTransactionFeePaise =
    params.transactionFeePaise ??
    getNumberFromEnv(
      "PLATFORM_TRANSACTION_FEE_PAISE",
      DEFAULT_BILLING_CONFIG.transactionFeePaise,
    );
  const platformTransactionFeePaise =
    params.transactionFeeEnabled === false ? 0 : Math.max(0, configuredTransactionFeePaise);
  const hasActualGatewayFees =
    Number.isInteger(params.actualFeePaise) &&
    Number(params.actualFeePaise) >= 0 &&
    Number.isInteger(params.actualTaxPaise) &&
    Number(params.actualTaxPaise) >= 0;
  const estimatedFeePaise = hasActualGatewayFees
    ? Number(params.actualFeePaise)
    : Math.ceil((params.amountPaise * estimatedRazorpayFeePercent) / 100);
  const estimatedTaxPaise = hasActualGatewayFees
    ? Number(params.actualTaxPaise)
    : Math.ceil((estimatedFeePaise * estimatedGstPercent) / 100);
  const gatewayFeeSource = hasActualGatewayFees ? "actual" : "estimated";
  const transferableAmountPaise = Math.max(0, params.amountPaise - platformTransactionFeePaise);

  return {
    platformTransactionFeePaise,
    estimatedFeePaise,
    estimatedTaxPaise,
    gatewayFeeSource,
    transferableAmountPaise,
  } satisfies TransferCalculation;
}
