export type UserRole = "customer" | "shop_owner";

export type OrderStatus = "pending" | "completed";
export type PaymentStatus = "unpaid" | "paid";

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

export interface Shop {
  id: string;
  ownerId: string;
  shopName: string;
  address: string;
  phone: string;
  description: string;
  services: string[];
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
  createdAt?: string | null;
}

export interface OrderWithFiles extends Order {
  files: OrderFile[];
}
