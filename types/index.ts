export type UserRole = "customer" | "shop_owner";

export type OrderStatus = "pending" | "downloaded" | "completed";

export type PrintType = "color" | "black_white";

export type SideType = "single_side" | "double_side";

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string | null;
}

export interface Shop {
  id: string;
  ownerId: string;
  shopName: string;
  address: string;
  phone: string;
  description: string;
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
