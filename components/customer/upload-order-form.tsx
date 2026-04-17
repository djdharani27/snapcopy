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
  shop,
  profile,
}: {
  shop: Shop;
  profile: UserProfile;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdTrackingCode, setCreatedTrackingCode] = useState("");
  const [error, setError] = useState("");
  const [printType, setPrintType] = useState<"color" | "black_white">("black_white");
  const [sideType, setSideType] = useState<"single_side" | "double_side">("single_side");
  const [copies, setCopies] = useState(1);

  function handleSuccessConfirm() {
    setShowSuccessDialog(false);
    setCreatedTrackingCode("");
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
          shopId: shop.id,
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

      form.reset();
      setPrintType("black_white");
      setSideType("single_side");
      setCopies(1);
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
    <form onSubmit={handleSubmit} className="panel p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Send documents to {shop.shopName}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Accepted formats: PDF, DOC, DOCX, PNG, JPG. Maximum 10 files, 15 MB
          each.
        </p>
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

        <div>
          <label className="label" htmlFor="files">
            Files
          </label>
          <input
            id="files"
            name="files"
            type="file"
            multiple
            accept={ACCEPTED_FILE_EXTENSIONS}
            className="input py-2.5"
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          className="input"
          placeholder="Optional instructions for the shop"
        />
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading || showSuccessDialog} className="btn-primary">
          {loading ? "Submitting..." : "Upload and place order"}
        </button>
      </div>

      {showSuccessDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-semibold text-slate-900">Order sent</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Your documents were sent to {shop.shopName}. Click OK to go back to
              your orders.
            </p>
            {createdTrackingCode ? (
              <p className="mt-3 text-sm text-slate-700">
                Tracking ID:{" "}
                <span className="font-semibold">
                  {formatTrackingId(shop.id, createdTrackingCode)}
                </span>
              </p>
            ) : null}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleSuccessConfirm}
                className="btn-primary"
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
