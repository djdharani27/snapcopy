import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  createShop,
  getAllShops,
  getShopByOwnerId,
  updateShop,
} from "@/lib/firebase/firestore-admin";
import {
  maskBankAccount,
  parseAcceptedTerms,
  parseEmail,
  parseGoogleMapsUrl,
  parsePhone,
  parsePrice,
  parsePostalCode,
  parseRequiredText,
  parseServices,
  validateShopPricing,
} from "@/lib/shops/validation";

export async function GET() {
  try {
    await requireApiRole("customer");
    const shops = await getAllShops();
    return NextResponse.json({ shops });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 401 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const {
      shopName,
      address,
      city,
      state,
      postalCode,
      businessType,
      googleMapsUrl,
      phone,
      settlementEmail,
      description,
      services,
      bankAccountHolderName,
      bankIfsc,
      bankAccountNumber,
      ownerPan,
      acceptRouteTerms,
      pricing,
    } = await request.json();

    if (!shopName || !address || !phone) {
      return NextResponse.json(
        { error: "Shop name, address, and phone are required." },
        { status: 400 },
      );
    }

    const shopPricing = validateShopPricing({
      blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
      blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
      colorSingle: parsePrice(pricing?.colorSingle),
      colorDouble: parsePrice(pricing?.colorDouble),
    });

    const parsedShopName = String(shopName).trim();
    const parsedAddress = String(address).trim();
    const parsedCity = parseRequiredText(city, "City");
    const parsedState = parseRequiredText(state, "State");
    const parsedPostalCode = parsePostalCode(postalCode);
    const parsedPhone = parsePhone(phone);
    const parsedSettlementEmail = parseEmail(
      settlementEmail,
      "Settlement email",
    );
    const parsedBankAccountHolderName = parseRequiredText(
      bankAccountHolderName,
      "Bank account holder name",
    );
    const parsedBankIfsc = parseRequiredText(bankIfsc, "IFSC").toUpperCase();
    const parsedBankAccountNumber = parseRequiredText(
      bankAccountNumber,
      "Bank account number",
    );
    const parsedOwnerPan = parseRequiredText(ownerPan, "Owner PAN").toUpperCase();
    parseAcceptedTerms(
      acceptRouteTerms,
      "Accept the Razorpay Route terms before submitting your shop for approval.",
    );

    const shop = await createShop({
      ownerId: decoded.uid,
      approvalStatus: "pending_approval",
      shopName: parsedShopName,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      businessType: String(businessType || "individual").trim().toLowerCase(),
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: parsedPhone,
      settlementEmail: parsedSettlementEmail,
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId: "",
      razorpayLinkedAccountStatus: "",
      bankAccountHolderName: parsedBankAccountHolderName,
      bankIfsc: parsedBankIfsc,
      bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
      pendingBankAccountNumber: parsedBankAccountNumber,
      pendingOwnerPan: parsedOwnerPan,
      pendingRouteTermsAccepted: true,
      onlinePaymentsEnabled: false,
      adminVerifiedRazorpayAccount: false,
      paymentOnboardingNote: "",
      pricing: shopPricing,
    });

    return NextResponse.json({
      shop,
      message: "Shop submitted for admin approval.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { decoded } = await requireApiRole("shop_owner");
    const existingShop = await getShopByOwnerId(decoded.uid);

    if (!existingShop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    const {
      shopName,
      address,
      city,
      state,
      postalCode,
      businessType,
      googleMapsUrl,
      phone,
      settlementEmail,
      description,
      services,
      bankAccountHolderName,
      bankIfsc,
      bankAccountNumber,
      ownerPan,
      acceptRouteTerms,
      pricing,
    } = await request.json();

    const parsedShopName = String(shopName || "").trim();
    const parsedAddress = String(address || "").trim();
    const parsedCity = parseRequiredText(city, "City");
    const parsedState = parseRequiredText(state, "State");
    const parsedPostalCode = parsePostalCode(postalCode);
    const parsedPhone = parsePhone(phone);
    const parsedSettlementEmail = parseEmail(
      settlementEmail,
      "Settlement email",
    );

    const parsedBankAccountHolderName = parseRequiredText(
      bankAccountHolderName,
      "Bank account holder name",
    );
    const parsedBankIfsc = parseRequiredText(bankIfsc, "IFSC").toUpperCase();
    const parsedBankAccountNumber = parseRequiredText(
      bankAccountNumber,
      "Bank account number",
    );
    const parsedOwnerPan = parseRequiredText(ownerPan, "Owner PAN").toUpperCase();
    parseAcceptedTerms(
      acceptRouteTerms,
      "Accept the Razorpay Route terms before submitting your shop for approval.",
    );

    const shop = await updateShop({
      shopId: existingShop.id,
      ownerId: decoded.uid,
      approvalStatus: "pending_approval",
      shopName: parsedShopName,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      businessType: String(businessType || existingShop.businessType || "individual").trim().toLowerCase(),
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: parsedPhone,
      settlementEmail: parsedSettlementEmail,
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId: String(existingShop.razorpayLinkedAccountId || "").trim(),
      razorpayLinkedAccountStatus: String(existingShop.razorpayLinkedAccountStatus || "").trim(),
      razorpayStakeholderId: String(existingShop.razorpayStakeholderId || "").trim(),
      razorpayProductId: String(existingShop.razorpayProductId || "").trim(),
      razorpayProductStatus: String(existingShop.razorpayProductStatus || "").trim(),
      bankAccountHolderName: parsedBankAccountHolderName,
      bankIfsc: parsedBankIfsc,
      bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
      pendingBankAccountNumber: parsedBankAccountNumber,
      pendingOwnerPan: parsedOwnerPan,
      pendingRouteTermsAccepted: true,
      onlinePaymentsEnabled: false,
      adminVerifiedRazorpayAccount: false,
      paymentOnboardingNote: String(existingShop.paymentOnboardingNote || "").trim(),
      pricing: validateShopPricing({
        blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
        blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
        colorSingle: parsePrice(pricing?.colorSingle),
        colorDouble: parsePrice(pricing?.colorDouble),
      }),
    });

    return NextResponse.json({
      shop,
      message: "Shop changes submitted for admin approval.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop." },
      { status: 400 },
    );
  }
}
