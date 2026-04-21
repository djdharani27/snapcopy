import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/session";
import {
  createShop,
  getAllShops,
  getShopByOwnerId,
  updateShop,
} from "@/lib/firebase/firestore-admin";
import {
  createRazorpayLinkedAccount,
  createRazorpayStakeholder,
  requestRazorpayRouteProductConfiguration,
  updateRazorpayRouteProductConfiguration,
} from "@/lib/payments/razorpay";
import {
  parseAcceptedTerms,
  maskBankAccount,
  parseBankAccountNumber,
  parseGoogleMapsUrl,
  parseIfsc,
  parsePan,
  parsePhone,
  parsePrice,
  parsePostalCode,
  parseRequiredText,
  parseRazorpayLinkedAccountId,
  parseServices,
} from "@/lib/shops/validation";

function canAttemptRouteOnboarding(params: {
  bankAccountHolderName?: unknown;
  bankIfsc?: unknown;
  bankAccountNumber?: unknown;
  ownerPan?: unknown;
  acceptRouteTerms?: unknown;
}) {
  return (
    String(params.bankAccountHolderName || "").trim() &&
    String(params.bankIfsc || "").trim() &&
    String(params.bankAccountNumber || "").trim() &&
    String(params.ownerPan || "").trim() &&
    Boolean(params.acceptRouteTerms)
  );
}

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
    let parsedBankAccountHolderName = String(bankAccountHolderName || "").trim();
    let parsedBankIfsc = String(bankIfsc || "").trim().toUpperCase();
    let parsedBankAccountLast4 = "";
    let razorpayLinkedAccountId = "";
    let razorpayLinkedAccountStatus = "";
    let razorpayStakeholderId = "";
    let razorpayProductId = "";
    let razorpayProductStatus = "";
    let warning = "";

    if (canAttemptRouteOnboarding({
      bankAccountHolderName,
      bankIfsc,
      bankAccountNumber,
      ownerPan,
      acceptRouteTerms,
    })) {
      try {
        parsedBankAccountHolderName = parseRequiredText(
          bankAccountHolderName,
          "Bank account holder name",
        );
        parsedBankIfsc = parseIfsc(bankIfsc);
        const parsedBankAccountNumber = parseBankAccountNumber(bankAccountNumber);
        const parsedOwnerPan = parsePan(ownerPan);
        const acceptedRouteTerms = parseAcceptedTerms(
          acceptRouteTerms,
          "Accept the Razorpay Route terms before creating the shop.",
        );
        parsedBankAccountLast4 = maskBankAccount(parsedBankAccountNumber);

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

        const stakeholder = await createRazorpayStakeholder({
          accountId: razorpayLinkedAccountId,
          name: parsedBankAccountHolderName,
          email: profile.email,
          phone: parsedPhone,
          pan: parsedOwnerPan,
          address: parsedAddress,
          city: parsedCity,
          state: parsedState,
          postalCode: parsedPostalCode,
        });
        razorpayStakeholderId = stakeholder.id;

        const routeProduct = await requestRazorpayRouteProductConfiguration({
          accountId: razorpayLinkedAccountId,
          tncAccepted: acceptedRouteTerms,
        });

        const updatedRouteProduct = await updateRazorpayRouteProductConfiguration({
          accountId: razorpayLinkedAccountId,
          productId: routeProduct.id,
          accountNumber: parsedBankAccountNumber,
          ifscCode: parsedBankIfsc,
          beneficiaryName: parsedBankAccountHolderName,
          tncAccepted: acceptedRouteTerms,
        });

        razorpayProductId = updatedRouteProduct.id;
        razorpayProductStatus = updatedRouteProduct.activation_status;
      } catch (routeError) {
        warning =
          routeError instanceof Error
            ? `Shop created, but Razorpay payouts are not enabled yet: ${routeError.message}`
            : "Shop created, but Razorpay payouts are not enabled yet.";
      }
    }

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
      razorpayLinkedAccountId,
      razorpayLinkedAccountStatus,
      razorpayStakeholderId,
      razorpayProductId,
      razorpayProductStatus,
      bankAccountHolderName: parsedBankAccountHolderName,
      bankIfsc: parsedBankIfsc,
      bankAccountLast4: parsedBankAccountLast4,
      pricing: shopPricing,
    });

    return NextResponse.json({ shop, warning });
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

    let razorpayLinkedAccountId = String(existingShop.razorpayLinkedAccountId || "").trim();
    let razorpayLinkedAccountStatus = String(existingShop.razorpayLinkedAccountStatus || "created").trim();
    let razorpayStakeholderId = String(existingShop.razorpayStakeholderId || "").trim();
    let razorpayProductId = String(existingShop.razorpayProductId || "").trim();
    let razorpayProductStatus = String(existingShop.razorpayProductStatus || "").trim();
    let parsedBankAccountHolderName = String(existingShop.bankAccountHolderName || "").trim();
    let parsedBankIfsc = String(existingShop.bankIfsc || "").trim();
    let parsedBankAccountLast4 = String(existingShop.bankAccountLast4 || "").trim();
    let warning = "";

    if (
      canAttemptRouteOnboarding({
        bankAccountHolderName,
        bankIfsc,
        bankAccountNumber,
        ownerPan,
        acceptRouteTerms,
      })
    ) {
      if (!profile.email) {
        throw new Error("Your profile email is required before creating a Razorpay linked account.");
      }

      try {
        parsedBankAccountHolderName = parseRequiredText(
          bankAccountHolderName,
          "Bank account holder name",
        );
        parsedBankIfsc = parseIfsc(bankIfsc);
        const parsedBankAccountNumber = parseBankAccountNumber(bankAccountNumber);
        const parsedOwnerPan = parsePan(ownerPan);
        const acceptedRouteTerms = parseAcceptedTerms(
          acceptRouteTerms,
          "Accept the Razorpay Route terms before creating the shop.",
        );
        parsedBankAccountLast4 = maskBankAccount(parsedBankAccountNumber);

        const needsStakeholder = !razorpayStakeholderId;
        const needsRouteProduct = !razorpayProductId;

        if (!razorpayLinkedAccountId) {
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

        if (needsStakeholder) {
          const stakeholder = await createRazorpayStakeholder({
            accountId: razorpayLinkedAccountId,
            name: parsedBankAccountHolderName,
            email: profile.email,
            phone: parsedPhone,
            pan: parsedOwnerPan,
            address: parsedAddress,
            city: parsedCity,
            state: parsedState,
            postalCode: parsedPostalCode,
          });

          razorpayStakeholderId = stakeholder.id;
        }

        if (needsRouteProduct) {
          const routeProduct = await requestRazorpayRouteProductConfiguration({
            accountId: razorpayLinkedAccountId,
            tncAccepted: acceptedRouteTerms,
          });

          razorpayProductId = routeProduct.id;
          razorpayProductStatus = routeProduct.activation_status;
        }

        const updatedRouteProduct = await updateRazorpayRouteProductConfiguration({
          accountId: razorpayLinkedAccountId,
          productId: razorpayProductId,
          accountNumber: parsedBankAccountNumber,
          ifscCode: parsedBankIfsc,
          beneficiaryName: parsedBankAccountHolderName,
          tncAccepted: acceptedRouteTerms,
        });

        razorpayProductId = updatedRouteProduct.id;
        razorpayProductStatus = updatedRouteProduct.activation_status;
      } catch (routeError) {
        warning =
          routeError instanceof Error
            ? `Shop saved, but Razorpay payouts are not enabled yet: ${routeError.message}`
            : "Shop saved, but Razorpay payouts are not enabled yet.";
      }
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
      razorpayStakeholderId,
      razorpayProductId,
      razorpayProductStatus,
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

    return NextResponse.json({ shop, warning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop." },
      { status: 400 },
    );
  }
}
