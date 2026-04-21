export type UserRole = "customer" | "shop_owner";

export type OrderStatus = "pending" | "completed";
export type PaymentStatus = "unpaid" | "paid";
export type TransferStatus =
  | "not_created"
  | "pending"
  | "processing"
  | "success"
  | "failed";

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
  shopName: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  googleMapsUrl?: string;
  phone: string;
  description: string;
  services: string[];
  razorpayLinkedAccountId?: string;
  razorpayLinkedAccountStatus?: string;
  razorpayStakeholderId?: string;
  razorpayProductId?: string;
  razorpayProductStatus?: string;
  bankAccountHolderName?: string;
  bankIfsc?: string;
  bankAccountLast4?: string;
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
  finalAmount?: number | null;
  paymentStatus: PaymentStatus;
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
  platformCommissionPaise?: number | null;
  platformTransactionFeePaise?: number | null;
  estimatedFeePaise?: number | null;
  estimatedTaxPaise?: number | null;
  transferableAmountPaise?: number | null;
  transferId?: string | null;
  transferStatus?: TransferStatus | null;
  linkedAccountId?: string | null;
  paidAt?: string | null;
  status: OrderStatus;
  createdAt?: string | null;
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
