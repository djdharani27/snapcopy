export type UserRole = "admin" | "customer" | "shop_owner";
export type ShopApprovalStatus = "pending_approval" | "approved" | "rejected";
export type ShopSubscriptionStatus = "inactive" | "active" | "expired";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "ready_for_pickup"
  | "completed";
export type PaymentStatus =
  | "unpaid"
  | "payment_failed"
  | "paid"
  | "refund_pending"
  | "refunded"
  | "refund_failed";
export type SettlementStatus = "pending" | "paid" | "failed";
export type TransferStatus =
  | "not_created"
  | "pending"
  | "processing"
  | "success"
  | "failed"
  | "reversed"
  | "partially_reversed";
export type PaymentIntentStatus =
  | "idle"
  | "creating"
  | "ready"
  | "payment_verified_client_return";
export type GatewayFeeSource = "actual" | "estimated";

export type PrintType = "color" | "black_white";

export type SideType = "single_side" | "double_side";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  createdAt?: string | null;
}

export interface BillingConfig {
  shopCreationFeePaise: number;
  transactionFeePaise: number;
  estimatedRazorpayFeePercent: number;
  estimatedGstPercent: number;
  shopCreationFeeEnabled: boolean;
  transactionFeeEnabled: boolean;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface BillingAuditLog {
  id: string;
  actorEmail: string;
  actorUid: string;
  action: string;
  before: BillingConfig;
  after: BillingConfig;
  createdAt?: string | null;
}

export interface Shop {
  id: string;
  ownerId: string;
  approvalStatus?: ShopApprovalStatus;
  approvalSubmittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  shopName: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  businessType?: string;
  googleMapsUrl?: string;
  phone: string;
  settlementEmail?: string;
  description: string;
  services: string[];
  razorpayLinkedAccountId?: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  razorpayProductResolutionUrl?: string;
  razorpayLinkedAccountStatusReason?: string;
  razorpayLinkedAccountStatusDescription?: string;
  razorpayProductRequirements?: Array<{
    fieldReference?: string;
    resolutionUrl?: string;
    reasonCode?: string;
    status?: string;
  }>;
  razorpayOwnerPanStatus?: string;
  razorpayBankVerificationStatus?: string;
  razorpayRouteTermsAccepted?: boolean;
  paymentBlockedReason?: string;
  razorpayStatusLastSyncedAt?: string | null;
  onboardingStep?: string;
  onboardingError?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
  bankAccountLast4Masked?: string;
  panLast4Masked?: string;
  pendingBankAccountNumber?: string;
  pendingOwnerPan?: string;
  pendingRouteTermsAccepted?: boolean;
  onlinePaymentsEnabled?: boolean;
  paymentOnboardingNote?: string;
  subscriptionStatus?: ShopSubscriptionStatus;
  subscriptionValidUntil?: string | null;
  razorpaySubscriptionOrderId?: string | null;
  razorpaySubscriptionPaymentId?: string | null;
  isActive?: boolean;
  pricing: {
    blackWhiteSingle: number;
    blackWhiteDouble: number;
    colorSingle: number;
    colorDouble: number;
  };
  createdAt?: string | null;
}

export interface Order {
  id: string;
  trackingCode?: string;
  customerId: string;
  shopId: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  printType: PrintType;
  sideType: SideType;
  copies: number;
  pageCount?: number | null;
  printCostPaise?: number | null;
  platformFeePaise?: number | null;
  totalAmountPaise?: number | null;
  shopEarningPaise?: number | null;
  platformEarningPaise?: number | null;
  paymentStatus: PaymentStatus;
  paymentIntentStatus?: PaymentIntentStatus | null;
  paymentAttemptAmountPaise?: number | null;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  platformCommissionPaise?: number | null;
  platformTransactionFeePaise?: number | null;
  estimatedFeePaise?: number | null;
  estimatedTaxPaise?: number | null;
  gatewayFeeSource?: GatewayFeeSource | null;
  transferableAmountPaise?: number | null;
  transferId?: string | null;
  transferStatus?: TransferStatus | null;
  transferFailureReason?: string | null;
  transferUpdatedAt?: string | null;
  linkedAccountId?: string | null;
  settlementStatus?: SettlementStatus | null;
  settlementPaidAt?: string | null;
  refundId?: string | null;
  refundedAmountPaise?: number | null;
  paidAt?: string | null;
  status: OrderStatus;
  createdAt?: string | null;
}

export interface ShopSubscriptionPayment {
  id: string;
  shopId: string;
  amountPaise: number;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  status: PaymentStatus;
  paidAt?: string | null;
  createdAt?: string | null;
}

export interface RazorpayWebhookEvent {
  id: string;
  razorpayEventId: string;
  eventType: string;
  payloadJson?: string | null;
  createdAt?: string | null;
  processedAt?: string | null;
}

export interface OrderFile {
  id: string;
  orderId: string;
  originalFileName: string;
  s3Key: string;
  s3Url: string;
  mimeType: string;
  size: number;
  downloadedAt?: string | null;
  downloadedByOwnerId?: string | null;
  createdAt?: string | null;
}

export interface OrderWithFiles extends Order {
  files: OrderFile[];
}
