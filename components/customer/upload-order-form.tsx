"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_FILE_EXTENSIONS,
  ACCEPTED_FILE_TYPES,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_ORDER,
} from "@/lib/utils/constants";
import type { Shop } from "@/types";

export function UploadOrderForm({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setSuccess("");
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
      setSuccess("Documents uploaded and order created successfully.");
      router.refresh();
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
          <input id="customerName" name="customerName" className="input" required />
        </div>

        <div>
          <label className="label" htmlFor="customerPhone">
            Phone number
          </label>
          <input id="customerPhone" name="customerPhone" className="input" required />
        </div>

        <div>
          <label className="label" htmlFor="printType">
            Print type
          </label>
          <select id="printType" name="printType" className="input" defaultValue="black_white">
            <option value="black_white">Black &amp; white</option>
            <option value="color">Color</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="sideType">
            Side type
          </label>
          <select id="sideType" name="sideType" className="input" defaultValue="single_side">
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
            defaultValue="1"
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
      {success ? <p className="mt-4 text-sm text-emerald-700">{success}</p> : null}

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? "Submitting..." : "Upload and place order"}
        </button>
      </div>
    </form>
  );
}
