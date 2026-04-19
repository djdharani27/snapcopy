import { DEFAULT_BILLING_CONFIG } from "@/lib/platform/billing";

export interface TransferCalculation {
  platformTransactionFeePaise: number;
  estimatedFeePaise: number;
  estimatedTaxPaise: number;
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
  const estimatedFeePaise = Math.ceil(
    (params.amountPaise * estimatedRazorpayFeePercent) / 100,
  );
  const estimatedTaxPaise = Math.ceil((estimatedFeePaise * estimatedGstPercent) / 100);
  const transferableAmountPaise = Math.max(
    0,
    params.amountPaise -
      platformTransactionFeePaise -
      estimatedFeePaise -
      estimatedTaxPaise,
  );

  return {
    platformTransactionFeePaise,
    estimatedFeePaise,
    estimatedTaxPaise,
    transferableAmountPaise,
  } satisfies TransferCalculation;
}
