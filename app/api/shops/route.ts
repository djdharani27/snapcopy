import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  createShop,
  getAllShops,
  getShopByOwnerId,
  updateShop,
} from "@/lib/firebase/firestore-admin";
import { createRazorpayLinkedAccount } from "@/lib/payments/razorpay";
import {
  maskBankAccount,
  parseBankAccountNumber,
  parseGoogleMapsUrl,
  parseIfsc,
  parsePhone,
  parsePrice,
  parsePostalCode,
  parseRequiredText,
  parseRazorpayLinkedAccountId,
  parseServices,
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
    const { decoded, profile } = await requireApiRole("shop_owner");
    const {
      shopName,
      address,
      city,
      state,
      postalCode,
      googleMapsUrl,
      phone,
      description,
      services,
      bankAccountHolderName,
      bankIfsc,
      bankAccountNumber,
      pricing,
    } = await request.json();

    if (!shopName || !address || !phone) {
      return NextResponse.json(
        { error: "Shop name, address, and phone are required." },
        { status: 400 },
      );
    }

    const shopPricing = {
      blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
      blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
      colorSingle: parsePrice(pricing?.colorSingle),
      colorDouble: parsePrice(pricing?.colorDouble),
    };

    if (!profile.email) {
      throw new Error("Your profile email is required before creating a Razorpay linked account.");
    }

    const parsedShopName = String(shopName).trim();
    const parsedAddress = String(address).trim();
    const parsedCity = parseRequiredText(city, "City");
    const parsedState = parseRequiredText(state, "State");
    const parsedPostalCode = parsePostalCode(postalCode);
    const parsedPhone = parsePhone(phone);
    const parsedBankAccountHolderName = parseRequiredText(
      bankAccountHolderName,
      "Bank account holder name",
    );
    const parsedBankIfsc = parseIfsc(bankIfsc);
    const parsedBankAccountNumber = parseBankAccountNumber(bankAccountNumber);

    const linkedAccount = await createRazorpayLinkedAccount({
      email: profile.email,
      phone: parsedPhone,
      legalBusinessName: parsedShopName,
      contactName: profile.name || parsedShopName,
      referenceId: `shop_${decoded.uid}`,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      description: String(description || "").trim() || "Local print and copy shop",
    });

    const shop = await createShop({
      ownerId: decoded.uid,
      shopName: parsedShopName,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: parsedPhone,
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId: parseRazorpayLinkedAccountId(linkedAccount.id),
      razorpayLinkedAccountStatus: linkedAccount.status,
      bankAccountHolderName: parsedBankAccountHolderName,
      bankIfsc: parsedBankIfsc,
      bankAccountLast4: maskBankAccount(parsedBankAccountNumber),
      pricing: shopPricing,
    });

    return NextResponse.json({ shop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const { decoded, profile } = await requireApiRole("shop_owner");
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
      googleMapsUrl,
      phone,
      description,
      services,
      bankAccountHolderName,
      bankIfsc,
      bankAccountNumber,
      pricing,
    } = await request.json();

    const parsedShopName = String(shopName || "").trim();
    const parsedAddress = String(address || "").trim();
    const parsedCity = parseRequiredText(city, "City");
    const parsedState = parseRequiredText(state, "State");
    const parsedPostalCode = parsePostalCode(postalCode);
    const parsedPhone = parsePhone(phone);

    let razorpayLinkedAccountId = String(existingShop.razorpayLinkedAccountId || "").trim();
    let razorpayLinkedAccountStatus = String(existingShop.razorpayLinkedAccountStatus || "created").trim();
    let parsedBankAccountHolderName = String(existingShop.bankAccountHolderName || "").trim();
    let parsedBankIfsc = String(existingShop.bankIfsc || "").trim();
    let parsedBankAccountLast4 = String(existingShop.bankAccountLast4 || "").trim();

    if (!razorpayLinkedAccountId) {
      if (!profile.email) {
        throw new Error("Your profile email is required before creating a Razorpay linked account.");
      }

      parsedBankAccountHolderName = parseRequiredText(
        bankAccountHolderName,
        "Bank account holder name",
      );
      parsedBankIfsc = parseIfsc(bankIfsc);
      parsedBankAccountLast4 = maskBankAccount(parseBankAccountNumber(bankAccountNumber));

      const linkedAccount = await createRazorpayLinkedAccount({
        email: profile.email,
        phone: parsedPhone,
        legalBusinessName: parsedShopName,
        contactName: profile.name || parsedShopName,
        referenceId: `shop_${decoded.uid}`,
        address: parsedAddress,
        city: parsedCity,
        state: parsedState,
        postalCode: parsedPostalCode,
        description: String(description || "").trim() || "Local print and copy shop",
      });

      razorpayLinkedAccountId = parseRazorpayLinkedAccountId(linkedAccount.id);
      razorpayLinkedAccountStatus = linkedAccount.status;
    }

    const shop = await updateShop({
      shopId: existingShop.id,
      ownerId: decoded.uid,
      shopName: parsedShopName,
      address: parsedAddress,
      city: parsedCity,
      state: parsedState,
      postalCode: parsedPostalCode,
      googleMapsUrl: parseGoogleMapsUrl(googleMapsUrl),
      phone: parsedPhone,
      description: String(description || "").trim(),
      services: parseServices(services),
      razorpayLinkedAccountId,
      razorpayLinkedAccountStatus,
      bankAccountHolderName: parsedBankAccountHolderName,
      bankIfsc: parsedBankIfsc,
      bankAccountLast4: parsedBankAccountLast4,
      pricing: {
        blackWhiteSingle: parsePrice(pricing?.blackWhiteSingle),
        blackWhiteDouble: parsePrice(pricing?.blackWhiteDouble),
        colorSingle: parsePrice(pricing?.colorSingle),
        colorDouble: parsePrice(pricing?.colorDouble),
      },
    });

    return NextResponse.json({ shop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop." },
      { status: 400 },
    );
  }
}
