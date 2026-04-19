"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_ORDER,
} from "@/lib/utils/constants";
import { formatTrackingId } from "@/lib/utils/format";
import type { Shop, UserProfile } from "@/types";

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
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdTrackingCode, setCreatedTrackingCode] = useState("");
  const [error, setError] = useState("");
  const [submittedShop, setSubmittedShop] = useState<Shop | null>(null);
  const [printType, setPrintType] = useState<"color" | "black_white">("black_white");
  const [sideType, setSideType] = useState<"single_side" | "double_side">("single_side");
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

      if (files.length === 0) throw new Error("Add at least one file.");
      if (files.length > MAX_FILES_PER_ORDER) {
        throw new Error(`You can upload up to ${MAX_FILES_PER_ORDER} files.`);
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
          notes: formData.get("notes"),
          printType: formData.get("printType"),
          sideType: formData.get("sideType"),
          copies: Number(formData.get("copies")),
          files: uploadResult.files,
        }),
      });

      const orderResult = await orderResponse.json();
      if (!orderResponse.ok) {
        throw new Error(orderResult.error || "Order creation failed.");
      }

      setSubmittedShop(selectedShop);
      form.reset();
      setPrintType("black_white");
      setSideType("single_side");
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
      <div className="mb-6">
        <p className="eyebrow">Order builder</p>
        <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-2xl">
          Build your print request
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Add files, pick the shop, confirm the print specs, then send. Formats: PDF, DOC, DOCX,
          PNG, JPG. Maximum 10 files, 15 MB each.
        </p>
      </div>

      <div className="space-y-5">
        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.82)] p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <p className="label">Step 1</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
                Add files and pick the shop
              </h3>
            </div>
            <div className="inline-flex w-fit rounded-full bg-[#f5decc] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#9c4c20]">
              Required
            </div>
          </div>

          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept={ACCEPTED_FILE_EXTENSIONS}
            className="input py-3"
            required
          />

          <div className="mt-4">
            <label className="label" htmlFor="shopId">
              Print shop
            </label>
            <select
              id="shopId"
              name="shopId"
              className="input"
              value={selectedShopId}
              onChange={(event) => setSelectedShopId(event.target.value)}
              required
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
          </div>

        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,253,249,0.86)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 2</p>
            <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-slate-900">
              Confirm your details
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
                />
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-[#eadfd3] bg-[rgba(255,248,241,0.7)] p-4 sm:p-5">
          <div className="mb-4">
            <p className="label">Step 3</p>
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
              >
                <option value="single_side">Single side</option>
                <option value="double_side">Double side</option>
              </select>
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
                value={copies}
                onChange={(event) => setCopies(Number(event.target.value) || 1)}
                className="input"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="label" htmlFor="notes">
                Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                className="input min-h-28"
                placeholder="Optional instructions for the shop"
              />
            </div>
          </div>
        </section>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[#776b61]">
          The shop receives your files right after submission.
        </p>
        <button
          type="submit"
          disabled={loading || showSuccessDialog}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? "Submitting..." : "Send print order"}
        </button>
      </div>

      {showSuccessDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="panel-strong w-full max-w-sm p-6">
            <h3 className="text-xl font-semibold text-slate-900">Order sent</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your documents were sent to {submittedShop?.shopName || "the selected shop"}. Click
              OK to go back to your orders.
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
              <button type="button" onClick={handleSuccessConfirm} className="btn-primary">
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
