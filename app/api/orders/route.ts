import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  createOrderWithFiles,
  getShopById,
  upsertUserProfile,
} from "@/lib/firebase/firestore-admin";
import { PRINT_TYPES, SIDE_TYPES } from "@/lib/utils/constants";

export async function POST(request: Request) {
  try {
    const { decoded, profile } = await requireApiRole("customer");
    const {
      customerName,
      customerPhone,
      shopId,
      notes,
      printType,
      sideType,
      pageCount,
      copies,
      files,
    } = await request.json();

    const resolvedCustomerPhone = String(customerPhone || profile.phone || "").trim();

    if (!customerName || !resolvedCustomerPhone || !shopId || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Customer details, shop, and files are required." },
        { status: 400 },
      );
    }

    const validFiles = files.every((file) => {
      return (
        typeof file.originalFileName === "string" &&
        typeof file.s3Key === "string" &&
        typeof file.s3Url === "string" &&
        typeof file.mimeType === "string" &&
        typeof file.size === "number"
      );
    });

    if (!validFiles) {
      return NextResponse.json({ error: "Invalid uploaded file metadata." }, { status: 400 });
    }

    if (!PRINT_TYPES.includes(printType) || !SIDE_TYPES.includes(sideType)) {
      return NextResponse.json({ error: "Invalid print options." }, { status: 400 });
    }

    const numericCopies = Number(copies);
    if (!Number.isInteger(numericCopies) || numericCopies < 1) {
      return NextResponse.json({ error: "Copies must be at least 1." }, { status: 400 });
    }

    const numericPageCount = Number(pageCount);
    if (!Number.isInteger(numericPageCount) || numericPageCount < 1) {
      return NextResponse.json({ error: "Page count must be at least 1." }, { status: 400 });
    }

    const shop = await getShopById(String(shopId));
    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    await upsertUserProfile({
      uid: decoded.uid,
      name: String(customerName).trim(),
      email: decoded.email || "",
      role: "customer",
      phone: resolvedCustomerPhone,
    });

    const order = await createOrderWithFiles({
      customerId: decoded.uid,
      shopId: shop.id,
      customerName: String(customerName).trim(),
      customerPhone: resolvedCustomerPhone,
      notes: String(notes || "").trim(),
      printType,
      sideType,
      pageCount: numericPageCount,
      copies: numericCopies,
      files,
    });

    return NextResponse.json({ order });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create order." },
      { status: 400 },
    );
  }
}
