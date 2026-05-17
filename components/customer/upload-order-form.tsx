"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  MAX_COPIES_PER_ORDER,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_ORDER,
} from "@/lib/utils/constants";
import { formatTrackingId } from "@/lib/utils/format";
import type { Shop, UserProfile } from "@/types";

type PrintIntent = "hall_ticket" | "lab_manual" | "other";

const PRINT_INTENT_OPTIONS: Array<{
  value: PrintIntent;
  label: string;
}> = [
  { value: "hall_ticket", label: "Print hall ticket" },
  { value: "lab_manual", label: "Print lab manual" },
  { value: "other", label: "Print other" },
];

function buildNotes(printIntent: PrintIntent, notes: FormDataEntryValue | null) {
  const intentLabel =
    PRINT_INTENT_OPTIONS.find((option) => option.value === printIntent)?.label ?? "Print other";
  const trimmedNotes = String(notes || "").trim();

  return trimmedNotes ? `${intentLabel}\n${trimmedNotes}` : intentLabel;
}

export function UploadOrderForm({
  shops,
  profile,
  initialShopId,
}: {
  shops: Shop[];
  profile: UserProfile;
  initialShopId?: string;
}) {
  const router = useRouter();
  const hydrationSafeProps = { suppressHydrationWarning: true as const };
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdTrackingCode, setCreatedTrackingCode] = useState("");
  const [error, setError] = useState("");
  const [submittedShop, setSubmittedShop] = useState<Shop | null>(null);
  const [printIntent, setPrintIntent] = useState<PrintIntent>("hall_ticket");
  const [printType, setPrintType] = useState<"color" | "black_white">("black_white");
  const [sideType, setSideType] = useState<"single_side" | "double_side">("single_side");
  const [pageCount, setPageCount] = useState(1);
  const [copies, setCopies] = useState(1);
  const [selectedShopId, setSelectedShopId] = useState(initialShopId || shops[0]?.id || "");

  const selectedShop = shops.find((shop) => shop.id === selectedShopId) || null;

  function handleSuccessConfirm() {
    setShowSuccessDialog(false);
    setCreatedTrackingCode("");
    setSubmittedShop(null);
    router.push("/customer/orders?order=sent#orders");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setShowSuccessDialog(false);
    setCreatedTrackingCode("");
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const files = Array.from(formData.getAll("files")).filter(
      (value): value is File => value instanceof File && value.size > 0,
    );

    try {
      if (!selectedShopId) {
        throw new Error("Select a shop before placing the order.");
      }

      if (!selectedShop) {
        throw new Error("Select a valid shop before placing the order.");
      }

      if (files.length === 0) throw new Error("Add at least one file.");
      if (files.length > MAX_FILES_PER_ORDER) {
        throw new Error(`You can upload up to ${MAX_FILES_PER_ORDER} files.`);
      }

      const requestedCopies = Number(formData.get("copies"));
      if (!Number.isInteger(requestedCopies) || requestedCopies < 1) {
        throw new Error("Copies must be at least 1.");
      }

      if (requestedCopies > MAX_COPIES_PER_ORDER) {
        throw new Error(`You can order up to ${MAX_COPIES_PER_ORDER} copies.`);
      }

      files.forEach((file) => {
        if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
          throw new Error(
            `${file.name} is not supported. Allowed: PDF, DOC, DOCX, PNG, JPG.`,
          );
        }

        if (file.size > MAX_FILE_SIZE_BYTES) {
          throw new Error(`${file.name} exceeds the 15 MB size limit.`);
        }
      });

      const uploadPayload = new FormData();
      files.forEach((file) => uploadPayload.append("files", file));

      const uploadResponse = await fetch("/api/uploads", {
        method: "POST",
        body: uploadPayload,
      });
      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || "File upload failed.");
      }

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: formData.get("customerName"),
          customerPhone: formData.get("customerPhone"),
          shopId: selectedShopId,
          notes: buildNotes(printIntent, formData.get("notes")),
          printType: formData.get("printType"),
          sideType: formData.get("sideType"),
          pageCount: Number(formData.get("pageCount")),
          copies: requestedCopies,
          files: uploadResult.files,
        }),
      });

      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderResult.error || "Order creation failed.");
      }

      setSubmittedShop(selectedShop);
      form.reset();
      setPrintIntent("hall_ticket");
      setPrintType("black_white");
      setSideType("single_side");
      setPageCount(1);
      setCopies(1);
      setSelectedShopId(initialShopId || shops[0]?.id || "");
      setCreatedTrackingCode(orderResult.order?.trackingCode || orderResult.order?.id || "");
      setShowSuccessDialog(true);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to submit order.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel-strong p-4 sm:p-6">
      <div className="space-y-5">
        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <p className="label">Step 1</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                What do you want to print?
              </h3>
            </div>
            <div className="inline-flex w-fit self-start rounded-full bg-[#f5decc] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c4c20]">
              Required
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {PRINT_INTENT_OPTIONS.map((option) => {
              const isSelected = option.value === printIntent;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPrintIntent(option.value)}
                  className={
                    isSelected
                      ? "rounded-[24px] border border-[#c96d38] bg-[#fff6ef] px-4 py-4 text-left text-sm font-semibold text-[#8f4319] shadow-[0_14px_24px_rgba(201,109,56,0.14)]"
                      : "rounded-[24px] border border-[#eadfd3] bg-white px-4 py-4 text-left text-sm font-medium text-slate-700 transition hover:border-[#d8b49a] hover:bg-[#fff9f4]"
                  }
                  {...hydrationSafeProps}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 2</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Upload document
            </h3>
          </div>

          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept={ACCEPTED_FILE_EXTENSIONS}
            className="input py-3"
            required
            {...hydrationSafeProps}
          />
        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,253,249,0.86)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 3</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Select shop
            </h3>
          </div>

          {initialShopId && shops.length === 1 ? (
            <div className="rounded-[24px] border border-[#eadfd3] bg-[rgba(255,247,239,0.95)] px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{selectedShop?.shopName}</p>
              <p className="mt-1 text-sm text-slate-600">{selectedShop?.address}</p>
            </div>
          ) : (
            <select
              id="shopId"
              name="shopId"
              className="input"
              value={selectedShopId}
              onChange={(event) => setSelectedShopId(event.target.value)}
              required
              {...hydrationSafeProps}
            >
              <option value="" disabled>
                Choose a shop
              </option>
              {shops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.shopName} - {shop.address}
                </option>
              ))}
            </select>
          )}
        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,253,249,0.86)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 4</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Your details
            </h3>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="customerName">
                Customer name
              </label>
              <input
                id="customerName"
                name="customerName"
                className="input"
                defaultValue={profile.name}
                required
                {...hydrationSafeProps}
              />
            </div>

            {profile.phone ? (
              <input type="hidden" name="customerPhone" value={profile.phone} />
            ) : (
              <div>
                <label className="label" htmlFor="customerPhone">
                  Phone number
                </label>
                <input
                  id="customerPhone"
                  name="customerPhone"
                  className="input"
                  placeholder="Saved after your first order"
                  required
                  {...hydrationSafeProps}
                />
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.7)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 5</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Print style
            </h3>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="printType">
                Print type
              </label>
              <select
                id="printType"
                name="printType"
                className="input"
                value={printType}
                onChange={(event) => setPrintType(event.target.value as "color" | "black_white")}
                {...hydrationSafeProps}
              >
                <option value="black_white">Black &amp; white</option>
                <option value="color">Color</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="sideType">
                Side type
              </label>
              <select
                id="sideType"
                name="sideType"
                className="input"
                value={sideType}
                onChange={(event) =>
                  setSideType(event.target.value as "single_side" | "double_side")
                }
                {...hydrationSafeProps}
              >
                <option value="single_side">Single side</option>
                <option value="double_side">Double side</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="pageCount">
                Page count
              </label>
              <input
                id="pageCount"
                name="pageCount"
                type="number"
                min="1"
                value={pageCount}
                onChange={(event) => setPageCount(Number(event.target.value) || 1)}
                className="input"
                required
                {...hydrationSafeProps}
              />
            </div>

            <div>
              <label className="label" htmlFor="copies">
                Copies
              </label>
              <input
                id="copies"
                name="copies"
                type="number"
                min="1"
                max={MAX_COPIES_PER_ORDER}
                value={copies}
                onChange={(event) => setCopies(Number(event.target.value) || 1)}
                className="input"
                required
                {...hydrationSafeProps}
              />
              <p className="mt-2 text-xs text-[#776b61]">Maximum {MAX_COPIES_PER_ORDER} copies.</p>
            </div>

            <div className="md:col-span-2">
              <label className="label" htmlFor="notes">
                Extra note
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="input min-h-28"
                placeholder="Optional"
                {...hydrationSafeProps}
              />
            </div>
          </div>
        </section>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={loading || showSuccessDialog}
          className="btn-primary w-full sm:ml-auto sm:w-auto"
          {...hydrationSafeProps}
        >
          {loading ? "Submitting..." : "Proceed"}
        </button>
      </div>

      {showSuccessDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="panel-strong w-full max-w-sm p-6">
            <h3 className="text-xl font-semibold text-slate-900">Order sent</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Sent to {submittedShop?.shopName || "the selected shop"}.
            </p>
            {createdTrackingCode ? (
              <p className="mt-3 text-sm text-slate-700">
                Tracking ID:{" "}
                <span className="font-semibold">
                  {formatTrackingId(submittedShop?.id || selectedShopId, createdTrackingCode)}
                </span>
              </p>
            ) : null}
          <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSuccessConfirm}
                className="btn-primary w-full sm:w-auto"
                {...hydrationSafeProps}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
