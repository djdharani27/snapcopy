import type { OrderStatus, SideType, PrintType, UserRole, PaymentStatus } from "@/types";

export const USER_ROLES: UserRole[] = ["customer", "shop_owner"];
export const ORDER_STATUSES: OrderStatus[] = ["pending", "completed"];
export const PAYMENT_STATUSES: PaymentStatus[] = ["unpaid", "paid"];
export const PRINT_TYPES: PrintType[] = ["color", "black_white"];
export const SIDE_TYPES: SideType[] = ["single_side", "double_side"];

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
];

export const ACCEPTED_FILE_EXTENSIONS = ".pdf,.doc,.docx,.png,.jpg,.jpeg";
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_FILES_PER_ORDER = 10;
