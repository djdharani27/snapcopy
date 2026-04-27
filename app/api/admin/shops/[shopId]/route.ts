import { NextResponse } from "next/server";
import { ApiAuthError } from "@/lib/auth/errors";
import { requireApiAdmin } from "@/lib/auth/admin";
import { deleteS3Objects } from "@/lib/aws/s3";
import {
  deleteShopWithRelatedData,
  getShopById,
  updateShopApproval,
  updateShopRouteDetails,
} from "@/lib/firebase/firestore-admin";
import { fetchRazorpayLinkedAccount } from "@/lib/payments/razorpay";
import { parseRazorpayLinkedAccountId } from "@/lib/shops/validation";
import { parseEmail } from "@/lib/shops/validation";
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/shops/[shopId]">,
) {
  try {
    await requireApiAdmin(request);
    const { shopId } = await context.params;
    const body = await request.json();
    const { action } = body;
    const shop = await getShopById(shopId, { includeUnapproved: true });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found." }, { status: 404 });
    }

    if (action === "approve") {
      const approvedShop = await updateShopApproval({
        shopId: shop.id,
        approvalStatus: "approved",
        onlinePaymentsEnabled: Boolean(shop.onlinePaymentsEnabled),
        paymentOnboardingNote: String(shop.paymentOnboardingNote || "").trim(),
      });
      return NextResponse.json({
        shop: approvedShop,
        message:
          "Shop approved. Create and activate the linked account manually in Razorpay Dashboard, then paste the verified acc_xxx here and turn online payments on.",
      });
    }

    if (action === "reject") {
      const rejectedShop = await updateShopApproval({
        shopId: shop.id,
        approvalStatus: "rejected",
      });
      return NextResponse.json({ shop: rejectedShop });
    }

    if (action === "reset_route_onboarding") {
      return NextResponse.json({
        error: "Legacy Razorpay Route onboarding reset has been disabled. Use manual linked-account onboarding only.",
      }, { status: 410 });
    }

    const submittedLinkedAccountId = String(body.razorpayLinkedAccountId || "").trim();
    const submittedSettlementEmail = String(body.settlementEmail || "").trim();
    const submittedPaymentOnboardingNote = String(body.paymentOnboardingNote || "").trim();
    const submittedOnlinePaymentsEnabled = Boolean(body.onlinePaymentsEnabled);
    let verifiedLinkedAccount:
      | Awaited<ReturnType<typeof fetchRazorpayLinkedAccount>>
      | null = null;

    if (submittedLinkedAccountId) {
      const parsedLinkedAccountId = parseRazorpayLinkedAccountId(submittedLinkedAccountId);

      try {
        verifiedLinkedAccount = await fetchRazorpayLinkedAccount(parsedLinkedAccountId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || "");

        if (message.toLowerCase().includes("access denied")) {
          throw new Error(
            "Linked account id is not accessible with current API keys. Check test/live mode or linked account ownership before saving.",
          );
        }

        throw new Error(`Unable to verify linked account id before saving: ${message}`);
      }
    }

    if (submittedOnlinePaymentsEnabled && !verifiedLinkedAccount && !submittedLinkedAccountId) {
      throw new Error(
        "Save and verify a Razorpay linked account id before turning online payments on.",
      );
    }

    if (
      submittedOnlinePaymentsEnabled &&
      String(verifiedLinkedAccount?.status || body.razorpayLinkedAccountStatus || "")
        .trim()
        .toLowerCase() === "suspended"
    ) {
      throw new Error("Suspended linked accounts cannot be used for online payments.");
    }

    const nextLinkedAccountId = verifiedLinkedAccount?.id ?? body.razorpayLinkedAccountId;
    const paymentBlockedReason = submittedOnlinePaymentsEnabled
      ? ""
      : nextLinkedAccountId
        ? "Online payments are still turned off by admin."
        : "";

    const updatedShop = await updateShopRouteDetails({
      shopId: shop.id,
      settlementEmail: submittedSettlementEmail
        ? parseEmail(submittedSettlementEmail, "Settlement email")
        : body.settlementEmail,
      razorpayLinkedAccountId:
        verifiedLinkedAccount?.id ?? body.razorpayLinkedAccountId,
      razorpayLinkedAccountStatus:
        verifiedLinkedAccount?.status ?? body.razorpayLinkedAccountStatus,
      razorpayLinkedAccountStatusReason:
        verifiedLinkedAccount?.status_details?.reason ?? body.razorpayLinkedAccountStatusReason,
      razorpayLinkedAccountStatusDescription:
        verifiedLinkedAccount?.status_details?.description ??
        body.razorpayLinkedAccountStatusDescription,
      onlinePaymentsEnabled: submittedOnlinePaymentsEnabled,
      paymentOnboardingNote: submittedPaymentOnboardingNote,
      paymentBlockedReason,
      onboardingStep: "",
      onboardingError: "",
      bankAccountHolderName: body.bankAccountHolderName,
      bankIfsc: body.bankIfsc,
      bankAccountLast4: body.bankAccountLast4,
    });

    return NextResponse.json({ shop: updatedShop });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update shop." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/admin/shops/[shopId]">,
) {
  try {
    await requireApiAdmin(_request);
    const { shopId } = await context.params;
    const result = await deleteShopWithRelatedData(shopId);
    const deletedS3ObjectCount = await deleteS3Objects(result.s3Keys);

    return NextResponse.json({
      success: true,
      deletedOrderCount: result.deletedOrderCount,
      deletedFileCount: result.deletedFileCount,
      deletedS3ObjectCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete shop." },
      { status: error instanceof ApiAuthError ? error.status : 400 },
    );
  }
}
