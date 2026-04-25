import type { Shop } from "@/types";

type RouteRequirement = NonNullable<Shop["razorpayProductRequirements"]>[number];

export function getTransferWebhookOrderId(source?: string | null) {
  return String(source || "").trim();
}

export function mapRouteRequirements(
  requirements?:
    | Array<{
        field_reference?: string;
        resolution_url?: string;
        reason_code?: string;
        status?: string;
      }>
    | null,
): RouteRequirement[] {
  return (
    requirements?.map((requirement) => ({
      fieldReference: String(requirement.field_reference || "").trim(),
      resolutionUrl: String(requirement.resolution_url || "").trim(),
      reasonCode: String(requirement.reason_code || "").trim(),
      status: String(requirement.status || "").trim(),
    })) || []
  );
}

export function getRouteResolutionUrl(requirements: RouteRequirement[]) {
  return (
    requirements.find((requirement) => String(requirement.resolutionUrl || "").trim())?.resolutionUrl ||
    ""
  );
}

export function hasUnresolvedRouteRequirements(requirements: RouteRequirement[]) {
  return requirements.some((requirement) => {
    const status = String(requirement.status || "").trim().toLowerCase();
    return !["resolved", "completed", "approved", "verified"].includes(status);
  });
}

export function buildRouteWebhookStatusUpdate(params: {
  activationStatus: string;
  requirements?: RouteRequirement[];
}) {
  const requirements = params.requirements || [];
  const resolutionUrl = getRouteResolutionUrl(requirements);
  const hasUnresolvedRequirements = hasUnresolvedRouteRequirements(requirements);
  const productStatus = String(params.activationStatus || "").trim();
  const paymentBlockedReason =
    productStatus !== "activated"
      ? `Route product status is ${productStatus}.`
      : hasUnresolvedRequirements
        ? `Route requirements pending: ${requirements
            .map((requirement) =>
              [requirement.fieldReference, requirement.reasonCode, requirement.status]
                .filter(Boolean)
                .join(" - "),
            )
            .filter(Boolean)
            .join("; ")}`
        : "";

  return {
    razorpayProductStatus: productStatus,
    razorpayProductRequirements: requirements,
    razorpayProductResolutionUrl: resolutionUrl,
    paymentBlockedReason,
    isAcceptingOrders: productStatus === "activated" && !hasUnresolvedRequirements,
  };
}

export function isDuplicateWebhookEventProcessed(alreadyProcessed: boolean) {
  return alreadyProcessed;
}

export function isTransferAttentionOrder(params: {
  paymentStatus?: string | null;
  transferStatus?: string | null;
}) {
  return (
    params.transferStatus === "failed" ||
    params.transferStatus === "processing" ||
    params.transferStatus === "pending" ||
    params.paymentStatus === "refund_pending" ||
    params.paymentStatus === "refund_failed" ||
    (params.paymentStatus === "refunded" && params.transferStatus !== "reversed")
  );
}
